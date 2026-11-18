import {
    COLOR_OPTIONS,
    DRESS_CODES,
    NO_COLOR_PREFERENCE,
    OCCASIONS,
    STYLE_PREFERENCES,
    type Catalog,
    type RankedOutfit,
    type UserPreferences,
} from '@/types/domain';
import { formatUsd } from '@/lib/format';

/**
 * Prompt construction for the live stylist.
 *
 * Design principle: the model is never asked to *invent* an outfit. It is handed
 * the exact candidate set the deterministic engine already produced and asked to
 * choose and explain. That inverts the usual failure mode of LLM recommenders —
 * instead of hoping the model respects a budget, the budget has already been
 * enforced in code and the model can only pick from what survived.
 *
 * Everything the model may reference is enumerated here: valid outfit IDs, their
 * real prices, and the closed vocabularies for preferences. Anything outside
 * those lists is rejected downstream in `aiStylist.ts` regardless of what the
 * model says.
 */

export type StylistMode = 'parse' | 'rank';

export const STYLIST_MODES = {
    /** Natural language → preference patch + clarifying question. */
    parse: 'parse',
    /** Rank pre-filtered candidates and explain each one. */
    rank: 'rank',
} as const;

/** The JSON shape both modes must return. Kept flat and simple for reliability. */
export interface StylistResponseShape {
    /** Short conversational reply shown in the chat transcript. */
    reply: string;
    /** Preference fields to patch. Omitted keys are left untouched. */
    preferences?: {
        occasion?: string | null;
        dressCode?: string | null;
        budget?: number | null;
        styles?: string[];
        colors?: string[];
    };
    /** True when the model needs more information before it can help. */
    needsClarification?: boolean;
    /** Ranked outfit IDs with reasons. Only valid IDs are accepted. */
    rankings?: Array<{ outfitId: string; reason: string }>;
}

const PREFERENCE_SCHEMA = `
PREFERENCE VOCABULARY — you may only use these exact strings:

occasion: ${OCCASIONS.map((o) => `"${o}"`).join(' | ')}
dressCode: ${DRESS_CODES.map((d) => `"${d}"`).join(' | ')}
styles (multi): ${STYLE_PREFERENCES.map((s) => `"${s}"`).join(' | ')}
colors (multi): ${COLOR_OPTIONS.map((c) => `"${c}"`).join(' | ')} | "${NO_COLOR_PREFERENCE}"

"${NO_COLOR_PREFERENCE}" is exclusive: if you include it, include no other color.
budget: a positive number in whole US dollars, or null.
`.trim();

/**
 * System prompt for the parsing / conversation mode.
 *
 * The clarifying-question rule is placed early and stated as a hard rule because
 * it is the behaviour most likely to be skipped: a helpful-sounding model will
 * otherwise happily invent an occasion rather than ask.
 */
export function buildParseSystemPrompt(): string {
    return `You are VibeFit's styling assistant. You help a user decide what to wear for a specific event.

Your job in this mode is to convert the user's message into structured preferences.

HARD RULES
1. If the user has NOT specified an occasion, or has NOT specified a budget, you must ask for the missing one(s) and set "needsClarification": true. Do not invent either. Asking one short, specific question beats guessing.
2. Only set preference fields the user actually mentioned or unambiguously implied. Never reset a field they did not mention — the app preserves everything else automatically.
3. Follow-up messages may be relative: "make it cheaper" means reduce the current budget (given below) by about 20%; "something fancier" means step the dress code one level more formal. Use the CURRENT STATE supplied with each message.
4. Never mention prices, products, or outfits in this mode. You are only extracting preferences.

${PREFERENCE_SCHEMA}

Return ONLY valid JSON, no markdown fences, no commentary, matching:
{
  "reply": "one or two short sentences to show the user",
  "preferences": { /* only the fields that changed */ },
  "needsClarification": false
}`;
}

/**
 * System prompt for ranking mode.
 *
 * The candidate list is the only source of truth. The instruction to treat
 * unknown IDs as forbidden is explicit, but it is backed by hard validation in
 * `aiStylist.ts` — prompt instructions alone are not a security boundary.
 */
export function buildRankSystemPrompt(): string {
    return `You are VibeFit's styling assistant. Your job is to rank outfit options the user can already afford and has already been matched with.

HARD RULES
1. You may ONLY reference outfits from the CANDIDATES list. Never invent an outfit, an ID, a garment, a price, or a retailer.
2. Never state a price. The app displays prices itself, and a number you write may be wrong. Refer to the budget qualitatively: "comfortably within budget", "close to your limit".
3. Rank the candidates by how well they suit the stated occasion, dress code, style, and color preferences. Best first. Include at most 6.
4. Each reason must be one short sentence (under 110 characters) that explains WHY this outfit suits this specific user. Cite the occasion, the formality, the style, or the palette. Do not be generic ("looks great").
5. If the candidate list is empty, say plainly that nothing matched and suggest which single constraint to relax. Return an empty rankings array.
6. Write in second person, warm and concise. No exclamation marks. No emoji.

Return ONLY valid JSON, no markdown fences, no commentary, matching:
{
  "reply": "one short sentence summarising the selection",
  "rankings": [{ "outfitId": "<id from CANDIDATES>", "reason": "<why it suits them>" }]
}`;
}

/**
 * Compact candidate payload.
 *
 * Includes only what the model needs to justify a ranking, and deliberately
 * excludes `productUrl` and product-level prices so there is nothing tempting to
 * quote back at the user.
 */
export function buildRankUserPrompt(preferences: UserPreferences, candidates: RankedOutfit[]): string {
    const candidateList = candidates.map((entry, index) => ({
        rank: index + 1,
        outfitId: entry.outfit.id,
        name: entry.outfit.name,
        tagline: entry.outfit.tagline,
        pieces: entry.items.map((item) => `${item.slot}: ${item.name} (${item.retailer})`),
        colors: entry.outfit.colors,
        styles: entry.outfit.styles,
        // Coarse affordability signal only — no figure for the model to restate.
        affordability:
            preferences.budget && entry.knownTotal <= preferences.budget * 0.7
                ? 'comfortable'
                : preferences.budget && entry.knownTotal <= preferences.budget
                    ? 'close to limit'
                    : 'within budget',
        priceComplete: entry.priceComplete,
    }));

    return [
        'USER PREFERENCES',
        `occasion: ${preferences.occasion ?? 'unspecified'}`,
        `dressCode: ${preferences.dressCode ?? 'unspecified'}`,
        `budget: ${preferences.budget !== null ? `${formatUsd(preferences.budget)} total` : 'unspecified'}`,
        `styles: ${preferences.styles.length ? preferences.styles.join(', ') : 'none set'}`,
        `colors: ${preferences.colors.length ? preferences.colors.join(', ') : 'none set'}`,
        '',
        'CANDIDATES (the only outfits you may reference)',
        JSON.stringify(candidateList, null, 2),
    ].join('\n');
}

/**
 * Current-state block for parse mode, so relative follow-ups are resolvable
 * ("cheaper" needs to know what the current budget is).
 */
export function buildParseUserPrompt(message: string, current: UserPreferences): string {
    return [
        'CURRENT STATE',
        `occasion: ${current.occasion ?? 'not set'}`,
        `dressCode: ${current.dressCode ?? 'not set'}`,
        `budget: ${current.budget !== null ? formatUsd(current.budget) : 'not set'}`,
        `styles: ${current.styles.length ? current.styles.join(', ') : 'not set'}`,
        `colors: ${current.colors.length ? current.colors.join(', ') : 'not set'}`,
        '',
        'USER MESSAGE',
        message,
    ].join('\n');
}

/** Kept for tests: asserts the prompt never leaks catalog internals. */
export function promptForbiddenFragments(catalog: Catalog): string[] {
    void catalog;
    return ['productUrl', 'http://', 'https://'];
}
