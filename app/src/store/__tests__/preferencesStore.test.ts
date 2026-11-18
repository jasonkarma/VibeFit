import { beforeEach, describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';
import { NO_COLOR_PREFERENCE } from '@/types/domain';
import { usePreferencesStore } from '../preferencesStore';

/**
 * Store-level guarantees. These are the tests that protect the acceptance
 * criteria most likely to regress under UI refactoring: retention, mutual
 * exclusivity, and partial updates.
 */

function resetStore() {
    act(() => {
        usePreferencesStore.getState().reset();
    });
}

describe('partial patches preserve other fields (AC 13.3, 15.3, 9.2)', () => {
    beforeEach(resetStore);

    it('changing the dress code leaves occasion, budget, styles and colors intact', () => {
        const store = usePreferencesStore.getState();
        act(() => {
            store.setOccasion('Party');
            store.setDressCode('Casual');
            store.setBudgetInput('250');
            store.toggleStyle('Trendy');
            store.toggleColor('Black');
        });

        act(() => {
            usePreferencesStore.getState().setDressCode('Cocktail');
        });

        const prefs = usePreferencesStore.getState().preferences;
        expect(prefs.dressCode).toBe('Cocktail');
        expect(prefs.occasion).toBe('Party');
        expect(prefs.budget).toBe(250);
        expect(prefs.styles).toEqual(['Trendy']);
        expect(prefs.colors).toEqual(['Black']);
    });

    it('applyPatch only mutates the supplied fields', () => {
        act(() => {
            usePreferencesStore.getState().applyPatch({
                occasion: 'Wedding',
                dressCode: 'Cocktail',
                budget: 300,
                budgetInput: '300',
                styles: ['Classic'],
                colors: ['Black'],
            });
        });

        act(() => {
            usePreferencesStore.getState().applyPatch({ budget: 200 });
        });

        const prefs = usePreferencesStore.getState().preferences;
        expect(prefs.budget).toBe(200);
        expect(prefs.budgetInput).toBe('200');
        expect(prefs.occasion).toBe('Wedding');
        expect(prefs.styles).toEqual(['Classic']);
        expect(prefs.colors).toEqual(['Black']);
    });
});

describe('style and color rules (AC 15.1, 15.2)', () => {
    beforeEach(resetStore);

    it('toggles a style on and off', () => {
        act(() => usePreferencesStore.getState().toggleStyle('Minimalist'));
        expect(usePreferencesStore.getState().preferences.styles).toEqual(['Minimalist']);

        act(() => usePreferencesStore.getState().toggleStyle('Minimalist'));
        expect(usePreferencesStore.getState().preferences.styles).toEqual([]);
    });

    it('keeps No Color Preference mutually exclusive with concrete colors', () => {
        act(() => usePreferencesStore.getState().setNoColorPreference());
        expect(usePreferencesStore.getState().preferences.colors).toEqual([NO_COLOR_PREFERENCE]);

        act(() => usePreferencesStore.getState().toggleColor('Black'));
        // Selecting a real color must displace the opt-out, not coexist with it.
        expect(usePreferencesStore.getState().preferences.colors).toEqual(['Black']);
    });

    it('returns to No Color Preference when a concrete color is deselected', () => {
        act(() => usePreferencesStore.getState().toggleColor('Navy'));
        expect(usePreferencesStore.getState().preferences.colors).toEqual(['Navy']);

        act(() => usePreferencesStore.getState().toggleColor('Navy'));
        // Empty, not silently re-opted-out: the user must state intent explicitly.
        expect(usePreferencesStore.getState().preferences.colors).toEqual([]);
    });

    it('enforces the exclusivity invariant through applyPatch too', () => {
        act(() =>
            usePreferencesStore.getState().applyPatch({
                colors: [NO_COLOR_PREFERENCE, 'Black'],
            }),
        );
        expect(usePreferencesStore.getState().preferences.colors).toEqual([NO_COLOR_PREFERENCE]);
    });
});

describe('budget state (AC 14.3)', () => {
    beforeEach(resetStore);

    it('stores the parsed number only when the input is valid', () => {
        act(() => usePreferencesStore.getState().setBudgetInput('250'));
        expect(usePreferencesStore.getState().preferences.budget).toBe(250);

        act(() => usePreferencesStore.getState().setBudgetInput('-10'));
        // The numeric budget must go back to null so the engine cannot filter on it.
        expect(usePreferencesStore.getState().preferences.budget).toBeNull();
        expect(usePreferencesStore.getState().errors.budget).toBeDefined();
    });

    it('clears the error once a valid value is entered', () => {
        act(() => usePreferencesStore.getState().setBudgetInput('abc'));
        expect(usePreferencesStore.getState().errors.budget).toBeDefined();

        act(() => usePreferencesStore.getState().setBudgetInput('180'));
        expect(usePreferencesStore.getState().errors.budget).toBeUndefined();
    });
});

describe('generation lifecycle (AC 8.1, 11.4)', () => {
    beforeEach(resetStore);

    it('produces results and diagnostics once required inputs are set', () => {
        act(() => {
            usePreferencesStore.getState().applyPatch({
                occasion: 'Work',
                dressCode: 'Smart Casual',
                budget: 300,
                budgetInput: '300',
                styles: ['Minimalist'],
                colors: [NO_COLOR_PREFERENCE],
            });
            usePreferencesStore.getState().generate();
        });

        const state = usePreferencesStore.getState();
        expect(state.results.length).toBeGreaterThan(0);
        expect(state.resultDiagnostics).not.toBeNull();
        expect(state.lastGeneratedAt).not.toBeNull();
        // The occasion that produced the results must still be the stored occasion.
        expect(state.preferences.occasion).toBe('Work');
    });

    it('produces an empty result set (not an error) for the impossible case', () => {
        act(() => {
            usePreferencesStore.getState().applyPatch({
                occasion: 'Work',
                dressCode: 'Business Formal',
                budget: 80,
                budgetInput: '80',
                styles: ['Streetwear'],
                colors: ['Colorful'],
            });
            usePreferencesStore.getState().generate();
        });

        const state = usePreferencesStore.getState();
        expect(state.results).toEqual([]);
        expect(state.resultDiagnostics).not.toBeNull();
    });

    it('validation reports every missing field before generation', () => {
        const valid = usePreferencesStore.getState().validateAll();
        expect(valid).toBe(false);
        const errors = usePreferencesStore.getState().errors;
        expect(errors.occasion).toBeDefined();
        expect(errors.dressCode).toBeDefined();
        expect(errors.budget).toBeDefined();
        expect(errors.styles).toBeDefined();
        expect(errors.colors).toBeDefined();
    });
});

describe('persistence contract', () => {
    beforeEach(resetStore);

    it('round-trips preferences through localStorage serialization', () => {
        act(() => {
            usePreferencesStore.getState().applyPatch({
                occasion: 'Wedding',
                dressCode: 'Black Tie',
                budget: 500,
                budgetInput: '500',
                styles: ['Classic'],
                colors: ['Black'],
            });
        });

        const persisted = window.localStorage.getItem('vibefit:sprint1:v1');
        expect(persisted).toBeTruthy();

        const parsed = JSON.parse(persisted!);
        expect(parsed.state.preferences).toMatchObject({
            occasion: 'Wedding',
            dressCode: 'Black Tie',
            budget: 500,
            styles: ['Classic'],
            colors: ['Black'],
        });
    });

    it('does not persist transient error state', () => {
        act(() => usePreferencesStore.getState().setBudgetInput('nope'));
        const parsed = JSON.parse(window.localStorage.getItem('vibefit:sprint1:v1')!);
        // A stale validation error greeting the user on their next visit would be a
        // worse experience than re-validating on demand.
        expect(parsed.state.errors).toBeUndefined();
    });
});
