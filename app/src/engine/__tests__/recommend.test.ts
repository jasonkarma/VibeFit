import { describe, expect, it } from 'vitest';
import { catalog } from '@/data/catalog';
import { TEST_SCENARIOS } from '@/data/testScenarios';
import { EMPTY_PREFERENCES, NO_COLOR_PREFERENCE, type UserPreferences } from '@/types/domain';
import { recommendOutfits } from '../recommend';
import { computeRelaxOptions } from '../relax';

function prefsFor(scenarioIndex: number): UserPreferences {
    const scenario = TEST_SCENARIOS[scenarioIndex];
    return {
        ...EMPTY_PREFERENCES,
        occasion: scenario.occasion,
        dressCode: scenario.dressCode,
        budget: scenario.budget,
        budgetInput: String(scenario.budget),
        styles: scenario.styles,
        colors: scenario.colors,
    };
}

describe('charter acceptance: 10 predefined scenarios', () => {
    const outcomes = TEST_SCENARIOS.map((scenario, index) => {
        const result = recommendOutfits(prefsFor(index), catalog);
        return { scenario, result };
    });

    it.each(outcomes.map((o, i) => [o.scenario.id, o.scenario.label, i] as const))(
        'scenario %i — %s',
        (_id, _label, index) => {
            const { scenario, result } = outcomes[index];
            expect(result.outfits.length).toBeGreaterThanOrEqual(scenario.expectsMinResults);

            for (const entry of result.outfits) {
                // Every suggestion must be structurally usable.
                expect(entry.items.length).toBeGreaterThanOrEqual(3);
                expect(entry.outfit.occasions).toContain(scenario.occasion);
                expect(entry.outfit.dressCodes).toContain(scenario.dressCode);
                if (scenario.styles.length > 0) {
                    expect(entry.outfit.styles.some((style) => scenario.styles.includes(style))).toBe(true);
                }

                // Budget AC: known total must never exceed the stated budget.
                expect(entry.knownTotal).toBeLessThanOrEqual(scenario.budget);

                // Explainability: every card carries at least one reason.
                expect(entry.reasons.length).toBeGreaterThan(0);
            }

            // Distinctness AC: no duplicate outfit ids in a result set.
            const ids = result.outfits.map((entry) => entry.outfit.id);
            expect(new Set(ids).size).toBe(ids.length);
        },
    );

    it('meets the charter bar of at least 8 of 10 scenarios', () => {
        const passing = outcomes.filter(
            ({ scenario, result }) => result.outfits.length >= scenario.expectsMinResults,
        );
        // Surfaced explicitly so a regression reports as a count, not a mystery.
        expect(passing.length).toBeGreaterThanOrEqual(8);
        expect(passing.length).toBe(TEST_SCENARIOS.length);
    });
});

describe('empty state contract (AC 8.4 / 9.4)', () => {
    it('scenario 5 yields no outfits', () => {
        const result = recommendOutfits(prefsFor(4), catalog);
        expect(result.outfits).toHaveLength(0);
    });

    it('offers actionable relax options with real result counts', () => {
        const options = computeRelaxOptions(prefsFor(4), catalog);
        expect(options.length).toBeGreaterThan(0);
        expect(options.length).toBeLessThanOrEqual(3);

        for (const option of options) {
            expect(option.resultCount).toBeGreaterThanOrEqual(1);
            // The advertised count must match what applying the patch actually does.
            const applied = recommendOutfits(
                { ...prefsFor(4), ...option.patch },
                catalog,
                { limit: 99, skipDiversity: true },
            );
            expect(applied.outfits.length).toBe(option.resultCount);
        }
    });

    it('never returns a broken shape when required inputs are missing', () => {
        const result = recommendOutfits({ ...EMPTY_PREFERENCES }, catalog);
        expect(result.outfits).toEqual([]);
        expect(result.diagnostics).not.toBeNull();
    });
});

describe('price integrity', () => {
    const unknownPriceProductId = 'p-linen-trouser';

    it('excludes unknown prices from totals instead of treating them as zero', () => {
        const prefs: UserPreferences = {
            ...EMPTY_PREFERENCES,
            occasion: 'Wedding',
            dressCode: 'Cocktail',
            budget: 400,
            budgetInput: '400',
            styles: ['Bohemian'],
            colors: [NO_COLOR_PREFERENCE],
        };
        const result = recommendOutfits(prefs, catalog, { limit: 99 });
        const withUnknown = result.outfits.find((entry) =>
            entry.items.some((item) => item.id === unknownPriceProductId),
        );

        expect(withUnknown).toBeDefined();
        expect(withUnknown!.priceComplete).toBe(false);

        const manualSum = withUnknown!.items
            .filter((item) => item.price !== null)
            .reduce((sum, item) => sum + (item.price ?? 0), 0);
        expect(withUnknown!.knownTotal).toBeCloseTo(manualSum, 2);
    });

    it('flags every outfit containing an unknown-priced item as incomplete', () => {
        const prefs: UserPreferences = {
            ...EMPTY_PREFERENCES,
            occasion: 'Wedding',
            dressCode: 'Cocktail',
            budget: 500,
            budgetInput: '500',
            styles: ['Bohemian'],
            colors: [NO_COLOR_PREFERENCE],
        };
        const result = recommendOutfits(prefs, catalog, { limit: 99 });
        for (const entry of result.outfits) {
            const hasUnknown = entry.items.some((item) => item.price === null);
            expect(entry.priceComplete).toBe(!hasUnknown);
        }
    });
});

describe('AR readiness (Sprint 2 dependency)', () => {
    it('marks only outfits containing an AR-supported garment', () => {
        const prefs: UserPreferences = {
            ...EMPTY_PREFERENCES,
            occasion: 'Work',
            dressCode: 'Smart Casual',
            budget: 300,
            budgetInput: '300',
            styles: ['Minimalist'],
            colors: [NO_COLOR_PREFERENCE],
        };
        const result = recommendOutfits(prefs, catalog, { limit: 99 });
        expect(result.outfits.length).toBeGreaterThan(0);
        for (const entry of result.outfits) {
            const hasAr = entry.items.some((item) => item.arSupported);
            expect(entry.arReady).toBe(hasAr);
        }
    });
});

describe('determinism', () => {
    it('produces identical ordering across repeated runs', () => {
        const prefs = prefsFor(8);
        const first = recommendOutfits(prefs, catalog).outfits.map((e) => e.outfit.id);
        const second = recommendOutfits(prefs, catalog).outfits.map((e) => e.outfit.id);
        expect(first).toEqual(second);
    });

    it('maximises top-garment variety within one result set', () => {
        // The diversity pass guarantees no repeated top *while distinct tops remain
        // available*. Repeating a top with a different bottom is legitimate styling,
        // so the invariant is "as varied as availability allows", not "always unique".
        const prefs = prefsFor(8);
        const result = recommendOutfits(prefs, catalog, { limit: 6 });

        const allCandidates = recommendOutfits(prefs, catalog, {
            limit: 99,
            skipDiversity: true,
        }).outfits;
        const availableTops = new Set(
            allCandidates.map((entry) => entry.items.find((item) => item.slot === 'top')?.id),
        );

        const returnedTops = new Set(
            result.outfits.map((entry) => entry.items.find((item) => item.slot === 'top')?.id),
        );

        expect(returnedTops.size).toBe(Math.min(availableTops.size, result.outfits.length));
    });

    it('keeps outfit identities unique even when a top repeats', () => {
        const prefs = prefsFor(8);
        const result = recommendOutfits(prefs, catalog, { limit: 6 });
        const ids = result.outfits.map((entry) => entry.outfit.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});
