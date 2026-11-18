import { Briefcase, Heart, PartyPopper, Sparkles } from 'lucide-react';
import { OCCASIONS, type Occasion } from '@/types/domain';
import { BentoTile } from '@/components/ui/BentoTile';
import { FieldError } from '@/components/ui/FieldError';
import { cn } from '@/lib/cn';

interface OccasionSelectorProps {
    value: Occasion | null;
    onChange: (occasion: Occasion) => void;
    error?: string;
}

/**
 * VIBE-11 — Select Occasion.
 *
 * A 2x2 bento grid rather than radios: four options is small enough that the
 * visuals aid recognition, and showing them all at once removes a click from the
 * most common path. Rendered as real buttons with `aria-pressed` inside a
 * `fieldset`, so the semantics match the visual grouping.
 */
const META: Record<
    Occasion,
    { icon: typeof Sparkles; blurb: string }
> = {
    'Casual Outing': { icon: Sparkles, blurb: 'Weekends, errands, low stakes' },
    Work: { icon: Briefcase, blurb: 'Office days and client meetings' },
    Party: { icon: PartyPopper, blurb: 'Dinners, birthdays, nights out' },
    Wedding: { icon: Heart, blurb: 'Ceremonies and receptions' },
};

export function OccasionSelector({ value, onChange, error }: OccasionSelectorProps) {
    return (
        <fieldset>
            <legend className="sr-only">Select an occasion</legend>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {OCCASIONS.map((occasion) => {
                    const { icon: Icon, blurb } = META[occasion];
                    const selected = value === occasion;

                    return (
                        <BentoTile
                            key={occasion}
                            selected={selected}
                            layoutGroup="occasion"
                            onClick={() => onChange(occasion)}
                            // Explicit name so it always starts with the occasion. Without this,
                            // the decorative "Selected" badge would be prepended to the
                            // accessible name ("Selected Wedding …") and `aria-pressed` already
                            // reports selection state, making the word redundant.
                            aria-label={`${occasion} — ${blurb}`}
                        >
                            <span className="flex items-start justify-between">
                                <Icon
                                    className={cn(
                                        'h-5 w-5 transition-colors',
                                        selected ? 'text-champagne' : 'text-obsidian-500',
                                    )}
                                    aria-hidden="true"
                                />
                                {selected && (
                                    <span
                                        className="font-data text-[0.625rem] uppercase tracking-[0.1em] text-champagne"
                                        aria-hidden="true"
                                    >
                                        Selected
                                    </span>
                                )}
                            </span>

                            <span className="mt-3 block font-display text-xl text-white" aria-hidden="true">
                                {occasion}
                            </span>
                            <span className="mt-1 block text-[0.8125rem] text-obsidian-400" aria-hidden="true">
                                {blurb}
                            </span>
                        </BentoTile>
                    );
                })}
            </div>

            <FieldError id="occasion-error">{error}</FieldError>
        </fieldset>
    );
}
