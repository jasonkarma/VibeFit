import { z } from 'zod';
import {
    COLOR_OPTIONS,
    DRESS_CODES,
    NO_COLOR_PREFERENCE,
    OCCASIONS,
    STYLE_PREFERENCES,
    type ColorPreference,
    type DressCode,
    type Occasion,
    type RankedOutfit,
    type StylePreference,
    type UserPreferences,
} from '@/types/domain';
import { formatUsd } from '@/lib/format';
import { validateBudget } from '@/features/preferences/validation';
import {
    buildParseSystemPrompt,
    buildParseUserPrompt,
    buildRankSystemPrompt,
    buildRankUserPrompt,
} from '@/prompts/stylistPrompt';

/**
 * LumiaRouter-backed stylist.
 *
 * Three responsibilities, in strict order of trust:
 *   1. Decide whether the live model is usable at all (key present, not in tests).
 *   2. Make the call and parse the response defensively.
 *   3. Validate every field the model returned before it is allowed near app state.
 *
 * Step 3 is not paranoia. A model can return an outfit ID that does not exist, a
 * style that is not in our vocabulary, a negative budget, or a reason that quotes
 * a price we never gave it. Each of those would surface as a broken card, a
 * failed filter, or a lie in the UI. Everything is checked against the closed
 * vocabularies in `types/domain.ts` and the real candidate list.
 *
 * Failure policy: every exported function is total. It never throws to the
 * caller. On any problem it returns null and the caller falls back to the
 * deterministic local engine, so the demo degrades instead of breaking.
 */

export const LOCAL_MODEL_LABEL = 'Local Engine';
export const LIVE_MODEL_LABEL = 'Opus 5.5 Live';

export type AiStatus = 'live' | 'local';

const DEFAULT_BASE_URL = 'https://lumiarouter.com/v1';
const DEFAULT_MODEL = 'claude-opus-5-5';

/** Proxy path avoids CORS; the dev server forwards to LumiaRouter. */
const PROXY_PREFIX = '/api/lumia';

const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Status is resolved once per page load, then degraded permanently if a call
 * fails hard. A badge that flips back and forth is worse than one that honestly
 * says "Local Engine" after the network proved unreliable.
 */
let degraded = false;

function isTestEnvironment(): boolean {
    return Boolean(import.meta.env?.VITEST) || import.meta.env?.MODE === 'test';
}

function apiKey(): string {
    return (import.meta.env?.VITE_AI_API_KEY ?? '').trim();
}

function baseUrl(): string {
    return (import.meta.env?.VITE_AI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function model(): string {
    return (import.meta.env?.VITE_AI_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL;
}

/**
 * Whether a live call should even be attempted.
 *
 * Tests are excluded unconditionally: the suite must never depend on a network
 * or a paid key, and Sprint 1's 115 deterministic tests must stay deterministic.
 */
export function isAiConfigured(): boolean {
    if (isTestEnvironment()) return false;
    if (degraded) return false;
    return apiKey().length > 0;
}

export function getAiStatus(): AiStatus {
    return isAiConfigured() ? 'live' : 'local';
}

export function getAiModelLabel(): string {
    return getAiStatus() === 'live' ? LIVE_MODEL_LABEL : LOCAL_MODEL_LABEL;
}

/** Test-only hook so fallback behaviour can be exercised deterministically. */
export function __setDegradedForTests(value: boolean): void {
    degraded = value;
}

/** Test-only hook to inspect the resolved config without a network call. */
export function __getAiConfigForTests() {
    return { baseUrl: baseUrl(), hasKey: apiKey().length > 0, model: model() };
}

// ─────────────────────────────────────────────────────────────────────────────
// Response validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loosely-typed envelope first. The model's output is parsed as `unknown` and
 * progressively narrowed, because a malformed field must discard only that field
 * rather than the whole response (and vice versa for structurally wrong payloads).
 */
const envelopeSchema = z.object({
    reply: z.string().optional(),
    preferences: z
        .object({
            occasion: z.unknown().optional(),
            dressCode: z.unknown().optional(),
            budget: z.unknown().optional(),
            styles: z.unknown().optional(),
            colors: z.unknown().optional(),
        })
        .optional(),
    needsClarification: z.boolean().optional(),
    rankings: z.unknown().optional(),
});

/** Extracts the first JSON object from a string, tolerating fences and preamble. */
export function extractJson(raw: string): unknown | null {
    const text = raw.trim();

    // Strip ```json fences if the model added them despite instructions.
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1].trim() : text;

    try {
        return JSON.parse(candidate);
    } catch {
        // Fall back to the outermost braces, for responses with leading prose.
        const start = candidate.indexOf('{');
        const end = candidate.lastIndexOf('}');
        if (start === -1 || end <= start) return null;
        try {
            return JSON.parse(candidate.slice(start, end + 1));
        } catch {
            return null;
        }
    }
}

function asOccasion(value: unknown): Occasion | null {
    if (value === null) return null;
    return OCCASIONS.includes(value as Occasion) ? (value as Occasion) : null;
}

function asDressCode(value: unknown): DressCode | null {
    if (value === null) return null;
    return DRESS_CODES.includes(value as DressCode) ? (value as DressCode) : null;
}

/** Keeps only known styles, de-duplicated, capped at the vocabulary size. */
function asStyles(value: unknown): StylePreference[] | null {
    if (!Array.isArray(value)) return null;
    const seen = new Set<StylePreference>();
    for (const entry of value) {
        if (STYLE_PREFERENCES.includes(entry as StylePreference)) {
            seen.add(entry as StylePreference);
        }
    }
    return seen.size > 0 ? Array.from(seen) : null;
}

/**
 * Colour validation, including the mutual-exclusion invariant.
 *
 * If "No Color Preference" appears anywhere, it wins and concrete colours are
 * dropped — the same resolution rule the store applies, so the model cannot
 * smuggle in a contradictory pair.
 */
function asColors(value: unknown): ColorPreference[] | null {
    if (!Array.isArray(value)) return null;
    const seen = new Set<ColorPreference>();
    let optedOut = false;

    for (const entry of value) {
        if (entry === NO_COLOR_PREFERENCE) {
            optedOut = true;
            continue;
        }
        // Narrow against the concrete-colour enum; NO_COLOR_PREFERENCE is handled above.
        if (COLOR_OPTIONS.includes(entry as (typeof COLOR_OPTIONS)[number])) {
            seen.add(entry as ColorPreference);
        }
    }

    if (optedOut) return [NO_COLOR_PREFERENCE];
    return seen.size > 0 ? Array.from(seen) : null;
}

/** Budget must pass the same rules as the form, so the two paths cannot diverge. */
function asBudget(value: unknown): number | null | undefined {
    if (value === null) return null;
    if (typeof value === 'number') {
        const validation = validateBudget(String(value));
        return validation.ok ? validation.value : undefined;
    }
    if (typeof value === 'string') {
        const validation = validateBudget(value);
        return validation.ok ? validation.value : undefined;
    }
    return undefined;
}

export interface AiParseResult {
    patch: Partial<UserPreferences>;
    reply: string;
    appliedFields: string[];
    understood: boolean;
    needsClarification: boolean;
}

/**
 * Convert a validated response into a preference patch plus display metadata.
 *
 * Exported separately from the network call so the validation logic is testable
 * without mocking fetch.
 */
export function interpretParseResponse(
    payload: unknown,
    current: UserPreferences,
): AiParseResult | null {
    const envelope = envelopeSchema.safeParse(payload);
    if (!envelope.success) return null;

    const patch: Partial<UserPreferences> = {};
    const appliedFields: string[] = [];

    const prefs = envelope.data.preferences;
    if (prefs) {
        const occasion = asOccasion(prefs.occasion);
        if (occasion && occasion !== current.occasion) {
            patch.occasion = occasion;
            appliedFields.push(`Occasion → ${occasion}`);
        }

        const dressCode = asDressCode(prefs.dressCode);
        if (dressCode && dressCode !== current.dressCode) {
            patch.dressCode = dressCode;
            appliedFields.push(`Dress code → ${dressCode}`);
        }

        const styles = asStyles(prefs.styles);
        if (styles) {
            const unchanged =
                styles.length === current.styles.length && styles.every((s) => current.styles.includes(s));
            if (!unchanged) {
                patch.styles = styles;
                appliedFields.push(`Style → ${styles.join(', ')}`);
            }
        }

        const colors = asColors(prefs.colors);
        if (colors) {
            const unchanged =
                colors.length === current.colors.length && colors.every((c) => current.colors.includes(c));
            if (!unchanged) {
                patch.colors = colors;
                appliedFields.push(`Color → ${colors.join(', ')}`);
            }
        }

        const budget = asBudget(prefs.budget);
        if (budget !== undefined && budget !== current.budget) {
            if (budget === null) {
                patch.budget = null;
                patch.budgetInput = '';
                appliedFields.push('Budget → cleared');
            } else {
                patch.budget = budget;
                patch.budgetInput = String(budget);
                appliedFields.push(`Budget → ${formatUsd(budget)}`);
            }
        }
    }

    const reply =
        envelope.data.reply?.trim() ||
        (appliedFields.length > 0
            ? 'Updated your preferences.'
            : 'Tell me the occasion or your budget and I will narrow it down.');

    const needsClarification = Boolean(envelope.data.needsClarification);

    return {
        patch,
        reply,
        appliedFields,
        understood: appliedFields.length > 0 || needsClarification,
        needsClarification,
    };
}

/**
 * Validate ranking output against the real candidate list.
 *
 * Anything not in `allowedIds` is silently dropped — the model does not get to
 * create outfits. Reasons are trimmed and length-capped so a verbose response
 * cannot break the card layout. Duplicate IDs keep the first (best-ranked)
 * reason.
 */
export function interpretRankResponse(
    payload: unknown,
    allowedIds: Set<string>,
): Array<{ outfitId: string; reason: string }> | null {
    const envelope = envelopeSchema.safeParse(payload);
    if (!envelope.success) return null;
    if (!Array.isArray(envelope.data.rankings)) return null;

    const seen = new Set<string>();
    const accepted: Array<{ outfitId: string; reason: string }> = [];

    for (const entry of envelope.data.rankings) {
        if (typeof entry !== 'object' || entry === null) continue;
        const record = entry as Record<string, unknown>;
        const outfitId = record.outfitId;
        const reason = record.reason;

        if (typeof outfitId !== 'string' || !allowedIds.has(outfitId)) continue;
        if (seen.has(outfitId)) continue;
        if (typeof reason !== 'string') continue;

        const cleaned = sanitiseReason(reason);
        if (cleaned.length === 0) continue;

        seen.add(outfitId);
        accepted.push({ outfitId, reason: cleaned });
        if (accepted.length >= 6) break;
    }

    return accepted;
}

/**
 * Strip anything that resembles a fabricated price, and normalise whitespace.
 *
 * The model is instructed not to quote prices, but instructions are not a
 * guarantee. A wrong figure next to a correct one is the single most damaging
 * output this feature can produce, so currency patterns are removed outright
 * rather than trusted.
 */
export function sanitiseReason(raw: string): string {
    let text = raw.replace(/\s+/g, ' ').trim();

    // Remove "$186", "$1,200", "186 dollars", "USD 200".
    text = text.replace(/\$\s?\d[\d,]*(?:\.\d{1,2})?/g, '');
    text = text.replace(/\b\d[\d,]*(?:\.\d{1,2})?\s?(?:dollars|usd|bucks)\b/gi, '');
    text = text.replace(/\b(?:usd)\s?\d[\d,]*/gi, '');

    // Tidy artefacts left by removal: double spaces, space-before-punctuation.
    text = text.replace(/\s+([.,;:!?])/g, '$1').replace(/\s{2,}/g, ' ').trim();
    text = text.replace(/^[,;:.-\s]+/, '');

    if (text.length === 0) return '';
    if (text.length > 160) text = `${text.slice(0, 157).trimEnd()}…`;
    // Ensure sentence shape, since the removal above may have stripped the lead.
    if (!/[.!?…]$/.test(text)) text = `${text}.`;
    if (text.length < 3) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Transport
// ─────────────────────────────────────────────────────────────────────────────

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/**
 * POST /chat/completions through the dev proxy.
 *
 * Returns the assistant message content, or null on any failure. A null here is
 * an expected outcome, not an exception: it is the signal for the caller to use
 * the local engine.
 */
async function callChatCompletion(messages: ChatMessage[], maxTokens = 900): Promise<string | null> {
    if (!isAiConfigured()) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(`${PROXY_PREFIX}/chat/completions`, {
            method: 'POST',
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                // In the recommended setup the dev proxy overwrites this header with the
                // server-side key. Sent here only for the VITE_AI_API_KEY mode.
                Authorization: `Bearer ${apiKey()}`,
            },
            body: JSON.stringify({
                model: model(),
                messages,
                temperature: 0.2,
                max_tokens: maxTokens,
                // Nudges OpenAI-compatible routers toward parseable output.
                response_format: { type: 'json_object' },
            }),
        });

        if (!response.ok) {
            // 4xx here is usually a bad key or a model the router does not expose.
            // Degrade for the rest of the session rather than retrying on every message.
            degraded = true;
            return null;
        }

        const data = (await response.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
        };

        const content = data.choices?.[0]?.message?.content;
        if (typeof content !== 'string' || content.trim() === '') {
            degraded = true;
            return null;
        }

        return content;
    } catch {
        // Network error or timeout. Same policy: stop trying for this session.
        degraded = true;
        return null;
    } finally {
        clearTimeout(timer);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — all total, all falling back to null
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a chat message into a preference patch using the live model.
 * Returns null when the model is unavailable or its output fails validation.
 */
export async function parsePreferencesWithAi(
    message: string,
    current: UserPreferences,
): Promise<AiParseResult | null> {
    const content = await callChatCompletion([
        { role: 'system', content: buildParseSystemPrompt() },
        { role: 'user', content: buildParseUserPrompt(message, current) },
    ]);

    if (content === null) return null;

    const payload = extractJson(content);
    if (payload === null) return null;

    return interpretParseResponse(payload, current);
}

/**
 * Rank the engine's candidates and produce per-outfit reasons.
 *
 * Returns a map keyed by outfit id. Callers must treat missing ids as "no AI
 * reason" rather than as an error, since the engine's own reasons still apply.
 */
export async function rankOutfitsWithAi(
    preferences: UserPreferences,
    candidates: RankedOutfit[],
): Promise<Map<string, string> | null> {
    if (candidates.length === 0) return null;

    const content = await callChatCompletion([
        { role: 'system', content: buildRankSystemPrompt() },
        { role: 'user', content: buildRankUserPrompt(preferences, candidates) },
    ]);

    if (content === null) return null;

    const payload = extractJson(content);
    if (payload === null) return null;

    const allowedIds = new Set(candidates.map((entry) => entry.outfit.id));
    const rankings = interpretRankResponse(payload, allowedIds);
    if (rankings === null || rankings.length === 0) return null;

    return new Map(rankings.map((entry) => [entry.outfitId, entry.reason]));
}
