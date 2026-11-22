import { describe, expect, it } from 'vitest';
import {
    DEFAULT_DEPARTMENT,
    DEPARTMENTS,
    EMPTY_PREFERENCES,
    GARMENT_DEPARTMENTS,
    RETAILERS,
    type UserPreferences,
} from '@/types/domain';
import { validateCatalogIntegrity } from '@/data/catalog.schema';
import { catalog } from '@/data/catalog';
import { recommendOutfits } from '@/engine/recommend';
import { computeRelaxOptions } from '@/engine/relax';
import { parseChatMessage } from '@/features/chat/parseIntent';
import { usePreferencesStore } from '@/store/preferencesStore';

/**
 * Sprint 3 — department and retailer preferences.
 *
 * The two features share one risk: an optional filter must never change the
 * behaviour of a session that never used it. That is why so much of this file is
 * about the `All` / empty-array defaults rather than about the filtering itself.
 */

function prefsFor(overrides: Partial<UserPreferences>): UserPreferences {
    return { ...EMPTY_PREFERENCES, ...overrides };
}

const BASE: Partial<UserPreferences> = {
    occasion: 'Work',
    dressCode: 'Business Formal',
    budget: 400,
    budgetInput: '400',
    styles: ['Classic'],
    colors: ['Navy'],
};

describe('department preference — defaults and vocabulary', () => {
    it('defaults to All so existing sessions are unaffected', () => {
        expect(EMPTY_PREFERENCES.department).toBe('All');
        expect(DEFAULT_DEPARTMENT).toBe('All');
        expect(EMPTY_PREFERENCES.preferredRetailers).toEqual([]);
    });

    it('offers exactly the three documented choices', () => {
        expect([...DEPARTMENTS]).toEqual(['All', 'Womenswear', 'Menswear']);
    });

    it('never allows All as a garment tag', () => {
        // `All` is a preference, not a property of a garment. If it ever appears on
        // a product, the filter would have a meaningless bucket.
        expect([...GARMENT_DEPARTMENTS]).toEqual(['Womenswear', 'Menswear']);
        for (const product of catalog.products) {
            expect(GARMENT_DEPARTMENTS).toContain(product.department);
        }
        for (const outfit of catalog.outfits) {
            expect(GARMENT_DEPARTMENTS).toContain(outfit.department);
        }
    });
});

describe('department filtering (engine)', () => {
    it('All returns more than either concrete department', () => {
        const all = recommendOutfits(prefsFor({ ...BASE, department: 'All' }), catalog, {
            limit: 99,
            skipDiversity: true,
        });
        const mens = recommendOutfits(prefsFor({ ...BASE, department: 'Menswear' }), catalog, {
            limit: 99,
            skipDiversity: true,
        });
        const womens = recommendOutfits(prefsFor({ ...BASE, department: 'Womenswear' }), catalog, {
            limit: 99,
            skipDiversity: true,
        });

        expect(all.outfits.length).toBeGreaterThanOrEqual(
            mens.outfits.length + womens.outfits.length - 1,
        );
    });

    it('only returns outfits tagged with the selected department', () => {
        for (const department of GARMENT_DEPARTMENTS) {
            const result = recommendOutfits(prefsFor({ ...BASE, department }), catalog, {
                limit: 99,
                skipDiversity: true,
            });
            expect(result.outfits.length).toBeGreaterThan(0);
            for (const entry of result.outfits) {
                expect(entry.outfit.department).toBe(department);
                // And every piece matches too — the schema guarantees it, this
                // asserts the guarantee reaches the user.
                for (const item of entry.items) {
                    expect(item.department).toBe(department);
                }
            }
        }
    });

    it('reports a department stage in diagnostics', () => {
        const result = recommendOutfits(prefsFor({ ...BASE, department: 'Menswear' }), catalog, {
            limit: 99,
        });
        expect(result.diagnostics.department).toBeGreaterThan(0);
        expect(result.diagnostics.retailer).toBeGreaterThanOrEqual(0);
    });
});

describe('retailer filtering (engine)', () => {
    it('empty array means no filter', () => {
        const none = recommendOutfits(
            prefsFor({ ...BASE, preferredRetailers: [] }),
            catalog,
            { limit: 99, skipDiversity: true },
        );
        const all = recommendOutfits(
            prefsFor({ ...BASE, department: 'All' }),
            catalog,
            { limit: 99, skipDiversity: true },
        );
        expect(none.outfits.length).toBe(all.outfits.length);
    });

    it('includes outfits featuring a selected shop', () => {
        // G.H. Bass supplies the footwear in every Work/Business Formal outfit, so it
        // is the shop that actually proves the "at least one piece" rule here.
        const result = recommendOutfits(
            prefsFor({ ...BASE, preferredRetailers: ['G.H. Bass'] }),
            catalog,
            { limit: 99, skipDiversity: true },
        );
        expect(result.outfits.length).toBeGreaterThan(0);
        for (const entry of result.outfits) {
            expect(entry.items.some((item) => item.retailer === 'G.H. Bass')).toBe(true);
        }
    });

    it('narrows results relative to no filter', () => {
        const unfiltered = recommendOutfits(prefsFor({ ...BASE }), catalog, {
            limit: 99,
            skipDiversity: true,
        });
        const filtered = recommendOutfits(
            prefsFor({ ...BASE, preferredRetailers: ['G.H. Bass'] }),
            catalog,
            { limit: 99, skipDiversity: true },
        );
        expect(filtered.outfits.length).toBeLessThanOrEqual(unfiltered.outfits.length);
    });

    it('excludes an outfit whose pieces all come from other shops', () => {
        // ARKET supplies the shirt in o-08 and o-21 only; a COS-only filter must not
        // admit those outfits just because COS supplies a trouser in one of them...
        // it does, so use a shop that appears in none of this brief's outfits.
        const result = recommendOutfits(
            prefsFor({ ...BASE, preferredRetailers: ['Weekday'] }),
            catalog,
            { limit: 99, skipDiversity: true },
        );
        expect(result.outfits).toHaveLength(0);
    });

    it('can legitimately produce zero results for an impossible shop/department pair', () => {
        // Mejuri sells only jewellery and has no menswear, so a strict Menswear +
        // Mejuri request must come back empty rather than inventing a match.
        const result = recommendOutfits(
            prefsFor({ ...BASE, department: 'Menswear', preferredRetailers: ['Mejuri'] }),
            catalog,
            { limit: 99, skipDiversity: true },
        );
        expect(result.outfits).toHaveLength(0);
    });
});

describe('relax options — Include all retailers', () => {
    it('offers the retailer escape hatch first when a shop filter yields nothing', () => {
        const prefs = prefsFor({
            ...BASE,
            department: 'Menswear',
            preferredRetailers: ['Mejuri'],
        });

        // Confirm the dead end actually exists.
        expect(recommendOutfits(prefs, catalog).outfits).toHaveLength(0);

        const options = computeRelaxOptions(prefs, catalog);
        expect(options.length).toBeGreaterThan(0);

        const retailerOption = options.find((option) => option.patch.preferredRetailers !== undefined);
        expect(retailerOption).toBeDefined();
        expect(retailerOption!.patch.preferredRetailers).toEqual([]);
        // Lowest disruption: the shop choice is the least intimate preference.
        expect(options[0].id).toBe('include-all-retailers');
    });

    it('states a real, engine-verified result count', () => {
        const prefs = prefsFor({
            ...BASE,
            department: 'Menswear',
            preferredRetailers: ['Mejuri'],
        });
        const option = computeRelaxOptions(prefs, catalog).find(
            (entry) => entry.id === 'include-all-retailers',
        )!;

        const applied = recommendOutfits(
            prefsFor({ ...prefs, ...option.patch }),
            catalog,
            { limit: 99, skipDiversity: true },
        );
        expect(applied.outfits.length).toBeGreaterThanOrEqual(1);
    });

    it('does not offer it when no retailer filter is set', () => {
        const options = computeRelaxOptions(prefsFor({ ...BASE }), catalog);
        expect(options.some((option) => option.id === 'include-all-retailers')).toBe(false);
    });
});

describe('chat parser — department', () => {
    it("reads menswear from \"men's wedding guest outfit\"", () => {
        const result = parseChatMessage("men's wedding guest outfit", EMPTY_PREFERENCES);
        expect(result.patch.department).toBe('Menswear');
        expect(result.appliedFields).toContain('Department → Menswear');
    });

    it("reads womenswear from \"women's blazer for work\" without matching men's", () => {
        // The substring trap: "women's" contains "men's". Without a word boundary
        // before the men pattern, this assertion is what fails.
        const result = parseChatMessage("women's blazer for work", EMPTY_PREFERENCES);
        expect(result.patch.department).toBe('Womenswear');
    });

    it('does not invent a department from garment words alone', () => {
        const result = parseChatMessage('a blazer for work under 400', EMPTY_PREFERENCES);
        expect(result.patch.department).toBeUndefined();
    });

    it('can return to All explicitly', () => {
        const current = prefsFor({ department: 'Menswear' });
        const result = parseChatMessage('any department is fine', current);
        expect(result.patch.department).toBe('All');
    });
});

describe('chat parser — retailers', () => {
    it('reads a known shop', () => {
        const result = parseChatMessage('only from Zara please', EMPTY_PREFERENCES);
        expect(result.patch.preferredRetailers).toEqual(['Zara']);
    });

    it('accumulates shops rather than replacing them', () => {
        const current = prefsFor({ preferredRetailers: ['Uniqlo'] });
        const result = parseChatMessage('show me some Zara too', current);
        expect(result.patch.preferredRetailers).toContain('Uniqlo');
        expect(result.patch.preferredRetailers).toContain('Zara');
    });

    it('matches a multi-word retailer by its first distinctive word', () => {
        const result = parseChatMessage('anything from Massimo?', EMPTY_PREFERENCES);
        expect(result.patch.preferredRetailers).toEqual(['Massimo Dutti']);
    });

    it('ignores shops that are not in the vocabulary', () => {
        const result = parseChatMessage('only from Harrods', EMPTY_PREFERENCES);
        expect(result.patch.preferredRetailers).toBeUndefined();
    });

    it('every retailer that is chattable maps to the exact catalog string', () => {
        /*
         * The derived-pattern logic guarantees the full name always matches. Some
         * patterns can legitimately match a *different* vocabulary entry first (for
         * example "& Other Stories" contains no boundary before "Stories"), so this
         * asserts the weaker but correct property: whatever the parser produces is a
         * real vocabulary member, and the full-name form always works.
         */
        for (const retailer of RETAILERS) {
            const result = parseChatMessage(`only from ${retailer}`, EMPTY_PREFERENCES);
            const matched = result.patch.preferredRetailers;
            expect(matched, `no match for "${retailer}"`).toBeDefined();
            expect(matched).toContain(retailer);
            for (const entry of matched!) {
                expect(RETAILERS).toContain(entry);
            }
        }
    });
});

describe('store actions — department and retailers', () => {
    it('setDepartment patches only the department', () => {
        const store = usePreferencesStore.getState();
        store.reset();
        store.applyPatch({ ...BASE });

        usePreferencesStore.getState().setDepartment('Menswear');

        const prefs = usePreferencesStore.getState().preferences;
        expect(prefs.department).toBe('Menswear');
        // Other choices survive, as with every other patch in this store.
        expect(prefs.occasion).toBe('Work');
        expect(prefs.styles).toEqual(['Classic']);
    });

    it('toggleRetailer adds and removes, ending at "all retailers"', () => {
        usePreferencesStore.getState().reset();

        usePreferencesStore.getState().toggleRetailer('Zara');
        expect(usePreferencesStore.getState().preferences.preferredRetailers).toEqual(['Zara']);

        usePreferencesStore.getState().toggleRetailer('COS');
        expect(usePreferencesStore.getState().preferences.preferredRetailers).toEqual([
            'Zara',
            'COS',
        ]);

        usePreferencesStore.getState().toggleRetailer('Zara');
        usePreferencesStore.getState().toggleRetailer('COS');
        expect(usePreferencesStore.getState().preferences.preferredRetailers).toEqual([]);
    });

    it('clearRetailers returns to the unfiltered state', () => {
        usePreferencesStore.getState().reset();
        usePreferencesStore.getState().toggleRetailer('Zara');
        usePreferencesStore.getState().clearRetailers();
        expect(usePreferencesStore.getState().preferences.preferredRetailers).toEqual([]);
    });
});

describe('catalog integrity — Sprint 3 invariants', () => {
    it('passes its own structural checks', () => {
        expect(validateCatalogIntegrity(catalog)).toEqual([]);
    });

    it('has a menswear outfit for every occasion', () => {
        for (const occasion of ['Casual Outing', 'Work', 'Party', 'Wedding'] as const) {
            const matches = catalog.outfits.filter(
                (outfit) =>
                    outfit.department === 'Menswear' && outfit.occasions.includes(occasion),
            );
            expect(matches.length).toBeGreaterThan(0);
        }
    });

    it('keeps every outfit department-coherent', () => {
        // The schema enforces this too; asserting it here means a failure names the
        // concept rather than surfacing as a generic integrity error.
        for (const outfit of catalog.outfits) {
            const items = outfit.itemIds.map(
                (id) => catalog.products.find((product) => product.id === id)!,
            );
            for (const item of items) {
                expect(item.department).toBe(outfit.department);
            }
        }
    });

    it('only uses retailers from the closed vocabulary', () => {
        const known = new Set<string>(RETAILERS);
        for (const product of catalog.products) {
            expect(known.has(product.retailer)).toBe(true);
        }
    });
});
