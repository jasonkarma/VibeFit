import type { Catalog, RelaxOption, UserPreferences } from '@/types/domain';
import { DRESS_CODE_FORMALITY, DRESS_CODES, type DressCode } from '@/types/domain';
import { formatUsd } from '@/lib/format';
import { recommendOutfits } from './recommend';

/**
 * Empty-state recovery strategies.
 *
 * Acceptance criterion 8.4 requires a clear message rather than a broken
 * screen; criterion 9.4 requires a helpful message when no match is found. A
 * message alone still leaves the user stuck, so each strategy is computed
 * against the real engine and only offered when it actually yields results.
 *
 * Every option states its exact outcome ("Show 2 outfits with your budget raised
 * to $310") rather than a vague "try relaxing filters", which is what makes the
 * empty state trustworthy instead of decorative.
 *
 * IMPORTANT: single-field relaxations are not always sufficient. A user asking
 * for Business Formal streetwear under $80 fails on style, colour, and budget
 * simultaneously; offering only one-change options would produce an empty state
 * with zero buttons, which is exactly the broken screen the AC forbids. So the
 * ladder runs from surgical (one field) to progressive (several fields), and we
 * only surface options that genuinely work.
 */

/** Minimum budget we will ever propose; below this it is not a useful suggestion. */
const MIN_TARGET_BUDGET = 25;

interface Candidate extends RelaxOption {
    /** How much user intent this option discards. Lower is gentler. */
    disruption: number;
}

export function computeRelaxOptions(
    prefs: UserPreferences,
    catalog: Catalog,
    limit = 6,
): RelaxOption[] {
    if (!prefs.occasion || !prefs.dressCode) return [];

    const candidates: Candidate[] = [];
    const hasColorConstraint = wantsSpecificColor(prefs);
    const hasStyleConstraint = prefs.styles.length > 0;
    const hasRetailerConstraint = (prefs.preferredRetailers ?? []).length > 0;

    /*
     * --- Single-field relaxations ------------------------------------------------
     *
     * Retailer first, and with disruption 0.
     *
     * A shop preference is the least intimate thing a user tells us — it is a
     * convenience, not a taste — and it is also the constraint most likely to zero
     * out a result set, because it can narrow 35 outfits to two. If a user picks
     * Zara and sees nothing, the single most useful thing we can offer is "include
     * all retailers", and it should not be ranked below dropping their colour
     * preference or raising their budget.
     */
    if (hasRetailerConstraint) {
        candidates.push(
            buildCandidate(
                'include-all-retailers',
                'Include all retailers',
                (count) => `Show ${pluralize(count, 'outfit')} across every shop`,
                { preferredRetailers: [] },
                0,
                prefs,
                catalog,
                limit,
            ),
        );
    }

    if (hasColorConstraint) {
        candidates.push(
            buildCandidate(
                'drop-colors',
                'Ignore color preference',
                (count) => `Show ${pluralize(count, 'outfit')} in any palette`,
                { colors: ['No Color Preference'] },
                1,
                prefs,
                catalog,
                limit,
            ),
        );
    }

    if (hasStyleConstraint) {
        candidates.push(
            buildCandidate(
                'drop-styles',
                'Widen the style range',
                (count) => `Show ${pluralize(count, 'outfit')} across all styles`,
                { styles: [] },
                2,
                prefs,
                catalog,
                limit,
            ),
        );
    }

    // Dress code ladder: one step in either direction preserves the most intent.
    for (const candidate of adjacentDressCodes(prefs.dressCode)) {
        candidates.push(
            buildCandidate(
                `dresscode-${candidate}`,
                `Try ${candidate}`,
                (count) => `Show ${pluralize(count, 'outfit')} at ${candidate}`,
                { dressCode: candidate },
                3,
                prefs,
                catalog,
                limit,
            ),
        );
    }

    // A budget raise is the most intrusive single change, so it ranks last.
    const cheapest = cheapestMatchingTotal(prefs, catalog);
    if (cheapest !== null && (prefs.budget === null || cheapest > prefs.budget)) {
        const raised = Math.ceil(cheapest);
        candidates.push(
            buildCandidate(
                'raise-budget',
                `Raise budget to ${formatUsd(raised)}`,
                (count) => `Show ${pluralize(count, 'outfit')} at that budget`,
                { budget: raised, budgetInput: String(raised) },
                4,
                prefs,
                catalog,
                limit,
            ),
        );
    }

    // --- Progressive combinations -------------------------------------------------
    // Only computed when no single change works, so the common case stays simple.

    if (!candidates.some(isViable)) {
        const dropStyleAndColor: Partial<UserPreferences> = {
            styles: [],
            colors: ['No Color Preference'],
            // A retailer filter is the cheapest thing to drop in a combined fix too;
            // leaving it in place would make every progressive option below collapse
            // to zero results as well.
            preferredRetailers: [],
        };

        if (hasStyleConstraint || hasColorConstraint) {
            candidates.push(
                buildCandidate(
                    'drop-styles-and-colors',
                    'Drop style and color preferences',
                    (count) => `Show ${pluralize(count, 'outfit')} in any style and palette`,
                    dropStyleAndColor,
                    5,
                    prefs,
                    catalog,
                    limit,
                ),
            );
        }

        // Widen budget on top of the dropped preferences, using the cheapest total
        // that satisfies the loosened constraints.
        const loosened: UserPreferences = { ...prefs, ...dropStyleAndColor };
        const cheapestLoosened = cheapestMatchingTotal(loosened, catalog);
        if (cheapestLoosened !== null) {
            const raised = Math.ceil(cheapestLoosened);
            candidates.push(
                buildCandidate(
                    'widen-everything',
                    `Widen to ${formatUsd(raised)} and any style`,
                    (count) => `Show ${pluralize(count, 'outfit')} with the widest match`,
                    { ...dropStyleAndColor, budget: raised, budgetInput: String(raised) },
                    6,
                    prefs,
                    catalog,
                    limit,
                ),
            );
        }

        // Last resort: also step the dress code, which is the constraint users are
        // most often flexible about once they see nothing matches.
        for (const candidate of adjacentDressCodes(prefs.dressCode)) {
            const loosest: UserPreferences = {
                ...prefs,
                ...dropStyleAndColor,
                dressCode: candidate,
            };
            const cheapestLoose = cheapestMatchingTotal(loosest, catalog);
            if (cheapestLoose === null) continue;
            const raised = Math.ceil(cheapestLoose);
            candidates.push(
                buildCandidate(
                    `widest-${candidate}`,
                    `Try ${candidate} at ${formatUsd(raised)}`,
                    (count) => `Show ${pluralize(count, 'outfit')} with every filter relaxed`,
                    {
                        ...dropStyleAndColor,
                        dressCode: candidate,
                        budget: raised,
                        budgetInput: String(raised),
                    },
                    7,
                    prefs,
                    catalog,
                    limit,
                ),
            );
            break;
        }
    }

    const viable = candidates.filter(isViable);

    // Prefer surgical fixes: sort by disruption, then by how many results the
    // change unlocks (more results = more useful recovery).
    viable.sort((a, b) => {
        if (a.disruption !== b.disruption) return a.disruption - b.disruption;
        return b.resultCount - a.resultCount;
    });

    // De-duplicate by target patch shape so we never show two buttons that do the
    // same thing with different wording.
    const seen = new Set<string>();
    const unique: RelaxOption[] = [];
    for (const candidate of viable) {
        const key = JSON.stringify(candidate.patch);
        if (seen.has(key)) continue;
        seen.add(key);
        const { disruption: _disruption, ...option } = candidate;
        unique.push(option);
        if (unique.length >= 3) break;
    }

    return unique;
}

function buildCandidate(
    id: string,
    label: string,
    describe: (count: number) => string,
    patch: Partial<UserPreferences>,
    disruption: number,
    prefs: UserPreferences,
    catalog: Catalog,
    limit: number,
): Candidate {
    const resultCount = countMatches({ ...prefs, ...patch }, catalog);
    return {
        id,
        label,
        description: describe(resultCount),
        resultCount,
        patch,
        disruption,
    };
}

function isViable(candidate: Candidate): boolean {
    return candidate.resultCount > 0;
}

function wantsSpecificColor(prefs: UserPreferences): boolean {
    return prefs.colors.length > 0 && !prefs.colors.includes('No Color Preference');
}

/**
 * Count of distinct outfits a preference set would produce. Diversity is skipped
 * here because the question is "how many outfits exist", not "how many we would
 * display", and the top-slot rule would otherwise understate the answer.
 */
function countMatches(prefs: UserPreferences, catalog: Catalog): number {
    const result = recommendOutfits(prefs, catalog, { limit: 99, skipDiversity: true });
    return result.outfits.length;
}

/**
 * Cheapest known outfit total among outfits that pass everything except the
 * budget filter. Returns `null` when no outfit could ever match.
 */
function cheapestMatchingTotal(prefs: UserPreferences, catalog: Catalog): number | null {
    const unconstrainedBudget: UserPreferences = { ...prefs, budget: null, budgetInput: '' };
    const result = recommendOutfits(unconstrainedBudget, catalog, {
        limit: 99,
        skipDiversity: true,
    });

    if (result.outfits.length === 0) return null;

    const totals = result.outfits.map((entry) => entry.knownTotal).filter((total) => total > 0);
    if (totals.length === 0) return null;

    const cheapest = Math.min(...totals);
    return cheapest < MIN_TARGET_BUDGET ? MIN_TARGET_BUDGET : cheapest;
}

function adjacentDressCodes(dressCode: DressCode): DressCode[] {
    const index = DRESS_CODES.indexOf(dressCode);
    if (index === -1) return [];
    const below = DRESS_CODES[index - 1];
    const above = DRESS_CODES[index + 1];
    // Relaxing downward is usually cheaper and more likely to succeed, so it goes
    // first; upward is offered if downward yields nothing.
    return [below, above].filter(Boolean) as DressCode[];
}

function pluralize(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/** Exported for the empty-state tests: formality distance between two codes. */
export function formalityGap(a: DressCode, b: DressCode): number {
    return Math.abs(DRESS_CODE_FORMALITY[a] - DRESS_CODE_FORMALITY[b]);
}
