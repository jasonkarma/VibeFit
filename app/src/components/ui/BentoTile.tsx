import { motion } from 'framer-motion';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useMotion } from '@/lib/motion';

interface BentoTileProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onAnimationStart'> {
    selected?: boolean;
    children: ReactNode;
    /** Shared group id so the selection ring travels between sibling tiles. */
    layoutGroup?: string;
    /** Stretch to fill its grid cell. */
    fullHeight?: boolean;
}

/**
 * Editorial bento tile used for occasion selection and relax options.
 *
 * The ring is a shared-layout element, so selecting a new tile makes the ring
 * physically move — the interaction reads as one object changing state rather
 * than two separate fades. Reduced motion and tests get a static ring.
 */
export function BentoTile({
    selected = false,
    children,
    layoutGroup = 'bento',
    fullHeight = false,
    className,
    ...rest
}: BentoTileProps) {
    const { reduced } = useMotion();
    const sharedId = `bento-${layoutGroup}-ring`;

    return (
        <button
            type="button"
            aria-pressed={selected}
            className={cn(
                'relative w-full rounded-tile border p-5 text-left',
                'bg-white/[0.03] backdrop-blur-xl transition-colors duration-200',
                'hover:bg-white/[0.05] hover:border-white/[0.18]',
                selected ? 'border-champagne/70' : 'border-white/10',
                fullHeight && 'h-full',
                className,
            )}
            {...rest}
        >
            {selected &&
                (reduced ? (
                    <span
                        className="pointer-events-none absolute inset-0 rounded-tile ring-1 ring-inset ring-champagne/70"
                        aria-hidden="true"
                    />
                ) : (
                    <motion.span
                        layoutId={sharedId}
                        className="pointer-events-none absolute inset-0 rounded-tile ring-1 ring-inset ring-champagne/70 shadow-glow-gold"
                        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                        aria-hidden="true"
                    />
                ))}
            {children}
        </button>
    );
}
