import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import type { RankedOutfit } from '@/types/domain';
import { catalog } from '@/data/catalog';
import { usePreferencesStore } from '@/store/preferencesStore';
import { computeRelaxOptions } from '@/engine/relax';
import { parsePreferencesWithAi } from '@/services/aiStylist';
import { PageTransition } from '@/components/ui/PageTransition';
import { StepIndicator } from '@/components/ui/StepIndicator';
import { ChatDock } from '@/features/chat/ChatDock';
import { useMotion } from '@/lib/motion';
import { formatUsd } from '@/lib/format';
import { OutfitCard } from './OutfitCard';
import { EmptyState } from './EmptyState';

/**
 * Recommendation results — Story 5 (generate) and the state foundation for
 * Story 9 (refine).
 *
 * The route guard redirects when required inputs are gone (a hard refresh before
 * generating, or a cleared store), so a user can never land on a results page
 * that has nothing to show and no explanation.
 */
export function ResultsPage() {
    const navigate = useNavigate();
    const { container } = useMotion();

    const preferences = usePreferencesStore((state) => state.preferences);
    const results = usePreferencesStore((state) => state.results);
    const diagnostics = usePreferencesStore((state) => state.resultDiagnostics);
    const lastGeneratedAt = usePreferencesStore((state) => state.lastGeneratedAt);
    const applyPatch = usePreferencesStore((state) => state.applyPatch);
    const generate = usePreferencesStore((state) => state.generate);
    const chatLog = usePreferencesStore((state) => state.chatLog);
    const pushChatTurn = usePreferencesStore((state) => state.pushChatTurn);
    const aiStatus = usePreferencesStore((state) => state.aiStatus);
    const aiReasons = usePreferencesStore((state) => state.aiReasons);
    const aiOrder = usePreferencesStore((state) => state.aiOrder);
    const enrichWithAi = usePreferencesStore((state) => state.enrichWithAi);

    const hasRequiredInputs = Boolean(
        preferences.occasion && preferences.dressCode && preferences.budget,
    );

    useEffect(() => {
        if (!hasRequiredInputs) {
            navigate('/preferences', { replace: true });
        }
    }, [hasRequiredInputs, navigate]);

    const relaxOptions = useMemo(
        () => computeRelaxOptions(preferences, catalog),
        [preferences],
    );

    /**
     * Preference signature. Changes whenever a preference that affects ranking
     * changes, and only then.
     */
    const preferenceSignature = [
        preferences.occasion,
        preferences.dressCode,
        preferences.budget,
        preferences.styles.join('|'),
        preferences.colors.join('|'),
        preferences.department,
        preferences.preferredRetailers.join('|'),
    ].join('::');

    /**
     * Remember the signature of the *previous* render.
     *
     * Why: this effect must fire when a preference changes (Story 9 AC3), but must
     * NOT fire on mount. Returning from an outfit detail page remounts this
     * component, and re-running `generate()` there would clear `aiReasons` and
     * `aiOrder` and bill a fresh live model call — for a result set the user never
     * asked to change. Story 6 AC4 requires the cached results to survive that round
     * trip, so the guard has to be real rather than relying on the engine happening
     * to be deterministic.
     *
     * A ref, not state: mutating it must not itself schedule a render.
     */
    const lastSignatureRef = useRef<string | null>(null);

    // A preference change made on the results screen (via chat) re-runs the engine
    // immediately, so the user sees the effect without pressing anything.
    useEffect(() => {
        if (lastGeneratedAt === null || !hasRequiredInputs) return;

        const previous = lastSignatureRef.current;
        lastSignatureRef.current = preferenceSignature;

        // First render after mount: record the signature, leave the cached results
        // exactly as they are.
        if (previous === null) return;
        if (previous === preferenceSignature) return;

        generate();
        // Keyed on the preference signature only; `generate` is stable.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [preferenceSignature, lastGeneratedAt, hasRequiredInputs]);

    /**
     * Ask the live model to rank and explain this result set.
     *
     * Keyed on `lastGeneratedAt`, not on results length: that value changes once
     * per generation, so this fires exactly once each time the engine produces a
     * new set. Keying on the results array would re-fire on every re-render and
     * bill the user for repeated identical calls.
     *
     * When unconfigured, offline, or in tests, `enrichWithAi` resolves without
     * changing anything and the badge stays "Local Engine".
     */
    useEffect(() => {
        if (lastGeneratedAt === null) return;
        if (results.length === 0) return;
        void enrichWithAi();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lastGeneratedAt]);

    /**
     * Display order: the model's ranking first, then anything it did not mention.
     * `aiOrder` only ever contains IDs from this result set (enforced in
     * `interpretRankResponse`), so this cannot drop or invent cards.
     */
    const orderedResults = useMemo(() => {
        if (aiOrder.length === 0) return results;
        const byId = new Map(results.map((entry) => [entry.outfit.id, entry]));
        const ordered = aiOrder
            .map((id) => byId.get(id))
            .filter((entry): entry is RankedOutfit => Boolean(entry));
        const remaining = results.filter((entry) => !aiOrder.includes(entry.outfit.id));
        return [...ordered, ...remaining];
    }, [results, aiOrder]);

    if (!hasRequiredInputs) return null;
    const budget = preferences.budget ?? 0;

    function handleApplyRelax(patch: Partial<typeof preferences>) {
        applyPatch(patch);
        generate();
    }

    /**
     * Open the outfit detail route (Story 6 AC1).
     *
     * Navigation only — no state change. The store keeps `results` and
     * `lastGeneratedAt` untouched so pressing "Back to Recommendations" restores the
     * exact grid, scores and AI reasons the user left (AC 6.4).
     */
    function handleOpenOutfit(entry: RankedOutfit) {
        navigate(`/results/${entry.outfit.id}`);
    }

    return (
        <PageTransition>
            <StepIndicator current={2} />

            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-display text-4xl leading-tight text-white sm:text-5xl">
                        {results.length > 0 ? 'Outfits for you' : 'No matching outfits'}
                    </h1>
                    <p className="mt-2 text-sm text-obsidian-400">
                        {preferences.occasion} · {preferences.dressCode} · {formatUsd(budget)} budget
                        {preferences.styles.length > 0 && ` · ${preferences.styles.join(', ')}`}
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => navigate('/preferences')}
                        className="inline-flex items-center gap-1.5 rounded-pill border border-white/10 bg-white/[0.03] px-4 py-2 font-sans text-[0.8125rem] text-obsidian-50 backdrop-blur-xl transition-colors hover:border-white/25 hover:text-white"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                        Edit preferences
                    </button>
                    <button
                        type="button"
                        onClick={generate}
                        className="inline-flex items-center gap-1.5 rounded-pill border border-champagne/40 bg-champagne/10 px-4 py-2 font-sans text-[0.8125rem] text-champagne transition-colors hover:bg-champagne/20"
                    >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        Regenerate
                    </button>
                </div>
            </div>

            {results.length === 0 ? (
                <EmptyState
                    relaxOptions={relaxOptions}
                    diagnostics={diagnostics}
                    onApplyRelax={handleApplyRelax}
                    onEditPreferences={() => navigate('/preferences')}
                />
            ) : (
                <>
                    <motion.ul
                        variants={container}
                        initial="hidden"
                        animate="show"
                        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                        aria-label="Recommended outfits"
                    >
                        {orderedResults.map((entry, index) => (
                            <li key={entry.outfit.id}>
                                <OutfitCard
                                    entry={entry}
                                    budget={budget}
                                    onOpen={handleOpenOutfit}
                                    index={index}
                                    aiReason={aiReasons[entry.outfit.id]}
                                />
                            </li>
                        ))}
                    </motion.ul>

                    <p className="mt-6 text-center text-[0.6875rem] text-obsidian-500">
                        Prices are snapshots. Each item shows its retrieval date and retailer link where available.
                    </p>
                </>
            )}

            <ChatDock
                initiallyOpen={false}
                preferences={preferences}
                onApplyPatch={applyPatch}
                chatLog={chatLog}
                onPushTurn={pushChatTurn}
                onParseWithAi={parsePreferencesWithAi}
                aiStatus={aiStatus}
            />
        </PageTransition>
    );
}
