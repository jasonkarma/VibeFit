import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
    ChatTurn,
    ColorPreference,
    DressCode,
    Occasion,
    PreferenceErrors,
    RankedOutfit,
    StylePreference,
    UserPreferences,
} from '@/types/domain';
import { EMPTY_PREFERENCES, NO_COLOR_PREFERENCE } from '@/types/domain';
import { catalog } from '@/data/catalog';
import { recommendOutfits } from '@/engine/recommend';
import { computeRelaxOptions } from '@/engine/relax';
import { validateBudget, validatePreferences, hasErrors } from '@/features/preferences/validation';

/**
 * Single source of truth for the whole Sprint 1 flow.
 *
 * Design constraint that drives everything here: **every mutation is a partial
 * patch**. No action ever replaces the whole `preferences` object with a
 * freshly constructed one, because "changing one preference must not clear the
 * other selections" (Story 9 AC2) and "preferences remain visible when the user
 * returns to edit them" (Story 15 AC3) both fail the moment a screen remounts
 * with a default object.
 */

export interface PreferenceState {
    preferences: UserPreferences;
    errors: PreferenceErrors;
    /** Errors are only revealed after a submit attempt or an explicit blur. */
    hasSubmitted: boolean;
    results: RankedOutfit[];
    resultDiagnostics: {
        occasion: number;
        dressCode: number;
        budget: number;
        style: number;
        color: number;
        total: number;
    } | null;
    lastGeneratedAt: number | null;
    chatLog: ChatTurn[];

    // --- field patches ---
    setOccasion: (occasion: Occasion) => void;
    setDressCode: (dressCode: DressCode) => void;
    setBudgetInput: (raw: string) => void;
    toggleStyle: (style: StylePreference) => void;
    toggleColor: (color: ColorPreference) => void;
    setNoColorPreference: () => void;

    /** Apply a multi-field patch, used by the chat parser and relax buttons. */
    applyPatch: (patch: Partial<UserPreferences>) => void;

    // --- validation ---
    validateAll: () => boolean;
    clearError: (field: keyof PreferenceErrors) => void;

    // --- recommendation lifecycle ---
    generate: () => void;
    /** Regenerate in place after a preference change, if results already exist. */
    refreshIfGenerated: () => void;
    reset: () => void;

    // --- chat ---
    pushChatTurn: (turn: ChatTurn) => void;
}

const STORAGE_KEY = 'vibefit:sprint1:v1';

export const usePreferencesStore = create<PreferenceState>()(
    persist(
        (set, get) => ({
            preferences: { ...EMPTY_PREFERENCES },
            errors: {},
            hasSubmitted: false,
            results: [],
            resultDiagnostics: null,
            lastGeneratedAt: null,
            chatLog: [],

            setOccasion: (occasion) =>
                set((state) => ({
                    preferences: { ...state.preferences, occasion },
                    // Selecting a value clears its error immediately — punishing the user
                    // with a stale message after they fixed it is the classic UX mistake.
                    errors: omit(state.errors, 'occasion'),
                })),

            setDressCode: (dressCode) =>
                set((state) => ({
                    preferences: { ...state.preferences, dressCode },
                    errors: omit(state.errors, 'dressCode'),
                })),

            setBudgetInput: (raw) =>
                set((state) => {
                    const validation = validateBudget(raw);
                    return {
                        preferences: {
                            ...state.preferences,
                            budgetInput: raw,
                            // Keep the numeric value in sync only when it is genuinely valid;
                            // otherwise `budget` must stay null so the engine never filters on
                            // a half-typed number.
                            budget: validation.ok ? validation.value : null,
                        },
                        errors: validation.ok
                            ? omit(state.errors, 'budget')
                            : { ...state.errors, budget: validation.error },
                    };
                }),

            toggleStyle: (style) =>
                set((state) => {
                    const selected = state.preferences.styles.includes(style);
                    const styles = selected
                        ? state.preferences.styles.filter((s) => s !== style)
                        : [...state.preferences.styles, style];
                    return {
                        preferences: { ...state.preferences, styles },
                        errors: styles.length > 0 ? omit(state.errors, 'styles') : state.errors,
                    };
                }),

            toggleColor: (color) =>
                set((state) => {
                    if (color === NO_COLOR_PREFERENCE) {
                        // "No Color Preference" is exclusive by definition (AC 15.2).
                        return {
                            preferences: { ...state.preferences, colors: [NO_COLOR_PREFERENCE] },
                            errors: omit(state.errors, 'colors'),
                        };
                    }

                    const concrete = state.preferences.colors.filter((c) => c !== NO_COLOR_PREFERENCE);
                    const selected = concrete.includes(color);
                    const next = selected
                        ? concrete.filter((c) => c !== color)
                        : [...concrete, color];

                    // Dropping the last concrete color must not silently re-select
                    // "No Color Preference" — that would misreport intent. Leave it empty
                    // and let validation ask.
                    return {
                        preferences: { ...state.preferences, colors: next },
                        errors: next.length > 0 ? omit(state.errors, 'colors') : state.errors,
                    };
                }),

            setNoColorPreference: () =>
                set((state) => ({
                    preferences: { ...state.preferences, colors: [NO_COLOR_PREFERENCE] },
                    errors: omit(state.errors, 'colors'),
                })),

            applyPatch: (patch) =>
                set((state) => {
                    const next: UserPreferences = { ...state.preferences, ...patch };

                    // Guard the invariant at the store boundary, not just in the UI, so
                    // the chat parser cannot violate it either.
                    if (patch.colors && patch.colors.length > 1 && patch.colors.includes(NO_COLOR_PREFERENCE)) {
                        next.colors = patch.colors.filter((c) => c !== NO_COLOR_PREFERENCE);
                    }

                    if (patch.budget !== undefined && patch.budgetInput === undefined) {
                        next.budgetInput = patch.budget === null ? '' : String(patch.budget);
                    }

                    const errors = { ...state.errors };
                    if (patch.occasion) delete errors.occasion;
                    if (patch.dressCode) delete errors.dressCode;
                    if (patch.styles && patch.styles.length > 0) delete errors.styles;
                    if (patch.colors && patch.colors.length > 0) delete errors.colors;
                    if (patch.budget !== undefined && patch.budget !== null) delete errors.budget;

                    return { preferences: next, errors };
                }),

            validateAll: () => {
                const errors = validatePreferences(get().preferences);
                set({ errors, hasSubmitted: true });
                return !hasErrors(errors);
            },

            clearError: (field) =>
                set((state) => ({ errors: omit(state.errors, field) })),

            generate: () => {
                const { preferences } = get();
                const result = recommendOutfits(preferences, catalog);
                set({
                    results: result.outfits,
                    resultDiagnostics: result.diagnostics,
                    lastGeneratedAt: Date.now(),
                    hasSubmitted: true,
                });
            },

            refreshIfGenerated: () => {
                const { lastGeneratedAt, preferences } = get();
                // Only refresh when the user has already seen results; otherwise
                // editing preferences would pre-empt their explicit "generate" action.
                if (lastGeneratedAt === null) return;
                const result = recommendOutfits(preferences, catalog);
                set({
                    results: result.outfits,
                    resultDiagnostics: result.diagnostics,
                    lastGeneratedAt: Date.now(),
                });
            },

            reset: () =>
                set({
                    preferences: { ...EMPTY_PREFERENCES },
                    errors: {},
                    hasSubmitted: false,
                    results: [],
                    resultDiagnostics: null,
                    lastGeneratedAt: null,
                    chatLog: [],
                }),

            pushChatTurn: (turn) =>
                set((state) => ({ chatLog: [...state.chatLog, turn].slice(-30) })),
        }),
        {
            name: STORAGE_KEY,
            storage: createJSONStorage(() => localStorage),
            // Only durable user intent is persisted. Transient UI state (errors,
            // submitted flags) is recomputed, so a stale error cannot greet the user
            // on their next visit.
            partialize: (state) => ({
                preferences: state.preferences,
                results: state.results,
                resultDiagnostics: state.resultDiagnostics,
                lastGeneratedAt: state.lastGeneratedAt,
                chatLog: state.chatLog,
            }),
            version: 1,
        },
    ),
);

function omit<K extends string, V>(
    record: Partial<Record<K, V>>,
    key: K,
): Partial<Record<K, V>> {
    if (!(key in record)) return record;
    const next = { ...record };
    delete next[key];
    return next;
}

/** Selector helpers kept outside the store to avoid re-render churn. */
export const selectPreferences = (state: PreferenceState) => state.preferences;
export const selectResults = (state: PreferenceState) => state.results;
export const selectIsReady =
    (state: PreferenceState) =>
        Boolean(state.preferences.occasion && state.preferences.dressCode && state.preferences.budget);

/**
 * Relax options for the current empty state. Computed on demand rather than
 * stored, because it is a pure function of preferences and the catalog.
 */
export function useRelaxOptions() {
    const preferences = usePreferencesStore(selectPreferences);
    return computeRelaxOptions(preferences, catalog);
}
