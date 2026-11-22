import { motion } from 'framer-motion';
import { ArrowUpRight, Camera } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { RankedOutfit } from '@/types/domain';
import { COLOR_SWATCHES } from '@/types/domain';
import { MatchRing } from '@/components/ui/MatchRing';
import { BudgetMeter } from '@/components/ui/BudgetMeter';
import { PrototypeVisual } from '@/components/ui/PrototypeVisual';
import { useMotion } from '@/lib/motion';
import { cn } from '@/lib/cn';
import { LINK_UNAVAILABLE, shoppingDestination } from '@/lib/pricing';

interface OutfitCardProps {
    entry: RankedOutfit;
    budget: number;
    onOpen: (entry: RankedOutfit) => void;
    /** Where this card sits in the stagger, for reveal delay. */
    index: number;
    /**
     * Personalized narrative from the live model, already validated to reference
     * only real prices. Absent when running on the local engine.
     */
    aiReason?: string;
}

const WEAR_ORDER = ['layer', 'top', 'bottom', 'shoes', 'accessory'] as const;

export function OutfitCard({ entry, budget, onOpen, index, aiReason }: OutfitCardProps) {
    const { reduced, card } = useMotion();
    const { outfit, items, knownTotal, priceComplete, matchScore, reasons, arReady } = entry;

    const orderedPieces = [...items].sort(
        (a, b) => WEAR_ORDER.indexOf(a.slot) - WEAR_ORDER.indexOf(b.slot),
    );
    const heroProduct =
        items.find((item) => item.slot === 'top' && item.image) ??
        items.find((item) => item.image) ??
        items.find((item) => item.slot === 'top') ??
        items[0];
    const heroAccent = heroProduct?.colors[0] ? COLOR_SWATCHES[heroProduct.colors[0]] : undefined;

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
                {/* Hero garment */}
                <div className="relative aspect-[4/3] w-full overflow-hidden">
                    <PrototypeVisual
                        slot={heroProduct?.slot ?? 'top'}
                        name={outfit.heroImage ? outfit.name : heroProduct?.name ?? outfit.name}
                        image={outfit.heroImage ?? heroProduct?.image}
                        accent={heroAccent}
                        cover={Boolean(outfit.heroImage)}
                        className="h-full w-full rounded-none border-0 transition-transform duration-700 group-hover:scale-105"
                    />

                    <span className="absolute right-3 top-3 z-10 block">
                        <MatchRing value={matchScore} size={46} />
                    </span>

                    {arReady && (
                        <Link
                            to={`/results/${outfit.id}/preview?mode=ar`}
                            aria-label={`Try on ${outfit.name} with camera`}
                            className="absolute left-3 top-3 z-20 inline-flex min-h-9 items-center gap-1.5 rounded-pill border border-violet/50 bg-obsidian/90 px-3 py-1.5 text-xs font-medium text-violet hover:text-white focus-visible:outline focus-visible:outline-violet"
                        >
                            <Camera className="h-4 w-4" aria-hidden="true" />
                            Try on with camera
                        </Link>
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

                    {/*
                      When the model supplied a reason, it leads — it is personalized and
                      reads better than the mechanical chips. The engine's own reasons stay
                      underneath as the factual substrate, so the card remains trustworthy
                      even if the narrative is disabled or unavailable.
                    */}
                    {aiReason && (
                        <p className="mt-2.5 border-l border-violet/40 pl-2.5 text-[0.8125rem] leading-relaxed text-obsidian-50">
                            {aiReason}
                        </p>
                    )}

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

                    <ul className="mt-4 grid grid-cols-2 gap-2" aria-label={`Products in ${outfit.name}`}>
                        {orderedPieces.map((piece) => {
                            const swatch = piece.colors[0] ? COLOR_SWATCHES[piece.colors[0]] : undefined;
                            const destination = shoppingDestination(piece);

                            return (
                                <li key={piece.id} className="min-w-0 rounded-tile border border-white/10 p-2">
                                    <PrototypeVisual
                                        slot={piece.slot}
                                        name={piece.name}
                                        image={piece.image}
                                        accent={swatch}
                                        showBadge={false}
                                        className="aspect-[4/3] w-full"
                                    />
                                    <p className="mt-1.5 text-xs leading-snug text-obsidian-50">{piece.name}</p>
                                    {destination ? (
                                        <a
                                            href={destination.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label={`${destination.label} — ${piece.name} (opens in a new tab)`}
                                            className="relative z-20 mt-1 inline-flex min-h-8 items-center gap-1 rounded px-1 text-xs text-champagne hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-champagne"
                                        >
                                            {destination.label}
                                            <ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden="true" />
                                        </a>
                                    ) : (
                                        <p className="mt-1 text-xs text-obsidian-400">{LINK_UNAVAILABLE}</p>
                                    )}
                                </li>
                            );
                        })}
                    </ul>

                    <div className="mt-auto pt-4">
                        <BudgetMeter total={knownTotal} budget={budget} priceComplete={priceComplete} compact />
                        <p className="mt-2 font-data text-[0.625rem] uppercase tracking-[0.1em] text-obsidian-500">
                            {items.length} pieces
                        </p>
                    </div>
                </div>

                {/* Shopping anchors sit above the outfit-details click target. */}
                <button
                    type="button"
                    onClick={() => onOpen(entry)}
                    className="absolute inset-0 z-10 rounded-surface focus:outline-none"
                    aria-label={`View details for ${outfit.name} — ${matchScore}% match, ${items.length} pieces`}
                />
            </article>
        </motion.div>
    );
}
