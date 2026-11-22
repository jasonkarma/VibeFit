import { motion } from 'framer-motion';
import type { RankedOutfit, Slot } from '@/types/domain';
import { SLOT_LABELS, SLOTS } from '@/types/domain';
import { useMotion } from '@/lib/motion';
import { PrototypeVisual } from '@/components/ui/PrototypeVisual';
import { formatItemPrice, summarisePricing } from '@/lib/pricing';
import { formatUsdExact } from '@/lib/format';

interface CombinedLookProps {
    entry: RankedOutfit;
}

/**
 * Tab 1 — the whole outfit assembled in one place (Story 10 AC2).
 *
 * The layout is a stacked editorial "look board": a hero column showing the
 * composition in wear order (layer behind, top, bottom, shoes) with accessories
 * alongside, so the outfit reads as one look rather than a product grid.
 *
 * Where the catalog supplies photography, it appears alongside any remaining
 * illustrative tiles.
 */
export function CombinedLook({ entry }: CombinedLookProps) {
    const { outfit, items } = entry;
    const { container, card } = useMotion();
    const pricing = summarisePricing(items);
    const hasPhotos = items.some((item) => Boolean(item.image));

    /**
     * Wear order: layer outermost/behind, then top, bottom, shoes; accessories last.
     * Typed as `Slot[]` so an unknown slot would be a compile error rather than an
     * `indexOf` returning -1 and silently sorting to the front.
     */
    const WEAR_ORDER: Slot[] = ['layer', 'top', 'bottom', 'shoes', 'accessory'];
    const ordered = [...items].sort((a, b) => {
        const rankA = WEAR_ORDER.indexOf(a.slot);
        const rankB = WEAR_ORDER.indexOf(b.slot);
        return (rankA === -1 ? WEAR_ORDER.length : rankA) - (rankB === -1 ? WEAR_ORDER.length : rankB);
    });

    const layer = ordered.find((item) => item.slot === 'layer');
    const top = ordered.find((item) => item.slot === 'top');
    const bottom = ordered.find((item) => item.slot === 'bottom');
    const shoes = ordered.find((item) => item.slot === 'shoes');
    const accessories = ordered.filter((item) => item.slot === 'accessory');

    return (
        <section aria-labelledby="combined-look-heading">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                    <h2
                        id="combined-look-heading"
                        className="font-display text-2xl leading-tight text-white"
                    >
                        {outfit.name}
                    </h2>
                    <p className="mt-1 text-[0.8125rem] text-obsidian-400">{outfit.tagline}</p>
                </div>

                <span
                    className="rounded-pill border border-champagne/35 bg-champagne/10 px-3 py-1 font-data text-[0.5625rem] uppercase tracking-[0.12em] text-champagne"
                    data-testid="combined-look-label"
                >
                    {hasPhotos ? 'Outfit preview' : 'Illustrative Prototype Preview'}
                </span>
            </div>

            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-[1.15fr_1fr]"
            >
                {/* Composition column */}
                <motion.div
                    variants={card}
                    className="relative overflow-hidden rounded-surface border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl shadow-glass"
                >
                    <div className="relative mx-auto flex max-w-xs flex-col gap-3">
                        {/* Layer sits behind the top, offset to suggest a worn garment */}
                        {layer && (
                            <figure className="relative">
                                <PrototypeVisual
                                    slot={layer.slot}
                                    name={layer.name}
                                    image={layer.image}
                                    className="aspect-[4/3] w-full"
                                />
                                <figcaption className="mt-1 font-data text-[0.5625rem] uppercase tracking-[0.1em] text-obsidian-500">
                                    Over · {layer.name}
                                </figcaption>
                            </figure>
                        )}

                        {top && (
                            <figure className="relative z-10">
                                <PrototypeVisual
                                    slot={top.slot}
                                    name={top.name}
                                    image={top.image}
                                    className="aspect-[4/3] w-full"
                                />
                                <figcaption className="mt-1 font-data text-[0.5625rem] uppercase tracking-[0.1em] text-obsidian-500">
                                    Base · {top.name}
                                </figcaption>
                            </figure>
                        )}

                        {(bottom || shoes) && (
                            <div className="grid grid-cols-2 gap-3">
                                {bottom && (
                                    <figure>
                                        <PrototypeVisual
                                            slot={bottom.slot}
                                            name={bottom.name}
                                            image={bottom.image}
                                            className="aspect-square w-full"
                                            showBadge={false}
                                        />
                                        <figcaption className="mt-1 font-data text-[0.5rem] uppercase tracking-[0.08em] text-obsidian-500">
                                            {bottom.name}
                                        </figcaption>
                                    </figure>
                                )}
                                {shoes && (
                                    <figure>
                                        <PrototypeVisual
                                            slot={shoes.slot}
                                            name={shoes.name}
                                            image={shoes.image}
                                            className="aspect-square w-full"
                                            showBadge={false}
                                        />
                                        <figcaption className="mt-1 font-data text-[0.5rem] uppercase tracking-[0.08em] text-obsidian-500">
                                            {shoes.name}
                                        </figcaption>
                                    </figure>
                                )}
                            </div>
                        )}

                        {accessories.length > 0 && (
                            <div className="grid grid-cols-2 gap-3">
                                {accessories.map((accessory) => (
                                    <figure key={accessory.id}>
                                        <PrototypeVisual
                                            slot={accessory.slot}
                                            name={accessory.name}
                                            image={accessory.image}
                                            className="aspect-square w-full"
                                            showBadge={false}
                                        />
                                        <figcaption className="mt-1 font-data text-[0.5rem] uppercase tracking-[0.08em] text-obsidian-500">
                                            {accessory.name}
                                        </figcaption>
                                    </figure>
                                ))}
                            </div>
                        )}
                    </div>

                    <p className="mt-4 text-center font-data text-[0.5625rem] uppercase tracking-[0.1em] text-obsidian-500">
                        {hasPhotos ? 'Product photos where available' : 'Prototype visuals · not product photography'}
                    </p>
                </motion.div>

                {/* Piece list column */}
                <motion.div variants={card}>
                    <h3 className="font-data text-[0.625rem] uppercase tracking-[0.14em] text-obsidian-500">
                        All {items.length} pieces
                    </h3>

                    <ul className="mt-2 flex flex-col divide-y divide-white/[0.07]" aria-label="Outfit pieces">
                        {ordered.map((item) => {
                            const price = formatItemPrice(item.price);
                            return (
                                <li
                                    key={item.id}
                                    className="flex items-baseline justify-between gap-3 py-2.5"
                                >
                                    <span className="min-w-0">
                                        <span className="block truncate text-[0.8125rem] text-obsidian-50">
                                            {item.name}
                                        </span>
                                        <span className="block font-data text-[0.5625rem] uppercase tracking-[0.08em] text-obsidian-500">
                                            {SLOT_LABELS[item.slot]} · {item.retailer}
                                        </span>
                                    </span>
                                    <span
                                        className={
                                            price
                                                ? 'shrink-0 font-data text-[0.8125rem] text-white'
                                                : 'shrink-0 font-data text-[0.6875rem] text-fit-tight'
                                        }
                                    >
                                        {price ?? 'Price Unavailable'}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>

                    <p className="mt-3 border-t border-white/10 pt-3 font-data text-[0.8125rem] text-obsidian-50">
                        {pricing.kind === 'complete' ? (
                            <>
                                Total {formatUsdExact(pricing.total)}
                            </>
                        ) : (
                            <>
                                Known subtotal {formatUsdExact(pricing.knownTotal)}
                                <span className="text-fit-tight"> · partial</span>
                            </>
                        )}
                    </p>
                </motion.div>
            </motion.div>

            {/* Slot coverage, so a missing layer or accessory is explicit rather */}
            {/* than looking like a rendering bug. */}
            <p className="mt-4 font-data text-[0.5625rem] uppercase tracking-[0.1em] text-obsidian-500">
                Slots filled ·{' '}
                {SLOTS.filter((slot) => items.some((item) => item.slot === slot)).join(' · ')}
            </p>
        </section>
    );
}
