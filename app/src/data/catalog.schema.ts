import { z } from 'zod';
import {
    COLOR_OPTIONS,
    DRESS_CODES,
    GARMENT_DEPARTMENTS,
    OCCASIONS,
    RETAILERS,
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
const departmentSchema = z.enum(GARMENT_DEPARTMENTS);

export const productSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    retailer: z.string().min(1),
    slot: slotSchema,
    /** A garment belongs to exactly one department; `All` is never valid here. */
    department: departmentSchema,
    /** Deliberately nullable: unknown price must never be invented. */
    price: z.number().nonnegative().nullable(),
    productUrl: z.string().url().nullable(),
    productUrlVerifiedAt: z.string().date().optional(),
    retailerUrl: z.string().url().optional(),
    priceRetrievedAt: z.string().nullable(),
    colors: z.array(colorSchema).min(1),
    styles: z.array(styleSchema).min(1),
    image: z.string().nullable(),
    arSupported: z.boolean(),
    overlayAsset: z.string().nullable(),
    photoOverlayAsset: z.string().trim().min(1).optional(),
    photoOverlayOutline: z.array(z.tuple([
        z.number().min(0).max(100),
        z.number().min(0).max(100),
    ])).min(3).optional(),
    notes: z.string().optional(),
});

export const outfitSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    tagline: z.string().min(1),
    department: departmentSchema,
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

    /*
     * Retailer vocabulary check (Sprint 3).
     *
     * The retailer filter is a closed list: it drives the preference UI, the prompt
     * vocabulary handed to the model, and the validation of what the model returns.
     * A catalog row using a retailer outside that list would be permanently
     * invisible whenever the filter is active, and the model could never express
     * it — so this is a hard failure rather than a warning.
     */
    const knownRetailers = new Set<string>(RETAILERS);

    for (const product of input.products) {
        if (!knownRetailers.has(product.retailer)) {
            problems.push(
                `Product "${product.id}" uses retailer "${product.retailer}" which is not in RETAILERS.`,
            );
        }
    }

    for (const outfit of input.outfits) {
        const items = outfit.itemIds
            .map((id) => input.products.find((p) => p.id === id))
            .filter((product): product is NonNullable<typeof product> => Boolean(product));

        for (const itemId of outfit.itemIds) {
            if (!productIds.has(itemId)) {
                problems.push(`Outfit "${outfit.id}" references unknown product "${itemId}".`);
            }
        }

        // An outfit needs at least a top, a bottom, and shoes to be wearable.
        const slots = items.map((item) => item.slot);
        for (const required of ['top', 'bottom', 'shoes'] as const) {
            if (!slots.includes(required)) {
                problems.push(`Outfit "${outfit.id}" is missing a ${required}.`);
            }
        }

        /*
         * Department coherence.
         *
         * An outfit tagged Menswear that contains womenswear pieces would render a
         * detail page claiming one department while listing garments from another —
         * and, worse, would leak through the department filter. This is the check
         * that keeps that from ever shipping.
         */
        const mismatched = items.filter((item) => item.department !== outfit.department);
        if (mismatched.length > 0) {
            problems.push(
                `Outfit "${outfit.id}" is ${outfit.department} but contains ${mismatched
                    .map((item) => `${item.id} (${item.department})`)
                    .join(', ')}.`,
            );
        }
    }

    /*
     * Coverage check: the department filter must never be a dead end. Every
     * occasion needs at least one outfit in each department, or choosing a
     * department would strand the user with an empty result set that the relax
     * options cannot rescue honestly.
     */
    for (const department of GARMENT_DEPARTMENTS) {
        const inDepartment = input.outfits.filter((outfit) => outfit.department === department);
        if (inDepartment.length === 0) {
            problems.push(`No outfits exist for department "${department}".`);
            continue;
        }
        for (const occasion of OCCASIONS) {
            if (!inDepartment.some((outfit) => outfit.occasions.includes(occasion))) {
                problems.push(
                    `Department "${department}" has no outfit for occasion "${occasion}".`,
                );
            }
        }
    }

    return problems;
}
