import { cn } from '@/lib/cn';
import { formatUsd } from '@/lib/format';
import { palette } from '@/styles/tokens';

interface BudgetMeterProps {
    total: number;
    budget: number;
    /** False when an item price is unknown, so the total is a lower bound. */
    priceComplete?: boolean;
    className?: string;
    compact?: boolean;
}

type Fit = 'comfortable' | 'tight' | 'over';

const FIT_LABEL: Record<Fit, string> = {
    comfortable: 'Comfortably within budget',
    tight: 'Close to your limit',
    over: 'Over budget',
};

function fitFor(total: number, budget: number): Fit {
    if (budget <= 0) return 'comfortable';
    const ratio = total / budget;
    if (ratio > 1) return 'over';
    if (ratio > 0.85) return 'tight';
    return 'comfortable';
}

const FIT_COLOR: Record<Fit, string> = {
    comfortable: palette.comfortable,
    tight: palette.tight,
    over: palette.over,
};

const FIT_TEXT: Record<Fit, string> = {
    comfortable: 'text-fit-comfortable',
    tight: 'text-fit-tight',
    over: 'text-fit-over',
};

/**
 * `$Total / $Budget` progress bar with semantic colour.
 *
 * The colour is reinforcement, never the only signal: the numeric ratio and an
 * accessible label carry the same information. When any item price is unknown
 * the total is explicitly prefixed, because a lower bound presented as a total
 * would be a small lie the user would eventually notice.
 */
export function BudgetMeter({
    total,
    budget,
    priceComplete = true,
    className,
    compact = false,
}: BudgetMeterProps) {
    const fit = fitFor(total, budget);
    const ratio = budget > 0 ? Math.min(total / budget, 1) : 0;
    const percent = Math.round(ratio * 100);

    return (
        <div className={cn('w-full', className)}>
            <div className="flex items-baseline justify-between gap-3">
                <span
                    className={cn('font-data font-medium', compact ? 'text-xs' : 'text-sm', FIT_TEXT[fit])}
                >
                    {priceComplete ? '' : 'from '}
                    {formatUsd(total)}
                    <span className="text-obsidian-400 font-normal"> / {formatUsd(budget)}</span>
                </span>
                <span className="font-data text-[0.6875rem] text-obsidian-500">{percent}%</span>
            </div>

            <div
                className="mt-2 h-1 w-full overflow-hidden rounded-pill bg-white/10"
                role="meter"
                aria-valuenow={total}
                aria-valuemin={0}
                aria-valuemax={budget}
                aria-label={`${FIT_LABEL[fit]} — ${formatUsd(total)} of ${formatUsd(budget)}${priceComplete ? '' : ' (excluding unavailable prices)'
                    }`}
            >
                <div
                    className="h-full rounded-pill transition-[width] duration-300"
                    style={{ width: `${percent}%`, background: FIT_COLOR[fit] }}
                />
            </div>

            {!priceComplete && (
                <p className="mt-1.5 text-[0.6875rem] text-obsidian-500">
                    Excludes items with no listed price.
                </p>
            )}
        </div>
    );
}
