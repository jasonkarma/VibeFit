import { cn } from '@/lib/cn';
import { palette } from '@/styles/tokens';

interface MatchRingProps {
    /** 0–100. */
    value: number;
    size?: number;
    label?: string;
    className?: string;
}

/**
 * Circular match indicator.
 *
 * The percentage is rendered as text in the mono role, not implied by arc
 * length, so the value is readable without relying on visual estimation.
 */
export function MatchRing({ value, size = 52, label = 'match', className }: MatchRingProps) {
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    const stroke = 3;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const dash = (clamped / 100) * circumference;

    return (
        <div
            className={cn('relative inline-flex items-center justify-center', className)}
            style={{ width: size, height: size }}
            role="img"
            aria-label={`${clamped}% ${label}`}
        >
            <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.10)"
                    strokeWidth={stroke}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={palette.champagne}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${circumference}`}
                />
            </svg>
            <span className="absolute font-data text-[0.6875rem] font-medium text-white">
                {clamped}%
            </span>
        </div>
    );
}
