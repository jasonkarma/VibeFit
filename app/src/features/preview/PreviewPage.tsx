import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Info, TriangleAlert } from 'lucide-react';
import type { RankedOutfit } from '@/types/domain';
import { catalog } from '@/data/catalog';
import { rankedOutfitById } from '@/engine/lookup';
import { usePreferencesStore } from '@/store/preferencesStore';
import { PageTransition } from '@/components/ui/PageTransition';
import { useMotion } from '@/lib/motion';
import { cn } from '@/lib/cn';
import { CombinedLook } from './CombinedLook';
import { ArTryOnTab } from './ArTryOnTab';
import { outfitSupportsAr } from './arGarments';

/** Required verbatim by Story 10 AC7. Do not paraphrase. */
export const FIT_DISCLAIMER =
    'Visual appearance preview only — does not guarantee exact sizing or fit.';

const TABS = [
    { id: 'combined', label: 'Combined look' },
    { id: 'ar', label: 'AR try-on' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/**
 * Dual-mode outfit preview (Story 10).
 *
 * A route rather than a modal (decision D7): deep-linkable, back-button correct,
 * and testable without focus-trap work. Closing returns to the outfit detail, which
 * is where the user came from.
 *
 * The disclaimer renders outside the tab panels, in the page footer, so it is
 * present in both tabs and cannot be lost by a refactor of either.
 */
export function PreviewPage() {
    const { outfitId } = useParams<{ outfitId: string }>();
    const navigate = useNavigate();

    const preferences = usePreferencesStore((state) => state.preferences);
    const results = usePreferencesStore((state) => state.results);

    const [tab, setTab] = useState<TabId>('combined');

    const hasRequiredInputs = Boolean(
        preferences.occasion && preferences.dressCode && preferences.budget,
    );

    useEffect(() => {
        if (!hasRequiredInputs) {
            navigate('/preferences', { replace: true });
        }
    }, [hasRequiredInputs, navigate]);

    const entry: RankedOutfit | null = useMemo(() => {
        if (!outfitId) return null;
        const cached = results.find((candidate) => candidate.outfit.id === outfitId);
        if (cached) return cached;
        return rankedOutfitById(outfitId, preferences, catalog);
    }, [outfitId, results, preferences]);

    const arAvailable = useMemo(
        () => (entry ? outfitSupportsAr(entry.items) : false),
        [entry],
    );

    // An outfit with no AR-capable piece cannot open the AR tab. Falling back to the
    // combined look keeps the route valid instead of showing an empty panel.
    const activeTab: TabId = tab === 'ar' && !arAvailable ? 'combined' : tab;

    if (!hasRequiredInputs) return null;

    if (!entry) {
        return (
            <PageTransition>
                <div className="py-16 text-center">
                    <TriangleAlert className="mx-auto h-8 w-8 text-fit-tight" aria-hidden="true" />
                    <h1 className="mt-4 font-display text-3xl text-white">
                        That outfit isn&apos;t available
                    </h1>
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

    const detailPath = `/results/${entry.outfit.id}`;

    return (
        <PageTransition>
            <div>
                <div className="mb-6">
                    <button
                        type="button"
                        onClick={() => navigate(detailPath)}
                        className="inline-flex items-center gap-1.5 rounded-pill border border-white/10 bg-white/[0.03] px-4 py-2 font-sans text-[0.8125rem] text-obsidian-50 backdrop-blur-xl transition-colors hover:border-white/25 hover:text-white"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                        Close preview
                    </button>
                </div>

                <header className="mb-5">
                    <p className="font-data text-[0.625rem] uppercase tracking-[0.14em] text-obsidian-500">
                        Preview
                    </p>
                    <h1 className="mt-1 font-display text-3xl leading-tight text-white sm:text-4xl">
                        {entry.outfit.name}
                    </h1>
                </header>

                {/* Tabs */}
                <div
                    role="tablist"
                    aria-label="Preview mode"
                    className="mb-5 flex gap-1 rounded-pill border border-white/10 bg-white/[0.03] p-1 backdrop-blur-xl"
                >
                    {TABS.map((definition) => {
                        const isActive = activeTab === definition.id;
                        const isDisabled = definition.id === 'ar' && !arAvailable;

                        return (
                            <button
                                key={definition.id}
                                type="button"
                                role="tab"
                                id={`preview-tab-${definition.id}`}
                                aria-selected={isActive}
                                aria-controls={`preview-panel-${definition.id}`}
                                disabled={isDisabled}
                                onClick={() => setTab(definition.id)}
                                title={
                                    isDisabled
                                        ? 'This outfit has no AR-supported top or jacket'
                                        : undefined
                                }
                                className={cn(
                                    'relative flex-1 rounded-pill px-4 py-2 font-sans text-[0.8125rem] transition-colors',
                                    isActive ? 'text-obsidian' : 'text-obsidian-400 hover:text-white',
                                    isDisabled && 'cursor-not-allowed opacity-40 hover:text-obsidian-400',
                                )}
                            >
                                {isActive && (
                                    <motion.span
                                        layoutId="preview-tab-indicator"
                                        className="absolute inset-0 rounded-pill bg-champagne"
                                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                                        aria-hidden="true"
                                    />
                                )}
                                <span className="relative font-medium">{definition.label}</span>
                            </button>
                        );
                    })}
                </div>

                {activeTab === 'combined' ? (
                    <div
                        role="tabpanel"
                        id="preview-panel-combined"
                        aria-labelledby="preview-tab-combined"
                    >
                        <CombinedLook entry={entry} />
                    </div>
                ) : (
                    <div role="tabpanel" id="preview-panel-ar" aria-labelledby="preview-tab-ar">
                        <ArTryOnTab items={entry.items} />
                    </div>
                )}

                {/* AC 10.7 — present in both tabs, outside the panels */}
                <footer
                    className="mt-8 flex items-start gap-2 rounded-surface border border-white/10 bg-white/[0.03] p-4"
                    data-testid="fit-disclaimer"
                >
                    <Info
                        className="mt-0.5 h-4 w-4 shrink-0 text-obsidian-400"
                        aria-hidden="true"
                    />
                    <p className="text-[0.8125rem] leading-relaxed text-obsidian-400">
                        {FIT_DISCLAIMER}
                    </p>
                </footer>
            </div>
        </PageTransition>
    );
}
