import type {
    DressCode,
    Occasion,
    Outfit,
    StylePreference,
    UserPreferences,
} from '@/types/domain';
import { formatUsd } from '@/lib/format';

/**
 * Deterministic weighted scoring.
 *
 * No randomness anywhere: identical preferences must always produce identical
 * ordering, otherwise the demo reshuffles on every render and the test suite
 * cannot assert on rank.
 */

export const SCORE_WEIGHTS = {
    occasion: 30,
    dressCode: 20,
    stylePerMatch: 10,
    styleCap: 30,
    colorPerMatch: 8,
    colorCap: 16,
    budgetHeadroom: 15,
    completePrice: 5,
} as const;

/** Maximum attainable score, used to normalise into a 0–100 match percentage. */
export const MAX_SCORE =
    SCORE_WEIGHTS.occasion +
    SCORE_WEIGHTS.dressCode +
    SCORE_WEIGHTS.styleCap +
    SCORE_WEIGHTS.colorCap +
    SCORE_WEIGHTS.budgetHeadroom +
    SCORE_WEIGHTS.completePrice;

export interface ScoreInput {
    outfit: Outfit;
    knownTotal: number;
    priceComplete: boolean;
}

export interface ScoreResult {
    score: number;
    matchScore: number;
    reasons: string[];
}

export function scoreOutfit(
    input: ScoreInput,
    prefs: Pick<UserPreferences, 'occasion' | 'dressCode' | 'budget' | 'styles' | 'colors'>,
): ScoreResult {
    const { outfit, knownTotal, priceComplete } = input;
    const reasons: string[] = [];
    let score = 0;

    if (prefs.occasion && outfit.occasions.includes(prefs.occasion)) {
        score += SCORE_WEIGHTS.occasion;
        reasons.push(`Styled for ${prefs.occasion}`);
    }

    if (prefs.dressCode && outfit.dressCodes.includes(prefs.dressCode)) {
        score += SCORE_WEIGHTS.dressCode;
        reasons.push(prefs.dressCode);
    }

    const styleMatches = prefs.styles.filter((style) => outfit.styles.includes(style));
    if (styleMatches.length > 0) {
        score += Math.min(styleMatches.length * SCORE_WEIGHTS.stylePerMatch, SCORE_WEIGHTS.styleCap);
        reasons.push(describeStyles(styleMatches));
    }

    const wantsColor = prefs.colors.length > 0 && !prefs.colors.includes('No Color Preference');
    if (wantsColor) {
        const concrete = prefs.colors.filter((c) => c !== 'No Color Preference');
        const colorMatches = outfit.colors.filter((color) => concrete.includes(color as never));
        if (colorMatches.length > 0) {
            score += Math.min(colorMatches.length * SCORE_WEIGHTS.colorPerMatch, SCORE_WEIGHTS.colorCap);
            reasons.push(`${colorMatches[0]} palette`);
        }
    }

    // Headroom reward: a comfortably affordable outfit beats one that just scrapes in.
    if (prefs.budget !== null && prefs.budget > 0 && knownTotal <= prefs.budget * 0.7) {
        score += SCORE_WEIGHTS.budgetHeadroom;
    }

    if (priceComplete) {
        score += SCORE_WEIGHTS.completePrice;
    }

    if (prefs.budget !== null && prefs.budget > 0) {
        reasons.push(`${formatUsd(knownTotal)} of your ${formatUsd(prefs.budget)} budget`);
    }

    if (!priceComplete) {
        reasons.push('One item price unavailable');
    }

    return {
        score,
        matchScore: Math.round((score / MAX_SCORE) * 100),
        reasons: reasons.slice(0, 3),
    };
}

function describeStyles(styles: StylePreference[]): string {
    if (styles.length === 1) return `${styles[0]} styling`;
    if (styles.length === 2) return `${styles[0]} + ${styles[1]}`;
    return `${styles[0]} + ${styles.length - 1} more styles`;
}

/**
 * Stable tie-break. Uses a simple deterministic hash of the outfit id so equal
 * scores never reorder between renders or between test runs.
 */
export function stableHash(value: string): number {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

/** Comparator for ranked results: score desc, then stable hash asc. */
export function compareRanked(
    a: { score: number; outfit: Outfit },
    b: { score: number; outfit: Outfit },
): number {
    if (b.score !== a.score) return b.score - a.score;
    return stableHash(a.outfit.id) - stableHash(b.outfit.id);
}

/** Debug helper retained for engine tests. */
export function describeFilters(occasion: Occasion, dressCode: DressCode): string {
    return `occasion=${occasion}; dressCode=${dressCode}`;
}
