import { motion } from 'framer-motion';
import { DRESS_CODES, type DressCode } from '@/types/domain';
import { FieldError } from '@/components/ui/FieldError';
import { useMotion } from '@/lib/motion';
import { cn } from '@/lib/cn';

interface DressCodeSelectorProps {
    value: DressCode | null;
    onChange: (dressCode: DressCode) => void;
    error?: string;
}

const DESCRIPTIONS: Record<DressCode, string> = {
    Casual: 'No rules',
    'Smart Casual': 'Clean and intentional',
    'Business Formal': 'Tailoring, polished',
    Cocktail: 'Elevated evening',
    'Black Tie': 'Most formal',
};

/**
 * VIBE-13 — Select Dress Code.
 *
 * Presented as an explicit formality ladder rather than five unrelated radio
 * buttons. This is a real usability gain: formality is a spectrum, and users who
 * are unsure between "Smart Casual" and "Business Formal" can see where each
 * sits. It also makes acceptance criterion 13.3 self-evident — changing the
 * dress code visibly slides a single gold indicator along one rail.
 */
export function DressCodeSelector({ value, onChange, error }: DressCodeSelectorProps) {
    const { reduced } = useMotion();
    const selectedIndex = value ? DRESS_CODES.indexOf(value) : -1;

    return (
        <fieldset>
            <legend className="sr-only">Select a dress code</legend>

            <div className="relative">
                {/* Formality rail behind the options. */}
                <div
                    className="absolute left-0 right-0 top-[1.0625rem] h-px bg-white/10"
                    aria-hidden="true"
                />
                <div
                    className="absolute left-0 top-[1.0625rem] h-px bg-champagne/40 transition-[width] duration-300"
                    style={{
                        width:
                            selectedIndex >= 0
                                ? `${(selectedIndex / (DRESS_CODES.length - 1)) * 100}%`
                                : '0%',
                    }}
                    aria-hidden="true"
                />

                <ol className="relative grid grid-cols-5 gap-1.5">
                    {DRESS_CODES.map((dressCode, index) => {
                        const selected = value === dressCode;

                        return (
                            <li key={dressCode} className="flex flex-col items-center text-center">
                                <button
                                    type="button"
                                    aria-pressed={selected}
                                    onClick={() => onChange(dressCode)}
                                    // The visible descriptor is part of the accessible name but sits
                                    // after the code, so the name still *starts* with the code.
                                    aria-label={`${dressCode} — ${DESCRIPTIONS[dressCode]}`}
                                    className="group flex w-full flex-col items-center rounded-md pt-0"
                                >
                                    {/* Dot on the rail; the shared layoutId makes it travel. */}
                                    <span className="relative flex h-[2.125rem] w-full items-center justify-center">
                                        {selected && !reduced && (
                                            <motion.span
                                                layoutId="dresscode-dot"
                                                className="absolute h-3 w-3 rounded-full bg-champagne shadow-glow-gold"
                                                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                                                aria-hidden="true"
                                            />
                                        )}
                                        {selected && reduced && (
                                            <span
                                                className="absolute h-3 w-3 rounded-full bg-champagne"
                                                aria-hidden="true"
                                            />
                                        )}
                                        {!selected && (
                                            <span
                                                className="h-2 w-2 rounded-full bg-obsidian border border-white/25 transition-colors group-hover:border-champagne/60"
                                                aria-hidden="true"
                                            />
                                        )}
                                    </span>

                                    <span
                                        className={cn(
                                            'mt-1 text-[0.6875rem] font-medium leading-tight transition-colors sm:text-xs',
                                            selected
                                                ? 'text-white'
                                                : 'text-obsidian-400 group-hover:text-obsidian-50',
                                        )}
                                    >
                                        {dressCode}
                                    </span>
                                    <span
                                        className="mt-0.5 hidden text-[0.625rem] leading-tight text-obsidian-500 sm:block"
                                        aria-hidden="true"
                                    >
                                        {DESCRIPTIONS[dressCode]}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ol>
            </div>

            <div className="mt-3 flex justify-between">
                <span className="font-data text-[0.625rem] uppercase tracking-[0.1em] text-obsidian-500">
                    Less formal
                </span>
                <span className="font-data text-[0.625rem] uppercase tracking-[0.1em] text-obsidian-500">
                    More formal
                </span>
            </div>

            <FieldError id="dressCode-error">{error}</FieldError>
        </fieldset>
    );
}
