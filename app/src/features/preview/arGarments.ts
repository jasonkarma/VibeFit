import type { Catalog, Product } from '@/types/domain';
import { catalog as defaultCatalog } from '@/data/catalog';

/**
 * The five AR-supported tops/jackets (Story 10 AC3).
 *
 * Derived from the catalog rather than hardcoded, so the catalog stays the single
 * source of truth. Sprint 1 already reserved `arSupported` and `overlayAsset` for
 * exactly this; the only thing that changed in Sprint 2 is that the assets now
 * exist.
 *
 * A garment qualifies only when all three hold:
 *   1. `arSupported` is true,
 *   2. it is a `top` or `layer` (a sleeve the user can see themselves in),
 *   3. it has a photo cutout or an illustrative overlay.
 *
 * Point 3 matters: an `arSupported` product with no assets would render an
 * empty overlay frame that looks like a bug. Filtering it out means the switcher
 * only ever offers garments that will visibly do something.
 */
export function arGarmentsFrom(catalog: Catalog): Product[] {
    return catalog.products.filter(
        (product) =>
            product.arSupported &&
            (product.slot === 'top' || product.slot === 'layer') &&
            Boolean(product.photoOverlayAsset?.trim() || product.overlayAsset?.trim()),
    );
}

/** Convenience binding against the loaded catalog. */
export const AR_GARMENTS: Product[] = arGarmentsFrom(defaultCatalog);

/** Number of catalog garments with a try-on asset. */
export const AR_GARMENT_TARGET_COUNT = 9;

/** Minimum supported garments per department. Guards the filter from a dead end. */
export const AR_GARMENTS_PER_DEPARTMENT_MIN = 1;

/**
 * Pick the garment to show first.
 *
 * Priority: the AR-capable garment the user is *already looking at*, because
 * opening a try-on that silently swaps to a different jacket is disorienting.
 * If the outfit has none, fall back to the first supported garment.
 */
export function defaultArGarment(items: Product[], available: Product[] = AR_GARMENTS): Product | null {
    const fromOutfit = items.find((item) =>
        available.some((candidate) => candidate.id === item.id),
    );
    if (fromOutfit) return fromOutfit;
    return available[0] ?? null;
}

/** True when this outfit contains a garment the AR tab can actually render. */
export function outfitSupportsAr(items: Product[], available: Product[] = AR_GARMENTS): boolean {
    return items.some((item) => available.some((candidate) => candidate.id === item.id));
}
