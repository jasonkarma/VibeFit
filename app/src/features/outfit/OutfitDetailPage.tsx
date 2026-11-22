import { motion } from 'framer-motion';
import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, TriangleAlert } from 'lucide-react';
import type { RankedOutfit } from '@/types/domain';
import { catalog } from '@/data/catalog';
import { rankedOutfitById } from '@/engine/lookup';
import { usePreferencesStore } from '@/store/preferencesStore';
import { PageTransition } from '@/components/ui/PageTransition';
import { MatchRing } from '@/components/ui/MatchRing';
import { BudgetMeter } from '@/components/ui/BudgetMeter';
import { useMotion } from '@/lib/motion';
import { formatUsdExact } from '@/lib/format';
import { cn } from '@/lib/cn';
import { summarisePricing, budgetVerdict, PRICE_UNAVAILABLE } from '@/lib/pricing';
import { outfitSupportsAr } from '@/features/preview/arGarments';
import { OutfitItemCard } from './OutfitItemCard';
import { RationalePanel } from './RationalePanel';

/**
 * Outfit detail (Story 6) with itemised pricing (Story 7) and shopping links
 * (Story 8), plus the entry point to preview and AR try-on (Story 10).
 *
 * Data resolution has two sources and prefers the cached one:
 *   1. The persisted result set — it carries the generation the user is looking at,
 *      so the score and reasons match the card they clicked.
 *   2. `rankedOutfitById` against the catalog — used for deep links, refreshes, and
 *      any navigation where the cache is cold.
 *
 * Both yield `RankedOutfit`, so nothing downstream knows or cares which was used.
 *
 * Back-navigation requirement (AC 6.4) is satisfied structurally rather than
 * cleverly: this page never calls `generate()`, and the store is the only owner of
 * results, so returning to `/results` shows the identical cached set. `ResultsPage`
 * has its own guard against re-generating on mount, which is where that guarantee
 * actually lives.
 */
export function OutfitDetailPage() {
    const { outfitId } = useParams<{ outfitId: string }>();
    const navigate = useNavigate();
    const { container, card } = useMotion();

    const preferences = usePreferencesStore((state) => state.preferences);
    const results = usePreferencesStore((state) => state.results);

    const hasRequiredInputs = Boolean(
        preferences.occasion && preferences.dressCode && preferences.budget,
    );

    useEffect(() => {
        if (!hasRequiredInputs) {
            navigate('/preferences', { replace: true });
        }
    }, [hasRequiredInputs, navigate]);

    /** Cached entry first, catalog fallback second. */
    const entry: RankedOutfit | null = useMemo(() => {
        if (!outfitId) return null;
        const cached = results.find((candidate) => candidate.outfit.id === outfitId);
        if (cached) return cached;
        return rankedOutfitById(outfitId, preferences, catalog);
    }, [outfitId, results, preferences]);

    const pricing = useMemo(() => summarisePricing(entry?.items ?? []), [entry]);

    if (!hasRequiredInputs) return null;

    if (!entry) {
        return (
            <PageTransition>
                <div className="py-16 text-center">
                    <TriangleAlert
                        className="mx-auto h-8 w-8 text-fit-tight"
                        aria-hidden="true"
                    />
                    <h1 className="mt-4 font-display text-3xl text-white">
                        We couldn&apos;t find that outfit
                    </h1>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-obsidian-400">
                        The link may be out of date, or the outfit is no longer in the collection.
                        Your other recommendations are still here.
                    </p>
                    <button
                        type="button"
                        onClick={() => navigate('/results')}
                        className="mt-6 inline-flex items-center gap-1.5 rounded-pill border border-champagne/40 bg-champagne/10 px-4 py-2 font-sans text-[0.8125rem] text-champagne transition-colors hover:bg-champagne/20"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                        Back to Recommendations
                    </button>
                </div>
            </PageTransition>
        );
    }

    const { outfit, items, matchScore, reasons, arReady } = entry;
    const budget = preferences.budget;
    const verdict =
        pricing.kind === 'complete' ? budgetVerdict(pricing.total, budget) : null;
    const canPreviewAr = arReady && outfitSupportsAr(items);

    return (
        <PageTransition>
            {/* Back to recommendations (AC 6.4) */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <button
                    type="button"
                    onClick={() => navigate('/results')}
                    className="inline-flex items-center gap-1.5 rounded-pill border border-white/10 bg-white/[0.03] px-4 py-2 font-sans text-[0.8125rem] text-obsidian-50 backdrop-blur-xl transition-colors hover:border-white/25 hover:text-white"
                >
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    Back to Recommendations
                </button>

                {canPreviewAr && (
                    <button
                        type="button"
                        onClick={() => navigate(`/results/${outfit.id}/preview`)}
                        className="inline-flex items-center gap-1.5 rounded-pill border border-violet/40 bg-violet/15 px-4 py-2 font-sans text-[0.8125rem] font-medium text-violet transition-colors hover:bg-violet/25 hover:text-white"
                    >
                        <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                        Preview &amp; AR Try-On
                    </button>
                )}
            </div>

            {/* Header (AC 6.2) */}
            <header className="mb-6 flex flex-wrap items-start justify-between gap-5">
                <div className="min-w-0">
                    <p className="font-data text-[0.625rem] uppercase tracking-[0.14em] text-obsidian-500">
                        {outfit.occasions.join(' · ')} · {outfit.dressCodes.join(' / ')}
                    </p>
                    <h1 className="mt-1.5 font-display text-4xl leading-tight text-white sm:text-5xl">
                        {outfit.name}
                    </h1>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-obsidian-400">
                        {outfit.tagline}
                    </p>
                    <p className="mt-3 font-data text-[0.625rem] uppercase tracking-[0.12em] text-obsidian-500">
                        {items.length} pieces · {outfit.styles.join(' · ')}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <MatchRing value={matchScore} size={64} />
                </div>
            </header>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_20rem]">
                {/* Itemised grid (AC 6.3, 7.1, 8b.1–2) */}
                <motion.ul
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
                    aria-label="Garments in this outfit"
                >
                    {items.map((product) => (
                        <motion.li key={product.id} variants={card} className="h-full">
                            <OutfitItemCard product={product} />
                        </motion.li>
                    ))}
                </motion.ul>

                {/* Sidebar: budget-fit breakdown (AC 6.2) + total (AC 7.2–7.3) */}
                <aside className="flex flex-col gap-4">
                    <section
                        aria-labelledby="outfit-total-heading"
                        className="rounded-surface border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl shadow-glass"
                    >
                        <h2
                            id="outfit-total-heading"
                            className="font-display text-lg leading-tight text-white"
                        >
                            {pricing.kind === 'complete'
                                ? 'Total Outfit Price'
                                : 'Known subtotal'}
                        </h2>

                        <p
                            className="mt-2 font-data text-3xl font-medium text-white"
                            data-testid="outfit-total"
                        >
                            {formatUsdExact(
                                pricing.kind === 'complete' ? pricing.total : pricing.knownTotal,
                            )}
                        </p>

                        {pricing.kind === 'partial' && (
                            <p
                                className="mt-1.5 text-[0.75rem] leading-relaxed text-fit-tight"
                                data-testid="partial-total-notice"
                            >
                                {pricing.missingCount === 1
                                    ? '1 item has no listed price — the total is a lower bound, not the full outfit cost.'
                                    : `${pricing.missingCount} items have no listed price — the total is a lower bound, not the full outfit cost.`}
                            </p>
                        )}

                        {pricing.kind === 'complete' ? (
                            <div className="mt-4">
                                <BudgetMeter
                                    total={pricing.total}
                                    budget={budget ?? 0}
                                    priceComplete
                                />
                                {verdict && (
                                    <p
                                        className={cn(
                                            'mt-2 font-data text-[0.6875rem]',
                                            verdict.status === 'within'
                                                ? 'text-fit-comfortable'
                                                : 'text-fit-over',
                                        )}
                                        data-testid="budget-verdict"
                                    >
                                        {verdict.label}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="mt-4">
                                <p className="text-[0.75rem] leading-relaxed text-obsidian-400">
                                    {PRICE_UNAVAILABLE} appears on the item above. A budget verdict
                                    is withheld because the outfit&apos;s real cost cannot be
                                    determined from the catalog.
                                </p>
                                {budget !== null && (
                                    <p className="mt-2 font-data text-[0.6875rem] text-obsidian-500">
                                        Your budget: {formatUsdExact(budget)}
                                    </p>
                                )}
                            </div>
                        )}

                        {outfit.colors.length > 0 && (
                            <p className="mt-4 font-data text-[0.5625rem] uppercase tracking-[0.1em] text-obsidian-500">
                                Palette · {outfit.colors.join(' · ')}
                            </p>
                        )}
                    </section>

                    <RationalePanel entry={entry} />
                </aside>
            </div>

            <p className="mt-8 text-center text-[0.6875rem] leading-relaxed text-obsidian-500">
                Sample catalog · prices retrieved {catalog.priceRetrievedAt} · visuals are
                illustrative prototypes, not product photography
            </p>
        </PageTransition>
    );
}
