import { motion } from 'framer-motion';
import { ArrowRight, Compass } from 'lucide-react';
import type { FilterDiagnostics, RelaxOption } from '@/types/domain';
import { useMotion } from '@/lib/motion';

interface EmptyStateProps {
    relaxOptions: RelaxOption[];
    diagnostics: FilterDiagnostics | null;
    onApplyRelax: (patch: RelaxOption['patch']) => void;
    onEditPreferences: () => void;
}

/**
 * What the user sees when nothing matches.
 *
 * Acceptance criterion 8.4 forbids a blank or broken screen; criterion 9.4
 * requires a helpful message. A message alone still strands the user, so the
 * primary content here is a set of computed escape hatches.
 *
 * Design note: no red, no warning icon, no "Error" headline. A constraint
 * conflict is a styling problem, not a failure — the italic serif keeps the tone
 * editorial. Each relax tile states the exact outcome, because "try relaxing
 * your filters" gives the user nothing to decide with.
 */
export function EmptyState({
    relaxOptions,
    diagnostics,
    onApplyRelax,
    onEditPreferences,
}: EmptyStateProps) {
    const { reduced, container, card } = useMotion();

    // Explain which constraint did the most damage, using the diagnostic ladder.
    const tightest = pickTightestConstraint(diagnostics);

    return (
        <div className="mx-auto max-w-3xl py-12 text-center">
            <Compass className="mx-auto h-7 w-7 text-obsidian-500" aria-hidden="true" />

            <h2 className="mt-5 font-display text-3xl italic text-white">
                Nothing in the collection fits every constraint
            </h2>

            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-obsidian-400">
                {tightest
                    ? `Your ${tightest} is doing most of the filtering. Loosen one thing and there are outfits to show.`
                    : 'Your combination is a little too narrow for the curated catalog. Loosen one thing and there are outfits to show.'}
            </p>

            {relaxOptions.length > 0 && (
                <motion.ul
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="mt-8 grid gap-3 sm:grid-cols-3"
                >
                    {relaxOptions.map((option) => (
                        <motion.li key={option.id} variants={card}>
                            <button
                                type="button"
                                onClick={() => onApplyRelax(option.patch)}
                                className="group flex h-full w-full flex-col items-start rounded-tile border border-white/10 bg-white/[0.03] p-4 text-left backdrop-blur-xl transition-colors hover:border-champagne/50 hover:bg-white/[0.06]"
                            >
                                <span className="flex w-full items-start justify-between gap-2">
                                    <span className="text-sm font-medium text-white">{option.label}</span>
                                    <ArrowRight
                                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-obsidian-500 transition-transform group-hover:translate-x-0.5 group-hover:text-champagne"
                                        aria-hidden="true"
                                    />
                                </span>
                                <span className="mt-2 font-data text-[0.6875rem] leading-relaxed text-champagne">
                                    {option.description}
                                </span>
                            </button>
                        </motion.li>
                    ))}
                </motion.ul>
            )}

            <button
                type="button"
                onClick={onEditPreferences}
                className="mt-8 text-[0.8125rem] text-obsidian-400 underline decoration-white/20 underline-offset-4 transition-colors hover:text-white"
            >
                Or adjust your preferences yourself
            </button>

            {!reduced && relaxOptions.length === 0 && (
                <p className="mt-4 text-[0.6875rem] text-obsidian-500">
                    No single change recovers this combination — editing preferences is the way forward.
                </p>
            )}
        </div>
    );
}

/**
 * Identify the filter stage that eliminated the most outfits. Reported in plain
 * language so the explanation reads as advice rather than as a debug trace.
 */
function pickTightestConstraint(diagnostics: FilterDiagnostics | null): string | null {
    if (!diagnostics) return null;

    const stages: Array<{ label: string; remaining: number; previous: number }> = [
        { label: 'occasion', remaining: diagnostics.occasion, previous: diagnostics.total },
        { label: 'dress code', remaining: diagnostics.dressCode, previous: diagnostics.occasion },
        { label: 'budget', remaining: diagnostics.budget, previous: diagnostics.dressCode },
        { label: 'style preference', remaining: diagnostics.style, previous: diagnostics.budget },
        { label: 'color preference', remaining: diagnostics.color, previous: diagnostics.style },
    ];

    let tightest: string | null = null;
    let largestDrop = 0;

    for (const stage of stages) {
        const drop = stage.previous - stage.remaining;
        if (drop > largestDrop && stage.remaining === 0) {
            largestDrop = drop;
            tightest = stage.label;
        }
    }

    // Fall back to the stage with any drop at all, so the copy never stays generic
    // when we do have a specific cause.
    if (!tightest) {
        for (const stage of stages) {
            const drop = stage.previous - stage.remaining;
            if (drop > largestDrop) {
                largestDrop = drop;
                tightest = stage.label;
            }
        }
    }

    return tightest;
}
