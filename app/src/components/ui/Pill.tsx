import { motion } from 'framer-motion';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useMotion } from '@/lib/motion';

interface PillProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onAnimationStart'> {
    selected: boolean;
    children: ReactNode;
    /** Renders a colour dot before the label, used for palette pills. */
    swatch?: string;
    /** Shared layout group id; the moving border travels between siblings. */
    layoutGroup?: string;
    icon?: ReactNode;
}

/**
 * Selectable pill tag with a magnetic feel: the champagne border is a shared
 * `layoutId` element, so it slides between options instead of blinking.
 *
 * Accessibility: a real `<button>` with `aria-pressed`. The animation is
 * decoration only — state is fully expressed by `aria-pressed` and the visible
 * checkmark, so nothing is lost with reduced motion or in tests.
 */
export function Pill({
    selected,
    children,
    swatch,
    layoutGroup = 'pill',
    icon,
    className,
    ...rest
}: PillProps) {
    const { reduced } = useMotion();
    const sharedId = `pill-${layoutGroup}-selection`;

    return (
        <button
            type="button"
            aria-pressed={selected}
            className={cn(
                'relative inline-flex items-center gap-2 rounded-pill px-4 py-2.5',
                'font-sans text-sm font-medium transition-colors duration-150',
                'border',
                selected
                    ? 'text-white border-transparent'
                    : 'text-obsidian-400 border-white/10 hover:text-white hover:border-white/20',
                className,
            )}
            {...rest}
        >
            {selected && (
                <motion.span
                    layoutId={reduced ? undefined : sharedId}
                    className="absolute inset-0 rounded-pill bg-champagne/15 border border-champagne/60"
                    transition={{ duration: reduced ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
                    aria-hidden="true"
                />
            )}

            <span className="relative flex items-center gap-2">
                {swatch && (
                    <span
                        className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-inset ring-white/25"
                        style={{ background: swatch }}
                        aria-hidden="true"
                    />
                )}
                {icon}
                {children}
                {selected && <Check className="h-3.5 w-3.5 text-champagne" aria-hidden="true" />}
            </span>
        </button>
    );
}
