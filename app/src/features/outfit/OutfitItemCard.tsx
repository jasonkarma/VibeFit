import { ExternalLink, Link2Off, Sparkles } from 'lucide-react';
import type { Product } from '@/types/domain';
import { COLOR_SWATCHES, SLOT_LABELS } from '@/types/domain';
import { PrototypeVisual } from '@/components/ui/PrototypeVisual';
import {
    LINK_UNAVAILABLE,
    PRICE_UNAVAILABLE,
    formatItemPrice,
    hasDisplayablePrice,
    samplePriceLabel,
    shoppingDestination,
} from '@/lib/pricing';
import { cn } from '@/lib/cn';

interface OutfitItemCardProps {
    product: Product;
}

/**
 * One garment in the outfit (Stories 7 and 8).
 *
 * Renders a plain `<div>` so the caller can own the list semantics (`motion.li`
 * inside `motion.ul`). Wrapping flow content in a `<button>` or nesting a `<div>`
 * directly under a `<ul>` would both break assistive-technology list models.
 *
 * Two edge cases are encoded as branches with no fallthrough, because both have a
 * tempting wrong answer:
 *
 *   • `price: null` → render "Price Unavailable". The wrong answers are `$0.00`,
 *     "~$X", or hiding the row — all three invent or conceal a fact. The dollar
 *     sign is absent from this branch entirely, so a screenshot cannot be misread.
 *   • Missing shopping destination → render "Link Unavailable" as text.
 *
 * The shop link is a real `<a>` with `target="_blank"` and
 * `rel="noopener noreferrer"`, and its accessible name names the retailer so a
 * screen-reader user knows the destination before activating it.
 */
export function OutfitItemCard({ product }: OutfitItemCardProps) {
    const price = formatItemPrice(product.price);
    const destination = shoppingDestination(product);
    const swatch = product.colors[0] ? COLOR_SWATCHES[product.colors[0]] : undefined;

    return (
        <div
            className={cn(
                'group flex h-full flex-col overflow-hidden rounded-surface',
                'border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-glass',
                'transition-colors duration-300 hover:border-white/[0.18] hover:bg-white/[0.05]',
            )}
            data-testid={`outfit-item-${product.id}`}
            data-price-known={hasDisplayablePrice(product) ? 'true' : 'false'}
            data-link-available={destination ? 'true' : 'false'}
        >
            <PrototypeVisual
                slot={product.slot}
                name={product.name}
                image={product.image}
                accent={swatch}
                className="aspect-[4/3] w-full rounded-none border-0 border-b border-white/10"
            />

            <div className="flex flex-1 flex-col p-4">
                <p className="font-data text-[0.5625rem] uppercase tracking-[0.14em] text-obsidian-500">
                    {SLOT_LABELS[product.slot]}
                </p>

                <h3 className="mt-1 font-display text-base leading-snug text-white">
                    {product.name}
                </h3>

                <p className="mt-0.5 text-[0.75rem] text-obsidian-400">{product.retailer}</p>

                <div className="mt-3 flex flex-col gap-1">
                    {price ? (
                        <>
                            <span className="font-data text-base font-medium text-white">
                                {price}
                            </span>
                            <span className="font-data text-[0.5625rem] uppercase tracking-[0.08em] text-violet/90">
                                {samplePriceLabel(product.priceRetrievedAt)}
                            </span>
                        </>
                    ) : (
                        <span
                            className="font-data text-sm font-medium text-fit-tight"
                            data-testid={`price-unavailable-${product.id}`}
                        >
                            {PRICE_UNAVAILABLE}
                        </span>
                    )}
                </div>

                <div className="mt-auto pt-4">
                    {destination ? (
                        <a
                            href={destination.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                                'inline-flex w-full items-center justify-center gap-1.5 rounded-pill',
                                'border border-champagne/40 bg-champagne/10 px-3 py-2',
                                'font-sans text-[0.8125rem] font-medium text-champagne',
                                'transition-colors hover:bg-champagne/20 hover:text-champagne-100',
                            )}
                            aria-label={`${destination.label} — ${product.name} (opens in a new tab)`}
                        >
                            {destination.label}
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                    ) : (
                        <p
                            className="inline-flex items-center gap-1.5 font-data text-[0.625rem] uppercase tracking-[0.08em] text-obsidian-500"
                            data-testid={`link-unavailable-${product.id}`}
                        >
                            <Link2Off className="h-3 w-3" aria-hidden="true" />
                            {LINK_UNAVAILABLE}
                        </p>
                    )}
                </div>

                {product.arSupported && (
                    <p className="mt-2 inline-flex items-center gap-1 font-data text-[0.5625rem] uppercase tracking-[0.1em] text-violet">
                        <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                        AR try-on
                    </p>
                )}
            </div>
        </div>
    );
}
