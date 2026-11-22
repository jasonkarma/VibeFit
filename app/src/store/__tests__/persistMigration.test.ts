import { beforeEach, describe, expect, it } from 'vitest';
import { usePreferencesStore } from '../preferencesStore';
import { DEFAULT_DEPARTMENT } from '@/types/domain';

/**
 * Persisted-state migration v1 → v2 (Sprint 3).
 *
 * The risk this guards is invisible in every other test: a returning user whose
 * browser holds a Sprint 1/2 payload has no `department` or `preferredRetailers`.
 * Without a migration, those read as `undefined` at runtime — the department filter
 * would compare `undefined === 'Womenswear'` and quietly return nothing, and no
 * fresh-state test would ever catch it because fresh state is always correct.
 */

const STORAGE_KEY = 'vibefit:sprint1:v1';

function writeLegacyPayload(payload: unknown) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

beforeEach(() => {
    window.localStorage.clear();
    usePreferencesStore.getState().reset();
});

describe('v1 → v2 persistence migration', () => {
    it('gives a legacy preferences payload the Sprint 3 fields on rehydrate', async () => {
        writeLegacyPayload({
            version: 1,
            state: {
                preferences: {
                    occasion: 'Wedding',
                    dressCode: 'Cocktail',
                    budgetInput: '250',
                    budget: 250,
                    styles: ['Bohemian'],
                    colors: ['No Color Preference'],
                    // deliberately absent: department, preferredRetailers
                },
                results: [],
                resultDiagnostics: null,
                lastGeneratedAt: null,
                chatLog: [],
            },
        });

        await usePreferencesStore.persist.rehydrate();

        const prefs = usePreferencesStore.getState().preferences;

        // Every prior choice survives untouched...
        expect(prefs.occasion).toBe('Wedding');
        expect(prefs.dressCode).toBe('Cocktail');
        expect(prefs.budget).toBe(250);
        expect(prefs.styles).toEqual(['Bohemian']);

        // ...and the new fields arrive with behaviour-preserving defaults.
        expect(prefs.department).toBe(DEFAULT_DEPARTMENT);
        expect(prefs.department).toBe('All');
        expect(prefs.preferredRetailers).toEqual([]);
    });

    it('never yields undefined for the new fields', async () => {
        writeLegacyPayload({ version: 1, state: { preferences: {} } });

        await usePreferencesStore.persist.rehydrate();

        const prefs = usePreferencesStore.getState().preferences;
        expect(prefs.department).not.toBeUndefined();
        expect(prefs.preferredRetailers).not.toBeUndefined();
        expect(Array.isArray(prefs.preferredRetailers)).toBe(true);
    });

    it('leaves a current-version payload alone', async () => {
        writeLegacyPayload({
            version: 2,
            state: {
                preferences: {
                    occasion: 'Party',
                    dressCode: 'Casual',
                    budgetInput: '200',
                    budget: 200,
                    styles: ['Trendy'],
                    colors: ['Black'],
                    department: 'Menswear',
                    preferredRetailers: ['Zara'],
                },
                results: [],
                resultDiagnostics: null,
                lastGeneratedAt: null,
                chatLog: [],
            },
        });

        await usePreferencesStore.persist.rehydrate();

        const prefs = usePreferencesStore.getState().preferences;
        // A deliberate choice must not be overwritten by the migration.
        expect(prefs.department).toBe('Menswear');
        expect(prefs.preferredRetailers).toEqual(['Zara']);
    });

    it('survives a corrupt payload without throwing', async () => {
        window.localStorage.setItem(STORAGE_KEY, '{"version":1,"state":null}');

        // Rehydration of junk should be tolerated; the app must still be usable.
        await expect(usePreferencesStore.persist.rehydrate()).resolves.not.toThrow();
        expect(usePreferencesStore.getState().preferences.department).toBeDefined();
    });
});
