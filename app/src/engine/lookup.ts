import type { Catalog, Outfit, Product, RankedOutfit, UserPreferences } from '@/types/domain';
import { outfitHasArSupport, outfitPricing } from '@/data/catalog';
import { scoreOutfit } from './score';

/**
 * Resolve a single outfit by id, shaped exactly like a result-grid entry.
 *
 * Why this exists: the detail route is deep-linkable (`/results/o-08`). If the
 * user refreshes, opens the URL in a new tab, or clears storage, the cached
 * result set is gone — but the outfit is a static catalog row, so a blank page
 * would be an unnecessary dead end. This rebuilds the same `RankedOutfit` the
 * engine would have produced.
 *
 * It deliberately does **not** re-run the recommendation pipeline. Filters must
 * not decide whether a deep link resolves: a user following a link to an outfit
 * they can see the name of should get that outfit, even if their current
 * preferences would now filter it out. Scoring is used only to populate the
 * match indicator and reasons, not to gate access.
 *
 * Returns `null` only for a genuinely unknown id, or an outfit whose item ids do
 * not resolve — the latter signals a corrupt catalog, and failing closed beats
 * rendering half an outfit.
 */
export function rankedOutfitById(
    outfitId: string,
    prefs: UserPreferences,
    catalog: Catalog,
): RankedOutfit | null {
    const outfit = catalog.outfits.find((entry) => entry.id === outfitId);
    if (!outfit) return null;

    const items = resolveItems(outfit, catalog);
    if (items === null) return null;

    return buildRankedOutfit(outfit, items, prefs);
}

/** Convenience for routes that only need the outfit row plus its products. */
export function outfitWithItems(
    outfitId: string,
    catalog: Catalog,
): { outfit: Outfit; items: Product[] } | null {
    const outfit = catalog.outfits.find((entry) => entry.id === outfitId);
    if (!outfit) return null;
    const items = resolveItems(outfit, catalog);
    if (items === null) return null;
    return { outfit, items };
}

/**
 * Map `itemIds` to products, preserving the catalog's declared order.
 *
 * Order matters: the detail view renders pieces top → layer → bottom → shoes →
 * accessory, and the authored order is already that, so sorting here would throw
 * away intent for no gain.
 *
 * Returns `null` if any id is dangling. A partial outfit is not a real outfit.
 */
function resolveItems(outfit: Outfit, catalog: Catalog): Product[] | null {
    const byId = new Map(catalog.products.map((product) => [product.id, product]));
    const items: Product[] = [];

    for (const itemId of outfit.itemIds) {
        const product = byId.get(itemId);
        if (!product) return null;
        items.push(product);
    }

    return items.length > 0 ? items : null;
}

/**
 * Assemble the `RankedOutfit` shape.
 *
 * `scoreOutfit` is total and pure, so a deep-linked outfit that the engine would
 * never have surfaced simply scores low rather than failing. That is the right
 * behaviour: the score is information, not authorisation.
 */
export function buildRankedOutfit(
    outfit: Outfit,
    items: Product[],
    prefs: UserPreferences,
): RankedOutfit {
    const pricing = outfitPricing(items);
    const scored = scoreOutfit(
        { outfit, knownTotal: pricing.knownTotal, priceComplete: pricing.priceComplete },
        prefs,
    );

    return {
        outfit,
        items,
        knownTotal: pricing.knownTotal,
        priceComplete: pricing.priceComplete,
        matchScore: scored.matchScore,
        reasons: scored.reasons,
        arReady: outfitHasArSupport(items),
    };
}
