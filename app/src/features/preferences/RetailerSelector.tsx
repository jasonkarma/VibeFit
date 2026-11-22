import { Store, X } from 'lucide-react';
import { catalog } from '@/data/catalog';
import { cn } from '@/lib/cn';

interface RetailerSelectorProps {
    value: string[];
    onToggle: (retailer: string) => void;
    onClear: () => void;
}

/**
 * Optional preferred-retailers filter (Sprint 3).
 *
 * The available shops are derived from the catalog rather than from the static
 * `RETAILERS` list, so the control can never offer a shop that sells nothing. A
 * pill that filters to an empty result set would be a bug the user blames on us.
 *
 * Match semantics are stated in the UI, not just in the engine: selecting a shop
 * includes outfits that *feature* a piece from that shop, not only outfits sourced
 * entirely from it. Without that sentence, "Zara" returning a COS-trouser outfit
 * would look like the filter is broken.
 *
 * Empty selection = all retailers, so there is no "select all" button to fall out of
 * sync. The clear affordance only appears when something is selected.
 */
export function RetailerSelector({ value, onToggle, onClear }: RetailerSelectorProps) {
    // Only shops that actually carry at least one product, alphabetised.
    const available = Array.from(
        new Set(catalog.products.map((product) => product.retailer)),
    ).sort((a, b) => a.localeCompare(b));

    const selectedCount = value.length;

    return (
        <div>
            <div className="mb-2.5 flex items-center justify-between gap-3">
                <p className="text-[0.6875rem] text-obsidian-500">
                    {selectedCount === 0
                        ? 'No filter — every shop in the collection is included.'
                        : `${selectedCount} ${selectedCount === 1 ? 'shop' : 'shops'} selected.`}
                </p>

                {selectedCount > 0 && (
                    <button
                        type="button"
                        onClick={onClear}
                        className="inline-flex shrink-0 items-center gap-1 rounded-pill border border-white/10 px-2.5 py-1 font-sans text-[0.6875rem] text-obsidian-400 transition-colors hover:border-white/25 hover:text-white"
                    >
                        <X className="h-2.5 w-2.5" aria-hidden="true" />
                        Include all retailers
                    </button>
                )}
            </div>

            <div role="group" aria-label="Preferred retailers" className="flex flex-wrap gap-1.5">
                {available.map((retailer) => {
                    const selected = value.includes(retailer);

                    return (
                        <button
                            key={retailer}
                            type="button"
                            onClick={() => onToggle(retailer)}
                            aria-pressed={selected}
                            className={cn(
                                'inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5',
                                'font-sans text-[0.75rem] transition-colors duration-150',
                                selected
                                    ? 'border-champagne/60 bg-champagne/12 text-white'
                                    : 'border-white/10 bg-white/[0.02] text-obsidian-400 hover:border-white/25 hover:text-white',
                            )}
                        >
                            <Store
                                className={cn(
                                    'h-2.5 w-2.5',
                                    selected ? 'text-champagne' : 'text-obsidian-500',
                                )}
                                aria-hidden="true"
                            />
                            {retailer}
                        </button>
                    );
                })}
            </div>

            <p className="mt-2.5 text-[0.6875rem] leading-relaxed text-obsidian-500">
                Selecting a shop shows outfits that <span className="text-obsidian-400">include a
                    piece from it</span> — a look can mix shops. Prices and links are always shown per
                retailer on the outfit detail screen.
            </p>
        </div>
    );
}
