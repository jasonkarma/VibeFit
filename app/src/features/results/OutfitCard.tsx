import { motion } from 'framer-motion';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import type { RankedOutfit } from '@/types/domain';
import { MatchRing } from '@/components/ui/MatchRing';
import { BudgetMeter } from '@/components/ui/BudgetMeter';
import { useMotion } from '@/lib/motion';
import { cn } from '@/lib/cn';

interface OutfitCardProps {
    entry: RankedOutfit;
    budget: number;
    onOpen: (entry: RankedOutfit) => void;
    /** Where this card sits in the stagger, for reveal delay. */
    index: number;
}

/**
 * Editorial bento result card.
 *
 * Structure note: the card is an `<article>` whose content stays semantic
 * (`h3`, paragraphs, chips), with a single absolutely-positioned button overlay
 * providing the click target. Wrapping the whole card in a `<button>` would place
 * flow content like `<p>` and `<ul>` inside a phrasing-only element, which is
 * invalid HTML and breaks assistive technology's list and heading model.
 *
 * One button per card also keeps keyboard navigation sane: users tab between
 * outfits, not between every garment. The garment list belongs to the detail
 * view that Sprint 2 adds.
 */
export function OutfitCard({ entry, budget, onOpen, index }: OutfitCardProps) {
    const { reduced, card } = useMotion();
    const { outfit, items, knownTotal, priceComplete, matchScore, reasons, arReady } = entry;

    const hero = outfit.heroImage ?? items.find((item) => item.slot === 'top')?.image ?? null;

    return (
        <motion.div
            variants={card}
            transition={{ delay: reduced ? 0 : index * 0.08 }}
            className="h-full"
        >
            <article
                className={cn(
                    'group relative flex h-full w-full flex-col overflow-hidden rounded-surface',
                    'border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-glass',
                    'transition-all duration-300',
                    'hover:border-white/20 hover:bg-white/[0.05]',
                    'focus-within:border-champagne/60',
                )}
                aria-label={outfit.name}
            >
                {/* Hero */}
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-white/[0.06] to-white/[0.02]">
                    {hero ? (
                        <img
                            src={hero}
                            alt={`${outfit.name} outfit`}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                    ) : (
                        // No bundled photography: an explicit, labelled prototype visual
                        // rather than a broken image (acceptance criterion 6.3).
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-4">
                            <span className="flex -space-x-2">
                                {items.slice(0, 4).map((item) => (
                                    <span
                                        key={item.id}
                                        className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] font-data text-[0.5625rem] uppercase text-obsidian-400"
                                        aria-hidden="true"
                                    >
                                        {item.slot.slice(0, 2)}
                                    </span>
                                ))}
                            </span>
                            <span className="font-data text-[0.5625rem] uppercase tracking-[0.12em] text-obsidian-500">
                                Illustrative prototype preview
                            </span>
                        </div>
                    )}

                    <span className="absolute right-3 top-3 block">
                        <MatchRing value={matchScore} size={46} />
                    </span>

                    {arReady && (
                        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-pill border border-violet/40 bg-violet/15 px-2 py-0.5 font-data text-[0.5625rem] uppercase tracking-[0.1em] text-violet backdrop-blur-md">
                            <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                            AR Ready
                        </span>
                    )}
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                        <h3 className="font-display text-xl leading-tight text-white">{outfit.name}</h3>
                        <ArrowUpRight
                            className="mt-1 h-4 w-4 shrink-0 text-obsidian-500 transition-colors group-hover:text-champagne"
                            aria-hidden="true"
                        />
                    </div>

                    <p className="mt-1 text-[0.8125rem] leading-relaxed text-obsidian-400">
                        {outfit.tagline}
                    </p>

                    {/* Reason chips: presentational, so spans rather than list items. */}
                    <div className="mt-3 flex flex-wrap gap-1">
                        {reasons.map((reason) => (
                            <span
                                key={reason}
                                className="rounded-pill border border-white/10 px-2 py-0.5 font-data text-[0.625rem] text-obsidian-400"
                            >
                                {reason}
                            </span>
                        ))}
                    </div>

                    <div className="mt-auto pt-4">
                        <BudgetMeter total={knownTotal} budget={budget} priceComplete={priceComplete} compact />
                        <p className="mt-2 font-data text-[0.625rem] uppercase tracking-[0.1em] text-obsidian-500">
                            {items.length} pieces
                        </p>
                    </div>
                </div>

                {/*
          Overlay button: the entire card is one click target with a single
          accessible name, without nesting flow content inside a button.
        */}
                <button
                    type="button"
                    onClick={() => onOpen(entry)}
                    className="absolute inset-0 z-10 rounded-surface focus:outline-none"
                    aria-label={`View ${outfit.name} — ${matchScore}% match, ${items.length} pieces, ${knownTotal} dollars`}
                />
            </article>
        </motion.div>
    );
}
