import type {
    Catalog,
    FilterDiagnostics,
    Product,
    RankedOutfit,
    RecommendResult,
    UserPreferences,
} from '@/types/domain';
import { outfitHasArSupport, outfitPricing } from '@/data/catalog';
import { compareRanked, scoreOutfit } from './score';

/**
 * Recommendation engine — hybrid of hard structural filters and weighted
 * scoring.
 *
 * Filters run in a fixed order and each stage records how many outfits
 * survived. That diagnostic ladder is what lets the empty state explain *why*
 * nothing matched and propose a concrete fix, instead of shrugging.
 */

interface Candidate {
    outfit: Catalog['outfits'][number];
    items: Product[];
    knownTotal: number;
    priceComplete: boolean;
    score: number;
    matchScore: number;
    reasons: string[];
}

export interface RecommendOptions {
    limit?: number;
    /** Disable the "no two results share a top" rule. Used by relax counting. */
    skipDiversity?: boolean;
}

export function recommendOutfits(
    prefs: UserPreferences,
    catalog: Catalog,
    options: RecommendOptions = {},
): RecommendResult {
    const { limit = 6, skipDiversity = false } = options;

    const productMap = new Map(catalog.products.map((p) => [p.id, p]));
    const emptyDiagnostics: FilterDiagnostics = {
        occasion: 0,
        dressCode: 0,
        budget: 0,
        style: 0,
        color: 0,
        total: catalog.outfits.length,
    };

    // Without the required structural preferences there is nothing to recommend.
    if (!prefs.occasion || !prefs.dressCode) {
        return { outfits: [], diagnostics: emptyDiagnostics };
    }

    // Stage 1 — occasion.
    const byOccasion = catalog.outfits.filter((o) => o.occasions.includes(prefs.occasion!));

    // Stage 2 — dress code.
    const byDressCode = byOccasion.filter((o) => o.dressCodes.includes(prefs.dressCode!));

    // Stage 3 — budget. Unknown prices are excluded from the total, never guessed.
    const priced = byDressCode.map((outfit) => {
        const items = outfit.itemIds
            .map((id) => productMap.get(id))
            .filter((item): item is Product => Boolean(item));
        const pricing = outfitPricing(items);
        return { outfit, items, ...pricing };
    });

    const withinBudget = priced.filter(({ knownTotal, outfit }) => {
        // No budget supplied yet: treat as unconstrained rather than failing closed.
        if (prefs.budget === null || prefs.budget <= 0) return true;
        // An outfit with unknown prices cannot be *proven* within budget. We still
        // admit it when the known portion fits, and flag it as price-incomplete, so
        // the user sees the uncertainty instead of a silently dropped option.
        void outfit;
        return knownTotal <= prefs.budget;
    });

    // Stage 4 — style overlap. An empty style selection means "no constraint".
    const byStyle =
        prefs.styles.length === 0
            ? withinBudget
            : withinBudget.filter(({ outfit }) => outfit.styles.some((s) => prefs.styles.includes(s)));

    // Stage 5 — colour. "No Color Preference" short-circuits this filter entirely.
    const wantsColor = prefs.colors.length > 0 && !prefs.colors.includes('No Color Preference');
    const concreteColors = prefs.colors.filter((c) => c !== 'No Color Preference');

    const byColor = wantsColor
        ? byStyle.filter(({ outfit }) => outfit.colors.some((c) => concreteColors.includes(c as never)))
        : byStyle;

    const diagnostics: FilterDiagnostics = {
        occasion: byOccasion.length,
        dressCode: byDressCode.length,
        budget: withinBudget.length,
        style: byStyle.length,
        color: byColor.length,
        total: catalog.outfits.length,
    };

    const candidates: Candidate[] = byColor.map(({ outfit, items, knownTotal, priceComplete }) => {
        const scored = scoreOutfit({ outfit, knownTotal, priceComplete }, prefs);
        return { outfit, items, knownTotal, priceComplete, ...scored };
    });

    candidates.sort(compareRanked);

    const selected = skipDiversity ? candidates : applyDiversity(candidates, limit);

    return {
        outfits: selected.slice(0, limit).map(toRankedOutfit),
        diagnostics,
    };
}

/**
 * Diversity pass: no two recommendations may share the same top garment.
 *
 * Without this, a single popular tee anchors several ranked outfits and the
 * result grid looks like the same look repeated — which would undercut
 * acceptance criterion 8.3 ("each suggestion is identifiable as a distinct
 * outfit") in spirit even while satisfying it by id.
 */
function applyDiversity(candidates: Candidate[], limit: number): Candidate[] {
    const chosen: Candidate[] = [];
    const usedTops = new Set<string>();

    for (const candidate of candidates) {
        const top = candidate.items.find((item) => item.slot === 'top');
        const topKey = top?.id ?? candidate.outfit.id;
        if (usedTops.has(topKey)) continue;
        usedTops.add(topKey);
        chosen.push(candidate);
        if (chosen.length >= limit) break;
    }

    // If diversity starved the result set, top up from the remaining ranked list.
    if (chosen.length < limit) {
        for (const candidate of candidates) {
            if (chosen.includes(candidate)) continue;
            chosen.push(candidate);
            if (chosen.length >= limit) break;
        }
    }

    return chosen;
}

function toRankedOutfit(candidate: Candidate): RankedOutfit {
    return {
        outfit: candidate.outfit,
        items: candidate.items,
        knownTotal: candidate.knownTotal,
        priceComplete: candidate.priceComplete,
        matchScore: candidate.matchScore,
        reasons: candidate.reasons,
        arReady: outfitHasArSupport(candidate.items),
    };
}
