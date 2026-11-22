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
 *   3. it actually has an `overlayAsset`.
 *
 * Point 3 matters: an `arSupported` product with a missing asset would render an
 * empty overlay frame that looks like a bug. Filtering it out means the switcher
 * only ever offers garments that will visibly do something.
 */
export function arGarmentsFrom(catalog: Catalog): Product[] {
    return catalog.products.filter(
        (product) =>
            product.arSupported &&
            (product.slot === 'top' || product.slot === 'layer') &&
            typeof product.overlayAsset === 'string' &&
            product.overlayAsset.trim().length > 0,
    );
}

/** Convenience binding against the loaded catalog. */
export const AR_GARMENTS: Product[] = arGarmentsFrom(defaultCatalog);

/**
 * How many garments get an AR overlay.
 *
 * The Sprint 2 charter scope was **five** tops/jackets, all womenswear. Sprint 3's
 * department feature makes that a dead end for half the users: selecting Menswear
 * then opening a try-on would offer nothing but womenswear pieces.
 *
 * So the count is now 7 — the original five, plus the merino crew and unstructured
 * blazer — and it is expressed as a constant that the tests assert against rather
 * than a magic number scattered through the code. Every department must contribute
 * at least one supported garment; that is the invariant worth protecting, and it is
 * asserted in `arGarments.test.ts`.
 */
export const AR_GARMENT_TARGET_COUNT = 7;

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
