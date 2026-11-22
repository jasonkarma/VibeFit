import { BadgeCheck, Sparkles, Cpu } from 'lucide-react';
import type { RankedOutfit } from '@/types/domain';
import { usePreferencesStore } from '@/store/preferencesStore';
import { cn } from '@/lib/cn';

interface RationalePanelProps {
    entry: RankedOutfit;
}

/**
 * Why this outfit was recommended (Story 6 AC2).
 *
 * Two distinct signals are shown, and they are deliberately not merged:
 *
 *   • The **engine's** reasons are deterministic and derived from the catalog —
 *     "Styled for Work", "Business Formal", "$186 of your $250 budget". They are
 *     always present and always true.
 *   • The **model's** narrative comes from Opus 5.5 when a live key is configured.
 *     It is personal and reads better, but it is only available for the result set
 *     it was generated against.
 *
 * The provenance badge states which of the two the user is looking at. This is the
 * whole reason the panel exists as a component rather than inline JSX: the app must
 * never imply the model wrote text it did not write.
 */
export function RationalePanel({ entry }: RationalePanelProps) {
    const aiReason = usePreferencesStore((state) => state.aiReasons[entry.outfit.id]);
    const aiStatus = usePreferencesStore((state) => state.aiStatus);

    const isLive = Boolean(aiReason) && aiStatus === 'live';

    return (
        <section
            aria-labelledby="outfit-rationale-heading"
            className="rounded-surface border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl shadow-glass"
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2
                    id="outfit-rationale-heading"
                    className="font-display text-lg leading-tight text-white"
                >
                    Why this outfit
                </h2>

                <span
                    className={cn(
                        'inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1',
                        'font-data text-[0.5625rem] uppercase tracking-[0.1em]',
                        isLive
                            ? 'border-violet/40 bg-violet/15 text-violet'
                            : 'border-white/15 bg-white/[0.04] text-obsidian-400',
                    )}
                >
                    {isLive ? (
                        <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                    ) : (
                        <Cpu className="h-2.5 w-2.5" aria-hidden="true" />
                    )}
                    {isLive ? 'Opus 5.5 Live' : 'Local Engine'}
                </span>
            </div>

            {isLive ? (
                <p className="mt-3 border-l border-violet/40 pl-3 text-[0.9375rem] leading-relaxed text-obsidian-50">
                    {aiReason}
                </p>
            ) : (
                <p className="mt-3 text-[0.8125rem] leading-relaxed text-obsidian-400">
                    These reasons come from the deterministic matching engine, which compares this
                    outfit against your occasion, dress code, style, colour, and budget. A live
                    model narrative appears here when the assistant is available.
                </p>
            )}

            {entry.reasons.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Matching reasons">
                    {entry.reasons.map((reason) => (
                        <li
                            key={reason}
                            className="inline-flex items-center gap-1 rounded-pill border border-white/10 px-2.5 py-1 font-data text-[0.625rem] text-obsidian-400"
                        >
                            <BadgeCheck
                                className="h-2.5 w-2.5 text-champagne/70"
                                aria-hidden="true"
                            />
                            {reason}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
