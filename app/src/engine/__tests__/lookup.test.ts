import { describe, expect, it } from 'vitest';
import { catalog, outfitPricing } from '@/data/catalog';
import { EMPTY_PREFERENCES, NO_COLOR_PREFERENCE, type UserPreferences } from '@/types/domain';
import { buildRankedOutfit, outfitWithItems, rankedOutfitById } from '../lookup';

/**
 * Deep-link resolution (decision D10).
 *
 * The detail and preview routes are URL-addressable, so they must resolve an outfit
 * without the cached result set. These tests pin the two failure modes that would
 * otherwise produce a blank page or a half-rendered outfit.
 */

const prefs: UserPreferences = {
    ...EMPTY_PREFERENCES,
    occasion: 'Work',
    dressCode: 'Business Formal',
    budget: 400,
    budgetInput: '400',
    styles: ['Classic'],
    colors: ['Navy'],
};

describe('rankedOutfitById', () => {
    it('resolves a known outfit into the same shape the results grid renders', () => {
        const entry = rankedOutfitById('o-08', prefs, catalog);

        expect(entry).not.toBeNull();
        expect(entry!.outfit.id).toBe('o-08');
        expect(entry!.outfit.name).toBe('Boardroom Standard');
        expect(entry!.items.length).toBeGreaterThanOrEqual(3);
        expect(entry!.reasons.length).toBeGreaterThan(0);
        expect(entry!.matchScore).toBeGreaterThanOrEqual(0);
        expect(entry!.matchScore).toBeLessThanOrEqual(100);
    });

    it('derives pricing identically to the shared catalog helper', () => {
        const entry = rankedOutfitById('o-08', prefs, catalog);
        const expected = outfitPricing(entry!.items);

        expect(entry!.knownTotal).toBe(expected.knownTotal);
        expect(entry!.priceComplete).toBe(expected.priceComplete);
    });

    it('returns null for an unknown outfit id instead of throwing', () => {
        // The page renders an explicit not-found card for this.
        expect(rankedOutfitById('o-does-not-exist', prefs, catalog)).toBeNull();
    });

    it('flags AR readiness from the garments, not from the outfit', () => {
        // o-08 contains the wool blazer, an AR-supported layer.
        const withAr = rankedOutfitById('o-08', prefs, catalog);
        expect(withAr!.arReady).toBe(true);

        // o-01 is tee + chino + sneakers: nothing AR-supported.
        const withoutAr = rankedOutfitById('o-01', prefs, catalog);
        expect(withoutAr!.arReady).toBe(false);
    });

    it('resolves even when the preferences would filter the outfit out of results', () => {
        // A Wedding/Black Tie brief cannot surface o-01, but a deep link to it must
        // still work — the score is information, not authorisation.
        const weddingPrefs: UserPreferences = {
            ...EMPTY_PREFERENCES,
            occasion: 'Wedding',
            dressCode: 'Black Tie',
            budget: 500,
            budgetInput: '500',
            styles: ['Classic'],
            colors: [NO_COLOR_PREFERENCE],
        };

        expect(rankedOutfitById('o-01', weddingPrefs, catalog)).not.toBeNull();
    });
});

describe('outfitWithItems', () => {
    it('returns the outfit with its products in authored order', () => {
        const resolved = outfitWithItems('o-08', catalog);
        expect(resolved).not.toBeNull();

        const expectedIds = catalog.outfits.find((outfit) => outfit.id === 'o-08')!.itemIds;
        expect(resolved!.items.map((item) => item.id)).toEqual(expectedIds);
    });

    it('returns null for a dangling item reference rather than a partial outfit', () => {
        // A corrupt catalog row must fail closed: half an outfit is not an outfit.
        const broken = {
            ...catalog,
            outfits: [
                {
                    ...catalog.outfits[0],
                    id: 'o-broken',
                    itemIds: [catalog.outfits[0].itemIds[0], 'p-missing-piece'],
                },
            ],
        };

        expect(outfitWithItems('o-broken', broken)).toBeNull();
        expect(rankedOutfitById('o-broken', prefs, broken)).toBeNull();
    });
});

describe('buildRankedOutfit', () => {
    it('produces a usable score for prefs that match nothing', () => {
        const outfit = catalog.outfits[0];
        const items = outfit.itemIds.map(
            (id) => catalog.products.find((product) => product.id === id)!,
        );

        const entry = buildRankedOutfit(outfit, items, EMPTY_PREFERENCES);
        // Total, never throwing: an empty preference set still yields a valid entry.
        expect(entry.outfit.id).toBe(outfit.id);
        expect(entry.matchScore).toBeGreaterThanOrEqual(0);
    });
});
