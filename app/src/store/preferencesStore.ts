import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
    ChatTurn,
    ColorPreference,
    Department,
    DressCode,
    FilterDiagnostics,
    Occasion,
    PreferenceErrors,
    RankedOutfit,
    StylePreference,
    UserPreferences,
} from '@/types/domain';
import { DEFAULT_DEPARTMENT, EMPTY_PREFERENCES, NO_COLOR_PREFERENCE } from '@/types/domain';
import { catalog } from '@/data/catalog';
import { recommendOutfits } from '@/engine/recommend';
import { computeRelaxOptions } from '@/engine/relax';
import { validateBudget, validatePreferences, hasErrors } from '@/features/preferences/validation';
import { rankOutfitsWithAi, type AiStatus, getAiStatus } from '@/services/aiStylist';

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
    resultDiagnostics: FilterDiagnostics | null;
    lastGeneratedAt: number | null;
    chatLog: ChatTurn[];

    /**
     * Per-outfit narrative reasons from the live model, keyed by outfit id.
     * Empty when the local engine is in use, in which case cards fall back to the
     * engine's own deterministic reason chips.
     */
    aiReasons: Record<string, string>;
    /** Whether the last ranking call reached the live model. Drives the badge. */
    aiStatus: AiStatus;
    /** Outfits the model chose to surface first, in its order. */
    aiOrder: string[];

    // --- field patches ---
    setOccasion: (occasion: Occasion) => void;
    setDressCode: (dressCode: DressCode) => void;
    setBudgetInput: (raw: string) => void;
    toggleStyle: (style: StylePreference) => void;
    toggleColor: (color: ColorPreference) => void;
    setNoColorPreference: () => void;
    /** Sprint 3 — optional department; `All` clears the filter. */
    setDepartment: (department: Department) => void;
    /** Sprint 3 — optional retailer filter; empty means all retailers. */
    toggleRetailer: (retailer: string) => void;
    /** Sprint 3 — clear the retailer filter ("Include all retailers"). */
    clearRetailers: () => void;

    /** Apply a multi-field patch, used by the chat parser and relax buttons. */
    applyPatch: (patch: Partial<UserPreferences>) => void;

    // --- validation ---
    validateAll: () => boolean;
    clearError: (field: keyof PreferenceErrors) => void;

    // --- recommendation lifecycle ---
    generate: () => void;
    /** Regenerate in place after a preference change, if results already exist. */
    refreshIfGenerated: () => void;
    /** Ask the live model to rank/reason over the current results. Local-safe. */
    enrichWithAi: () => Promise<void>;
    reset: () => void;

    // --- chat ---
    pushChatTurn: (turn: ChatTurn) => void;
}

const STORAGE_KEY = 'vibefit:sprint1:v1';

/**
 * Persisted shape version.
 *
 * Bumped to 2 in Sprint 3 for `department` and `preferredRetailers`. The migration
 * below is what keeps an existing Sprint 1/2 browser session working: without it, a
 * returning user would hydrate a preferences object with the new fields missing,
 * and `preferences.department` would be `undefined` — silently failing the
 * department filter in a way no test would catch, because fresh state is always
 * correct.
 */
const PERSIST_VERSION = 2;

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
            aiReasons: {},
            aiStatus: getAiStatus(),
            aiOrder: [],

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

            /*
             * Sprint 3 department. Optional by design: `All` is a real choice that
             * means "don't narrow my results", not a missing value, so it clears the
             * field error the same way any other valid selection does.
             *
             * 'department' is not in `PreferenceErrors` as a *required* field —
             * validation never demands it — but it is listed so an error could be
             * cleared if a future rule ever adds one.
             */
            setDepartment: (department) =>
                set((state) => ({
                    preferences: { ...state.preferences, department },
                    errors: omit(state.errors, 'department'),
                })),

            /*
             * Retailer filter. Toggling the last retailer OFF must return to "all
             * retailers", which the empty array already means — so no special case
             * is needed, and no "select all" sentinel can drift out of sync with the
             * catalog the way a stored list of every retailer would.
             */
            toggleRetailer: (retailer) =>
                set((state) => {
                    const current = state.preferences.preferredRetailers;
                    const selected = current.includes(retailer);
                    const preferredRetailers = selected
                        ? current.filter((entry) => entry !== retailer)
                        : [...current, retailer];
                    return {
                        preferences: { ...state.preferences, preferredRetailers },
                        errors: omit(state.errors, 'preferredRetailers'),
                    };
                }),

            clearRetailers: () =>
                set((state) => ({
                    preferences: { ...state.preferences, preferredRetailers: [] },
                    errors: omit(state.errors, 'preferredRetailers'),
                })),

            applyPatch: (patch) =>
                set((state) => {
                    const next: UserPreferences = { ...state.preferences, ...patch };

                    // Guard the invariant at the store boundary, not just in the UI, so
                    // the chat parser cannot violate it either.
                    //
                    // Resolution rule: "No Color Preference" is an explicit opt-out and
                    // wins over concrete colors. If it is present at all, the patch means
                    // "I don't care about color", so the concrete entries are dropped
                    // rather than the opt-out — silently keeping colors while claiming no
                    // preference would misrepresent what the user asked for.
                    if (patch.colors && patch.colors.includes(NO_COLOR_PREFERENCE)) {
                        next.colors = [NO_COLOR_PREFERENCE];
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
                    // Reasons are derived from a specific result set. Keeping them
                    // after a regeneration would attach last generation's narrative
                    // to this generation's outfits — the worst kind of stale data,
                    // because it reads as though it were correct.
                    aiReasons: {},
                    aiOrder: [],
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
                    aiReasons: {},
                    aiOrder: [],
                });
            },

            enrichWithAi: async () => {
                const { results, preferences } = get();
                if (results.length === 0) return;

                // Returns null when unconfigured, in tests, offline, or when the
                // response fails validation. Each of those is a normal outcome and
                // simply leaves the engine's own deterministic reasons in place.
                const ranked = await rankOutfitsWithAi(preferences, results);

                if (ranked === null || ranked.size === 0) {
                    set({ aiStatus: 'local', aiReasons: {}, aiOrder: [] });
                    return;
                }

                const aiReasons: Record<string, string> = {};
                const aiOrder: string[] = [];
                for (const entry of results) {
                    const reason = ranked.get(entry.outfit.id);
                    if (reason) {
                        aiReasons[entry.outfit.id] = reason;
                        aiOrder.push(entry.outfit.id);
                    }
                }

                set({
                    aiReasons,
                    aiOrder,
                    // Only claim "Live" when at least one reason survived
                    // validation — the badge must never overstate what happened.
                    aiStatus: aiOrder.length > 0 ? 'live' : 'local',
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
                    aiReasons: {},
                    aiOrder: [],
                    aiStatus: getAiStatus(),
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
            version: PERSIST_VERSION,
            /**
             * Forward-migrate an older persisted payload.
             *
             * `persistedState` is typed `unknown` on purpose: trusting its shape is
             * exactly how a migration crashes for the users it exists to protect.
             * Each step fills in fields that did not exist yet and leaves every
             * choice the user already made untouched.
             */
            migrate: (persistedState: unknown, oldVersion: number) => {
                const state = (persistedState ?? {}) as {
                    preferences?: Partial<UserPreferences>;
                };

                if (oldVersion < 2) {
                    const preferences = state.preferences ?? {};
                    // Sessions created before Sprint 3 have no department. `All`
                    // reproduces their previous behaviour exactly, so their saved
                    // results stay valid.
                    preferences.department = preferences.department ?? DEFAULT_DEPARTMENT;
                    preferences.preferredRetailers = preferences.preferredRetailers ?? [];
                    state.preferences = preferences;
                }

                return state as unknown as PreferenceState;
            },
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
