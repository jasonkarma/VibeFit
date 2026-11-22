import { Check, Sparkles } from 'lucide-react';
import type { Product } from '@/types/domain';
import { SLOT_LABELS } from '@/types/domain';
import { cn } from '@/lib/cn';

interface GarmentSwitcherProps {
    garments: Product[];
    selectedId: string | null;
    onSelect: (product: Product) => void;
    /** Ids of garments that are part of the outfit being previewed. */
    outfitItemIds: string[];
}

/**
 * The five AR-supported tops/jackets (Story 10 AC3).
 *
 * Every supported garment is offered, not just the ones in this outfit — a user
 * trying on a look should be able to check whether the blazer in *another* outfit
 * suits them without losing their place. Pieces belonging to the current outfit
 * are marked "In this outfit" so the distinction is never ambiguous.
 *
 * These are toggle-style buttons with `aria-pressed`, matching the pill pattern
 * already established in the preference screen, so screen-reader behaviour is
 * consistent across the app.
 */
export function GarmentSwitcher({
    garments,
    selectedId,
    onSelect,
    outfitItemIds,
}: GarmentSwitcherProps) {
    return (
        <section aria-labelledby="garment-switcher-heading">
            <div className="flex items-baseline justify-between gap-3">
                <h2
                    id="garment-switcher-heading"
                    className="font-display text-lg leading-tight text-white"
                >
                    Try a different top or jacket
                </h2>
                <span className="font-data text-[0.5625rem] uppercase tracking-[0.1em] text-obsidian-500">
                    {garments.length} supported
                </span>
            </div>

            <ul className="mt-3 flex flex-wrap gap-2" aria-label="AR-supported garments">
                {garments.map((garment) => {
                    const selected = garment.id === selectedId;
                    const inOutfit = outfitItemIds.includes(garment.id);

                    return (
                        <li key={garment.id}>
                            <button
                                type="button"
                                onClick={() => onSelect(garment)}
                                aria-pressed={selected}
                                className={cn(
                                    'flex items-center gap-2 rounded-pill border px-3 py-2 text-left',
                                    'font-sans text-[0.8125rem] transition-colors',
                                    selected
                                        ? 'border-champagne/60 bg-champagne/15 text-white'
                                        : 'border-white/10 bg-white/[0.03] text-obsidian-400 hover:border-white/25 hover:text-white',
                                )}
                            >
                                <span className="min-w-0">
                                    <span className="block truncate">{garment.name}</span>
                                    <span className="block font-data text-[0.5625rem] uppercase tracking-[0.08em] text-obsidian-500">
                                        {SLOT_LABELS[garment.slot]}
                                        {inOutfit && ' · In this outfit'}
                                    </span>
                                </span>

                                {selected ? (
                                    <Check
                                        className="h-3.5 w-3.5 shrink-0 text-champagne"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    inOutfit && (
                                        <Sparkles
                                            className="h-3 w-3 shrink-0 text-violet/70"
                                            aria-hidden="true"
                                        />
                                    )
                                )}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
