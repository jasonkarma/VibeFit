import {
    COLOR_OPTIONS,
    DEFAULT_DEPARTMENT,
    DRESS_CODES,
    NO_COLOR_PREFERENCE,
    OCCASIONS,
    RETAILERS,
    STYLE_PREFERENCES,
    type ColorPreference,
    type Department,
    type DressCode,
    type Occasion,
    type StylePreference,
    type UserPreferences,
} from '@/types/domain';
import { formatUsd } from '@/lib/format';
import { validateBudget } from '@/features/preferences/validation';

/**
 * Deterministic natural-language parser for the styling chat.
 *
 * This is the charter's "conversational AI assistant" implemented without a
 * network call. That is a deliberate engineering decision, not a shortcut:
 *
 *  - the demo cannot fail because of a rate limit, an API key, or a bad
 *    connection in a lecture hall
 *  - behaviour is reproducible, so it can be unit tested (15+ utterances in the
 *    suite) and shown to a reviewer as deterministic logic rather than vibes
 *  - every interpretation is explainable, which matters when the output changes
 *    the user's saved preferences
 *
 * The function is pure: same input and same current state always produce the
 * same patch. That property is asserted in the tests.
 */

export interface ParsedIntent {
    patch: Partial<UserPreferences>;
    /** Human-readable confirmation of what changed. */
    reply: string;
    /** Field labels for the animated patch pills. */
    appliedFields: string[];
    understood: boolean;
}

/**
 * Occasion synonyms, ordered by specificity: the first match wins.
 *
 * Order matters for genuinely ambiguous phrasing. "Office holiday party" names
 * both Work and Party, but the user is dressing for the party, so the narrower
 * social signal must be tested first. Weddings sit at the top because the word
 * is unambiguous and dominates any other mention.
 */
const OCCASION_SYNONYMS: Array<[RegExp, Occasion]> = [
    [/\b(wedding|bride|groom|ceremony|reception|marrying)\b/i, 'Wedding'],
    [/\b(party|night out|dinner|birthday|club|celebrat\w*|cocktail hour|gala|drinks)\b/i, 'Party'],
    [/\b(work|office|boardroom|meeting|interview|client|business day)\b/i, 'Work'],
    [/\b(casual outing|weekend|brunch|errand|coffee|everyday|day out|stroll)\b/i, 'Casual Outing'],
];

const DRESS_CODE_SYNONYMS: Array<[RegExp, DressCode]> = [
    [/\bblack[- ]?tie\b/i, 'Black Tie'],
    [/\bcocktail\b/i, 'Cocktail'],
    [/\bbusiness[- ]?formal\b/i, 'Business Formal'],
    [/\bsmart[- ]?casual\b/i, 'Smart Casual'],
    [/\bcasual\b/i, 'Casual'],
];

const STYLE_SYNONYMS: Array<[RegExp, StylePreference]> = [
    [/\bminimal(ist)?\b/i, 'Minimalist'],
    [/\bclassic\b/i, 'Classic'],
    [/\btrendy\b|\bfashion[- ]?forward\b|\bcurrent\b/i, 'Trendy'],
    [/\bstreet[- ]?wear\b|\bstreet\b|\burban\b/i, 'Streetwear'],
    [/\bbohemian\b|\bboho\b|\bflowy\b/i, 'Bohemian'],
];

const COLOR_SYNONYMS: Array<[RegExp, ColorPreference]> = [
    [/\bno colou?r preference\b|\bany colou?r\b|\bwhatever colou?r\b/i, NO_COLOR_PREFERENCE],
    [/\bearth tones?\b|\bneutral\b|\bwarm tones?\b|\btan\b/i, 'Earth Tones'],
    [/\bcolou?rful\b|\bbright\b|\bstatement colou?r\b/i, 'Colorful'],
    [/\bnavy\b|\bblue\b/i, 'Navy'],
    [/\bwhite\b|\bcream\b|\bivory\b/i, 'White'],
    [/\bblack\b|\bdark\b/i, 'Black'],
    [/\bbeige\b|\bcamel\b|\bsand\b|\bstone\b/i, 'Beige'],
];

/** Matches "$250", "under 250", "250 dollars", "budget of 180", "max 300". */
const BUDGET_PATTERNS = [
    /\$\s?(\d[\d,]*(?:\.\d{1,2})?)/i,
    /\b(?:under|below|less than|up to|max|maximum|budget of|around|about)\s+\$?(\d[\d,]*(?:\.\d{1,2})?)/i,
    /\b(\d[\d,]*(?:\.\d{1,2})?)\s?(?:dollars|usd|bucks)\b/i,
];

/**
 * Department synonyms (Sprint 3).
 *
 * The `\b` before `men'?s` is load-bearing: without it, "women's" contains "men's"
 * as a substring and every womenswear request would be read as menswear. With the
 * boundary, the matched token must start at a word edge, and in "women's" the
 * letters "men" are preceded by "o".
 *
 * "All" is matched proactively too, so a user can undo a department choice in
 * conversation rather than being stuck with it until they reload the screen.
 */
const DEPARTMENT_SYNONYMS: Array<[RegExp, Department]> = [
    [/\b(wom[ae]n'?s(?:wear)?|for women|ladies|womenswear)\b/i, 'Womenswear'],
    [/\b(men'?s(?:wear)?|for men|gents|menswear)\b/i, 'Menswear'],
    [/\b(any department|either department|all departments|no department preference)\b/i, 'All'],
];

/**
 * Retailer synonyms (Sprint 3).
 *
 * Derived from the closed `RETAILERS` vocabulary rather than hand-written, so a
 * retailer added to the catalog becomes chattable automatically and the parser can
 * never drift from the filter it feeds.
 *
 * Each retailer gets a tolerant pattern: the full name, plus the first word when it
 * is distinctive ("& Other Stories" → "other stories", "Massimo Dutti" → "massimo").
 * Very short or generic names are matched only in full, because "cos" or "gap" as a
 * bare substring would misfire inside ordinary words.
 */
const RETAILER_PATTERNS: Array<[RegExp, string]> = RETAILERS.flatMap((retailer) => {
    /*
     * Anchoring rule: `\b` is only valid next to a word character.
     *
     * "& Other Stories" starts with `&`, which is not a word character, so
     * `\b&` can never match — JavaScript would require a word character before the
     * `&`. That single mistake made the retailer unreachable by name. Instead of
     * hand-casing it, each end is anchored conditionally based on whether the
     * adjacent character is a word character.
     */
    const escaped = retailer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const startsWithWord = /^\w/.test(retailer);
    const endsWithWord = /\w$/.test(retailer);
    const left = startsWithWord ? '\\b' : '';
    const right = endsWithWord ? '\\b' : '';

    const patterns: Array<[RegExp, string]> = [
        [new RegExp(`${left}${escaped}${right}`, 'i'), retailer],
    ];

    /*
     * A distinctive first word, so "Massimo" and "Massimo Dutti" both work.
     * Skipped for names whose first token is generic ("&", "G.H.") or too short to
     * be unambiguous.
     */
    const firstWord = retailer.split(' ')[0];
    if (firstWord.length >= 5 && /^\w/.test(firstWord) && firstWord !== retailer) {
        const escapedWord = firstWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        patterns.push([new RegExp(`\\b${escapedWord}\\b`, 'i'), retailer]);
    }

    // Colloquial shortenings a user will actually type.
    if (retailer === 'Nordstrom') patterns.push([/\bnordstrom'?s?\b/i, retailer]);
    if (retailer === '& Other Stories') patterns.push([/\bother stories\b/i, retailer]);
    if (retailer === 'G.H. Bass') patterns.push([/\b(gh ?bass|bass weejuns)\b/i, retailer]);

    return patterns;
});

/** Follow-up refinements that need context from the current state. */
const CHEAPER = /\b(cheaper|less expensive|lower budget|something cheap|more affordable|tighten)\b/i;
const FANCier = /\b(fancier|dressier|more formal|elevate|step it up)\b/i;
const RESET = /\b(start over|reset|clear everything|forget it)\b/i;
const SHOW_ME = /\b(show me|recommend|what should i wear|suggest|give me)\b/i;

/**
 * Parse one chat message against the current preferences.
 *
 * Only fields the message actually mentions are patched. Everything else is left
 * untouched, which is what makes "change one preference without clearing the
 * others" hold for the chat path too, not just the form path.
 */
export function parseChatMessage(
    text: string,
    current: UserPreferences,
): ParsedIntent {
    const input = text.trim();
    const patch: Partial<UserPreferences> = {};
    const appliedFields: string[] = [];

    if (input === '') {
        return {
            patch: {},
            reply: 'Tell me the occasion, dress code, budget, or style and I will set it up.',
            appliedFields: [],
            understood: false,
        };
    }

    if (RESET.test(input)) {
        return {
            patch: {
                occasion: null,
                dressCode: null,
                budget: null,
                budgetInput: '',
                styles: [],
                colors: [],
                // Reset restores the defaults, not "unset": department returns to
                // `All` and the retailer filter to "any shop".
                department: DEFAULT_DEPARTMENT,
                preferredRetailers: [],
            },
            reply: 'Cleared everything. Where are you headed?',
            appliedFields: ['Occasion', 'Dress code', 'Budget', 'Style', 'Color'],
            understood: true,
        };
    }

    // --- Occasion ---
    for (const [pattern, occasion] of OCCASION_SYNONYMS) {
        if (pattern.test(input) && current.occasion !== occasion) {
            patch.occasion = occasion;
            appliedFields.push(`Occasion → ${occasion}`);
            break;
        }
    }

    // --- Dress code (checked before style, since "casual" appears in both) ---
    for (const [pattern, dressCode] of DRESS_CODE_SYNONYMS) {
        if (pattern.test(input) && current.dressCode !== dressCode) {
            patch.dressCode = dressCode;
            appliedFields.push(`Dress code → ${dressCode}`);
            break;
        }
    }

    /*
     * --- Department (Sprint 3) ---
     *
     * Credited to the user's words, not inferred from the occasion: assuming
     * menswear because the message says "suit" would be a guess about the person,
     * not about the outfit. Only an explicit mention sets it.
     */
    for (const [pattern, department] of DEPARTMENT_SYNONYMS) {
        if (pattern.test(input) && current.department !== department) {
            patch.department = department;
            appliedFields.push(`Department → ${department}`);
            break;
        }
    }

    // --- Styles (multi-select: collect every mention) ---
    const matchedStyles = new Set<StylePreference>();
    for (const [pattern, style] of STYLE_SYNONYMS) {
        if (pattern.test(input)) matchedStyles.add(style);
    }
    if (matchedStyles.size > 0) {
        const next = Array.from(matchedStyles);
        const unchanged =
            next.length === current.styles.length && next.every((s) => current.styles.includes(s));
        if (!unchanged) {
            patch.styles = next;
            appliedFields.push(`Style → ${next.join(', ')}`);
        }
    }

    // --- Colors ---
    const matchedColors = new Set<ColorPreference>();
    for (const [pattern, color] of COLOR_SYNONYMS) {
        if (pattern.test(input)) matchedColors.add(color);
    }
    if (matchedColors.size > 0) {
        let next = Array.from(matchedColors);
        // Preserve the mutual-exclusion invariant here as well as in the store.
        if (next.includes(NO_COLOR_PREFERENCE)) next = [NO_COLOR_PREFERENCE];
        const unchanged =
            next.length === current.colors.length && next.every((c) => current.colors.includes(c));
        if (!unchanged) {
            patch.colors = next;
            appliedFields.push(`Color → ${next.join(', ')}`);
        }
    }

    /*
     * --- Retailers (Sprint 3) ---
     *
     * Multi-select, unioned with whatever is already selected rather than replacing
     * it: "also Zara" is the common phrasing, and silently dropping Uniqlo because
     * the second message only mentioned Zara would be a small betrayal of the
     * partial-patch promise the whole store is built around.
     */
    const matchedRetailers = new Set<string>(current.preferredRetailers ?? []);
    for (const [pattern, retailer] of RETAILER_PATTERNS) {
        if (pattern.test(input)) matchedRetailers.add(retailer);
    }
    if (matchedRetailers.size > 0) {
        const next = Array.from(matchedRetailers).sort();
        const unchanged =
            next.length === (current.preferredRetailers ?? []).length &&
            next.every((entry) => (current.preferredRetailers ?? []).includes(entry));
        if (!unchanged) {
            patch.preferredRetailers = next;
            appliedFields.push(`Shops → ${next.join(', ')}`);
        }
    }

    // --- Budget ---
    const budgetMatch = extractBudget(input);
    if (budgetMatch !== null) {
        const validation = validateBudget(String(budgetMatch));
        if (validation.ok) {
            patch.budget = validation.value;
            patch.budgetInput = String(validation.value);
            appliedFields.push(`Budget → ${formatUsd(validation.value)}`);
        } else {
            // A number was found but is not usable. Say so instead of silently
            // ignoring it — silently ignoring is how chat interfaces lose trust.
            return {
                patch,
                reply: `${validation.error} Try something like "under 250".`,
                appliedFields,
                understood: appliedFields.length > 0,
            };
        }
    }

    // --- Relative refinements ---
    if (Object.keys(patch).length === 0) {
        if (CHEAPER.test(input)) {
            const target = current.budget !== null ? Math.max(25, Math.round(current.budget * 0.8)) : 150;
            patch.budget = target;
            patch.budgetInput = String(target);
            appliedFields.push(`Budget → ${formatUsd(target)}`);
            return {
                patch,
                reply: `Lowered your budget to ${formatUsd(target)}. Adjust it again if that is too tight.`,
                appliedFields,
                understood: true,
            };
        }

        if (FANCier.test(input)) {
            const index = current.dressCode ? DRESS_CODES.indexOf(current.dressCode) : -1;
            const nextCode = DRESS_CODES[Math.min(index + 1, DRESS_CODES.length - 1)] ?? 'Cocktail';
            patch.dressCode = nextCode;
            appliedFields.push(`Dress code → ${nextCode}`);
            return {
                patch,
                reply: `Stepped the formality up to ${nextCode}.`,
                appliedFields,
                understood: true,
            };
        }
    }

    if (appliedFields.length === 0) {
        return {
            patch: {},
            reply: buildClarifyingReply(current),
            appliedFields: [],
            understood: false,
        };
    }

    return {
        patch,
        reply: buildConfirmation(patch, appliedFields),
        appliedFields,
        understood: true,
    };
}

function extractBudget(input: string): number | null {
    for (const pattern of BUDGET_PATTERNS) {
        const match = input.match(pattern);
        if (match) {
            const numeric = Number.parseFloat(match[1].replace(/,/g, ''));
            if (Number.isFinite(numeric)) return numeric;
        }
    }
    return null;
}

/**
 * When nothing was understood, ask for the single most useful missing piece
 * rather than repeating a generic "I didn't get that". The charter risk register
 * explicitly calls for clarifying questions when details are missing.
 */
function buildClarifyingReply(current: UserPreferences): string {
    const missing: string[] = [];

    if (!current.occasion) missing.push('the occasion');
    if (!current.dressCode) missing.push('the dress code');
    if (current.budget === null) missing.push('your budget');
    if (current.styles.length === 0) missing.push('a style');
    if (current.colors.length === 0) missing.push('a color, or no preference');

    if (missing.length > 0) {
        return `I did not catch a preference there. I still need ${joinList(missing)}. Try "a summer wedding, cocktail, under $250".`;
    }

    return 'I could not spot a preference in that. Try naming an occasion, a dress code, a budget, or a style.';
}

function buildConfirmation(
    patch: Partial<UserPreferences>,
    appliedFields: string[],
): string {
    const parts: string[] = [];

    if (patch.occasion) parts.push(`for a ${patch.occasion.toLowerCase()}`);
    if (patch.dressCode) parts.push(`at ${patch.dressCode} formality`);
    if (patch.budget != null) parts.push(`capped at ${formatUsd(patch.budget)}`);
    if (patch.styles?.length) parts.push(`leaning ${patch.styles.join(' and ').toLowerCase()}`);
    if (patch.colors?.length) {
        const colorPart = patch.colors.includes(NO_COLOR_PREFERENCE)
            ? 'open on color'
            : `${patch.colors.join(' and ').toLowerCase()}`;
        parts.push(colorPart);
    }

    const summary = parts.length > 0 ? `Updated: ${parts.join(', ')}.` : 'Updated your preferences.';
    return `${summary} Generate whenever you are ready.`;
}

function joinList(items: string[]): string {
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

/** Exported so tests can assert vocabulary coverage without duplicating data. */
export const CHAT_VOCABULARY = {
    occasions: OCCASIONS,
    dressCodes: DRESS_CODES,
    styles: STYLE_PREFERENCES,
    colors: COLOR_OPTIONS,
    showMeTrigger: SHOW_ME,
} as const;
