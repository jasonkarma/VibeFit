import { useState } from 'react';
import { cn } from '@/lib/cn';
import { SLOT_LABELS, type Slot } from '@/types/domain';

interface PrototypeVisualProps {
    slot: Slot;
    /** Product name, used for the accessible description. */
    name: string;
    /** Optional real image. Falls back to the illustrative tile when absent. */
    image?: string | null;
    /** Slot's garment colour hint, drawn from the catalog palette. */
    accent?: string;
    className?: string;
    /** Hides the badge when the caller already shows one nearby. */
    showBadge?: boolean;
    /** Outfit photography can fill its frame. Product images show the whole item. */
    cover?: boolean;
}

/** Render catalog photography when available, with a labelled fallback. */
export function PrototypeVisual({
    slot,
    name,
    image = null,
    accent,
    className,
    showBadge = true,
    cover = false,
}: PrototypeVisualProps) {
    const [failedImage, setFailedImage] = useState<string | null>(null);
    const photo = image && image !== failedImage ? image : null;

    return (
        <div
            className={cn(
                'relative flex items-center justify-center overflow-hidden rounded-tile',
                'border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02]',
                className,
            )}
        >
            {photo ? (
                <img
                    src={photo}
                    alt={name}
                    loading="lazy"
                    onError={() => setFailedImage(photo)}
                    className={cn('h-full w-full', cover ? 'object-cover' : 'object-contain')}
                />
            ) : (
                <SlotGlyph slot={slot} accent={accent} label={name} />
            )}

            {showBadge && !photo && (
                <span
                    className={cn(
                        'absolute left-2 top-2 rounded-pill px-2 py-0.5',
                        'border border-champagne/35 bg-obsidian/75 backdrop-blur-md',
                        'font-data text-[0.5625rem] uppercase tracking-[0.12em] text-champagne/90',
                    )}
                >
                    Prototype Visual
                </span>
            )}
        </div>
    );
}

/**
 * Slot glyphs. Simple abstract silhouettes: recognisable enough to tell a shoe
 * from a jacket at a glance, plain enough that nobody mistakes them for
 * photography.
 */
function SlotGlyph({ slot, accent, label }: { slot: Slot; accent?: string; label: string }) {
    const stroke = accent ?? 'rgba(229,193,88,0.55)';

    return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-3 py-4">
            <svg
                viewBox="0 0 64 64"
                className="h-14 w-14"
                fill="none"
                stroke={stroke}
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                role="img"
                aria-label={`${label} — illustrative ${SLOT_LABELS[slot].toLowerCase()} outline`}
            >
                <SlotPath slot={slot} />
            </svg>
            <span className="font-data text-[0.5625rem] uppercase tracking-[0.14em] text-obsidian-500">
                {SLOT_LABELS[slot]}
            </span>
        </div>
    );
}

function SlotPath({ slot }: { slot: Slot }) {
    switch (slot) {
        case 'top':
            return (
                <>
                    <path d="M24 14 L14 20 L10 34 L18 37 L20 54 H44 L46 37 L54 34 L50 20 L40 14" />
                    <path d="M24 14 Q32 22 40 14" />
                </>
            );
        case 'layer':
            return (
                <>
                    <path d="M24 14 L12 20 L8 36 L17 39 L19 56 H45 L47 39 L56 36 L52 20 L40 14" />
                    <path d="M32 16 V56" />
                    <path d="M24 14 L26 30 L32 36 L38 30 L40 14" />
                </>
            );
        case 'bottom':
            return (
                <>
                    <path d="M20 12 H44 L46 54 H36 L32 30 L28 54 H18 Z" />
                    <path d="M20 18 H44" />
                </>
            );
        case 'shoes':
            return (
                <>
                    <path d="M10 42 H34 Q40 42 44 36 L50 30 Q52 28 50 34 L50 42 Q50 48 44 48 H12 Q10 48 10 44 Z" />
                    <path d="M16 42 V36" />
                    <path d="M22 42 V36" />
                </>
            );
        case 'accessory':
            return (
                <>
                    <circle cx="32" cy="34" r="14" />
                    <circle cx="32" cy="34" r="7" />
                    <path d="M22 20 Q32 8 42 20" />
                </>
            );
        default:
            return <circle cx="32" cy="32" r="16" />;
    }
}
