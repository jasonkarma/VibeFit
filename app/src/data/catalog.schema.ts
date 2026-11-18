import { z } from 'zod';
import {
    COLOR_OPTIONS,
    DRESS_CODES,
    OCCASIONS,
    SLOTS,
    STYLE_PREFERENCES,
} from '@/types/domain';

/**
 * Catalog validation. Runs at module load so a malformed seed row fails loudly
 * in development and in the test suite rather than rendering an empty screen.
 */

const occasionSchema = z.enum(OCCASIONS);
const dressCodeSchema = z.enum(DRESS_CODES);
const styleSchema = z.enum(STYLE_PREFERENCES);
const colorSchema = z.enum(COLOR_OPTIONS);
const slotSchema = z.enum(SLOTS);

export const productSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    retailer: z.string().min(1),
    slot: slotSchema,
    /** Deliberately nullable: unknown price must never be invented. */
    price: z.number().nonnegative().nullable(),
    /** Deliberately nullable: no valid page means no shop link. */
    productUrl: z.string().url().nullable(),
    priceRetrievedAt: z.string().nullable(),
    colors: z.array(colorSchema).min(1),
    styles: z.array(styleSchema).min(1),
    image: z.string().nullable(),
    arSupported: z.boolean(),
    overlayAsset: z.string().nullable(),
    notes: z.string().optional(),
});

export const outfitSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    tagline: z.string().min(1),
    occasions: z.array(occasionSchema).min(1),
    dressCodes: z.array(dressCodeSchema).min(1),
    styles: z.array(styleSchema).min(1),
    colors: z.array(colorSchema).min(1),
    itemIds: z.array(z.string()).min(3),
    heroImage: z.string().nullable(),
});

export const catalogSchema = z.object({
    version: z.string().min(1),
    priceRetrievedAt: z.string().min(1),
    products: z.array(productSchema).min(15),
    outfits: z.array(outfitSchema).min(10),
});

export type CatalogInput = z.input<typeof catalogSchema>;

/**
 * Structural checks the schema cannot express. Returns a list of problems so
 * the test suite can assert the seed data is demo-ready.
 */
export function validateCatalogIntegrity(input: CatalogInput): string[] {
    const problems: string[] = [];
    const productIds = new Set(input.products.map((p) => p.id));

    // Duplicate product ids would silently shadow each other in lookup maps.
    if (productIds.size !== input.products.length) {
        problems.push('Duplicate product ids found in catalog.');
    }

    const outfitIds = new Set(input.outfits.map((o) => o.id));
    if (outfitIds.size !== input.outfits.length) {
        problems.push('Duplicate outfit ids found in catalog.');
    }

    for (const outfit of input.outfits) {
        for (const itemId of outfit.itemIds) {
            if (!productIds.has(itemId)) {
                problems.push(`Outfit "${outfit.id}" references unknown product "${itemId}".`);
            }
        }
        // An outfit needs at least a top, a bottom, and shoes to be wearable.
        const slots = outfit.itemIds
            .map((id) => input.products.find((p) => p.id === id)?.slot)
            .filter(Boolean);
        for (const required of ['top', 'bottom', 'shoes'] as const) {
            if (!slots.includes(required)) {
                problems.push(`Outfit "${outfit.id}" is missing a ${required}.`);
            }
        }
    }

    return problems;
}
