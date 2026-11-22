import { motion } from 'framer-motion';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import type { RankedOutfit } from '@/types/domain';
import { COLOR_SWATCHES } from '@/types/domain';
import { MatchRing } from '@/components/ui/MatchRing';
import { BudgetMeter } from '@/components/ui/BudgetMeter';
import { PrototypeVisual } from '@/components/ui/PrototypeVisual';
import { useMotion } from '@/lib/motion';
import { cn } from '@/lib/cn';

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
export function OutfitCard({ entry, budget, onOpen, index, aiReason }: OutfitCardProps) {
    const { reduced, card } = useMotion();
    const { outfit, items, knownTotal, priceComplete, matchScore, reasons, arReady } = entry;

    const hero = outfit.heroImage ?? items.find((item) => item.slot === 'top')?.image ?? null;

    /*
     * Garment imagery in wear order.
     *
     * Sprint 3 adds per-piece visuals to the card. The catalog has no photography
     * (`image: null` throughout), so each tile renders the same labelled
     * `PrototypeVisual` used on the detail screen — a garment silhouette and a slot
     * label rather than a broken image or a stock photo pretending to be the product.
     *
     * The top piece doubles as the hero when no `heroImage` exists, so the card
     * leads with the largest, most recognisable garment instead of a generic
     * placeholder. Layer sits first in the strip because that is how the look is
     * worn; the primary three (top/bottom/shoes) are what a user scans for.
     */
    const WEAR_ORDER = ['layer', 'top', 'bottom', 'shoes', 'accessory'] as const;
    const orderedPieces = [...items].sort(
        (a, b) => WEAR_ORDER.indexOf(a.slot) - WEAR_ORDER.indexOf(b.slot),
    );
    const thumbnails = orderedPieces.slice(0, 4);

    const heroProduct = items.find((item) => item.slot === 'top') ?? items[0];
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
                    {hero ? (
                        <img
                            src={hero}
                            alt={`${outfit.name} outfit`}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                    ) : (
                        // No bundled photography: an explicit, labelled prototype visual
                        // of the outfit's anchor garment rather than a broken image.
                        <PrototypeVisual
                            slot={heroProduct?.slot ?? 'top'}
                            name={heroProduct?.name ?? outfit.name}
                            accent={heroAccent}
                            className="h-full w-full rounded-none border-0 transition-transform duration-700 group-hover:scale-105"
                        />
                    )}

                    <span className="absolute right-3 top-3 z-10 block">
                        <MatchRing value={matchScore} size={46} />
                    </span>

                    {/*
                      Sprint 2 makes this an available feature rather than an
                      advertisement of future capability, so the copy changes from
                      "AR Ready" to "AR Try-On". The badge is still data-driven off
                      `arSupported` via `entry.arReady`.
                    */}
                    {arReady && (
                        <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-pill border border-violet/40 bg-violet/15 px-2 py-0.5 font-data text-[0.5625rem] uppercase tracking-[0.1em] text-violet backdrop-blur-md">
                            <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                            AR Try-On
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

                    {/*
                      Per-piece imagery (Sprint 3).

                      A recommendation is an *outfit*, but a still card can only show
                      one hero. This strip shows the other pieces at a glance so the
                      card communicates the whole look, while the hero stays large
                      enough to be the visual anchor. Purely presentational, so the
                      tiles are `aria-hidden` and the piece count below carries the
                      information for assistive technology — the accessible name of
                      the card already names the outfit and its piece count.
                    */}
                    <div className="mt-3 flex gap-1.5" aria-hidden="true">
                        {thumbnails.map((piece) => {
                            const swatch = piece.colors[0] ? COLOR_SWATCHES[piece.colors[0]] : undefined;
                            return (
                                <div key={piece.id} className="min-w-0 flex-1">
                                    <PrototypeVisual
                                        slot={piece.slot}
                                        name={piece.name}
                                        image={piece.image}
                                        accent={swatch}
                                        showBadge={false}
                                        className="aspect-square w-full"
                                    />
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-auto pt-4">
                        <BudgetMeter total={knownTotal} budget={budget} priceComplete={priceComplete} compact />
                        <p className="mt-2 font-data text-[0.625rem] uppercase tracking-[0.1em] text-obsidian-500">
                            {items.length} pieces
                            {orderedPieces.length > thumbnails.length &&
                                ` · +${orderedPieces.length - thumbnails.length} more`}
                        </p>
                    </div>
                </div>

                {/*
          Overlay button: the entire card is one click target with a single
          accessible name, without nesting flow content inside a button.

          The accessible name now says "details", because since Sprint 2 the action
          genuinely opens a detail view (Story 6 AC1) rather than being a
          no-op-with-intent.
        */}
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
