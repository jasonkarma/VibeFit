import rawCatalog from './catalog.json';
import { catalogSchema, validateCatalogIntegrity, type CatalogInput } from './catalog.schema';
import type { Catalog, Product } from '@/types/domain';

/**
 * Loads and validates the curated catalog once at module scope.
 *
 * Validation is not decorative: a malformed seed row would otherwise surface as
 * a silently empty results screen during the demo. Failing loudly at import is
 * the correct trade.
 */
function loadCatalog(): Catalog {
    const parsed = catalogSchema.safeParse(rawCatalog);

    if (!parsed.success) {
        const detail = parsed.error.issues
            .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
            .join('; ');
        throw new Error(`Invalid catalog.json — ${detail}`);
    }

    const problems = validateCatalogIntegrity(parsed.data as CatalogInput);
    if (problems.length > 0) {
        throw new Error(`Catalog integrity failed — ${problems.join(' ')}`);
    }

    return parsed.data as Catalog;
}

export const catalog: Catalog = loadCatalog();

/** O(1) product lookup, built once. */
export const productsById: ReadonlyMap<string, Product> = new Map(
    catalog.products.map((product) => [product.id, product]),
);

export function getProduct(id: string): Product | undefined {
    return productsById.get(id);
}

/**
 * Sum of known item prices.
 *
 * Items with `price: null` are excluded rather than treated as zero — the
 * difference matters, because a $0 substitute would let an outfit appear to fit
 * a budget it may not actually fit. `priceComplete` records the uncertainty.
 */
export function outfitPricing(items: Product[]): {
    knownTotal: number;
    priceComplete: boolean;
    unknownPriceCount: number;
} {
    let knownTotal = 0;
    let unknownPriceCount = 0;

    for (const item of items) {
        if (item.price === null) {
            unknownPriceCount += 1;
        } else {
            knownTotal += item.price;
        }
    }

    return {
        knownTotal: Math.round(knownTotal * 100) / 100,
        priceComplete: unknownPriceCount === 0,
        unknownPriceCount,
    };
}

/** Whether an outfit includes one of the five AR-supported garments. */
export function outfitHasArSupport(items: Product[]): boolean {
    return items.some((item) => item.arSupported);
}
