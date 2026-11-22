import { describe, expect, it } from 'vitest';
import { GARMENT_DEPARTMENTS } from '@/types/domain';
import { catalog } from '@/data/catalog';
import {
    AR_GARMENTS_PER_DEPARTMENT_MIN,
    AR_GARMENT_TARGET_COUNT,
    AR_GARMENTS,
    arGarmentsFrom,
    defaultArGarment,
    outfitSupportsAr,
} from '../arGarments';

/**
 * AR garment inventory invariants.
 *
 * Sprint 2 fixed this at "exactly five", all womenswear. Sprint 3 keeps those five
 * and adds two menswear pieces, because a department filter with no AR garment is a
 * dead end: a user who picks Menswear and opens a try-on would be offered womenswear
 * only. The invariants below express what actually matters now — a known count, and
 * at least one supported garment per department.
 */

describe('AR garment inventory', () => {
    it('contains exactly the expected number of supported tops and jackets', () => {
        expect(AR_GARMENTS).toHaveLength(AR_GARMENT_TARGET_COUNT);
    });

    it('offers at least one supported garment in every department', () => {
        // Without this, the department filter could strand a user in a try-on tab
        // that has nothing applicable to offer them.
        for (const department of GARMENT_DEPARTMENTS) {
            const inDepartment = AR_GARMENTS.filter(
                (garment) => garment.department === department,
            );
            expect(inDepartment.length).toBeGreaterThanOrEqual(
                AR_GARMENTS_PER_DEPARTMENT_MIN,
            );
        }
    });

    it('only offers top and layer slots, never trousers or shoes', () => {
        for (const garment of AR_GARMENTS) {
            expect(['top', 'layer']).toContain(garment.slot);
        }
    });

    it('gives every garment a real overlay asset', () => {
        for (const garment of AR_GARMENTS) {
            expect(garment.photoOverlayAsset ?? garment.overlayAsset).toMatch(/^\/(ar|catalog)\/.+/);
        }
    });

    it('matches the catalog exactly, with no duplicates', () => {
        const ids = AR_GARMENTS.map((garment) => garment.id);
        expect(new Set(ids).size).toBe(ids.length);

        const expected = catalog.products
            .filter((product) => product.arSupported && (product.overlayAsset || product.photoOverlayAsset))
            .map((product) => product.id);
        expect(ids.sort()).toEqual(expected.sort());
    });

    it('excludes a garment whose overlay asset is missing', () => {
        // An arSupported product with no asset would render an empty frame — that
        // looks exactly like a bug, so it must not reach the switcher.
        const broken = {
            ...catalog,
            products: catalog.products.map((product) =>
                product.id === 'p-cashmere' ? { ...product, overlayAsset: null, photoOverlayAsset: undefined } : product,
            ),
        };

        const garments = arGarmentsFrom(broken);
        expect(garments.map((garment) => garment.id)).not.toContain('p-cashmere');
        expect(garments).toHaveLength(AR_GARMENT_TARGET_COUNT - 1);
    });

    it('ignores arSupported on a non-top slot', () => {
        const broken = {
            ...catalog,
            products: catalog.products.map((product) =>
                product.id === 'p-sneakers'
                    ? { ...product, arSupported: true, overlayAsset: '/ar/sneaker.svg' }
                    : product,
            ),
        };

        const garments = arGarmentsFrom(broken);
        expect(garments.map((garment) => garment.id)).not.toContain('p-sneakers');
    });
});

describe('defaultArGarment', () => {
    it("prefers the outfit's own AR garment over an arbitrary one", () => {
        // o-08 contains the wool blazer.
        const outfit = catalog.outfits.find((entry) => entry.id === 'o-08')!;
        const items = outfit.itemIds.map(
            (id) => catalog.products.find((product) => product.id === id)!,
        );

        const selected = defaultArGarment(items);
        expect(selected?.id).toBe('p-wool-blazer');
    });

    it('falls back to the first supported garment when the outfit has none', () => {
        const outfit = catalog.outfits.find((entry) => entry.id === 'o-01')!;
        const items = outfit.itemIds.map(
            (id) => catalog.products.find((product) => product.id === id)!,
        );

        const selected = defaultArGarment(items);
        expect(selected?.id).toBe(AR_GARMENTS[0].id);
    });

    it('returns null when nothing is supported at all', () => {
        expect(defaultArGarment([], [])).toBeNull();
    });
});

describe('outfitSupportsAr', () => {
    it('is true only for outfits containing a supported garment', () => {
        const withAr = catalog.outfits
            .find((entry) => entry.id === 'o-08')!
            .itemIds.map((id) => catalog.products.find((product) => product.id === id)!);
        expect(outfitSupportsAr(withAr)).toBe(true);

        const withoutAr = catalog.outfits
            .find((entry) => entry.id === 'o-01')!
            .itemIds.map((id) => catalog.products.find((product) => product.id === id)!);
        expect(outfitSupportsAr(withoutAr)).toBe(false);
    });
});
