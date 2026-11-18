import { cn } from '@/lib/cn';

interface StepIndicatorProps {
    /** 1-based index of the current step. */
    current: 1 | 2;
    className?: string;
}

const STEPS = ['Preferences', 'Recommendations'] as const;

/**
 * Two-step progress rail.
 *
 * The current step is marked with `aria-current="step"`, and completion is
 * stated in text, not colour alone.
 */
export function StepIndicator({ current, className }: StepIndicatorProps) {
    return (
        <nav aria-label="Progress" className={cn('mb-8', className)}>
            <ol className="flex items-center gap-3">
                {STEPS.map((label, index) => {
                    const step = (index + 1) as 1 | 2;
                    const isCurrent = step === current;
                    const isDone = step < current;

                    return (
                        <li key={label} className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <span
                                    className={cn(
                                        'flex h-6 w-6 items-center justify-center rounded-full font-data text-[0.6875rem]',
                                        'border transition-colors',
                                        isCurrent && 'border-champagne bg-champagne text-obsidian',
                                        isDone && 'border-champagne/50 bg-champagne/15 text-champagne',
                                        !isCurrent && !isDone && 'border-white/15 text-obsidian-500',
                                    )}
                                    aria-hidden="true"
                                >
                                    {step}
                                </span>
                                <span
                                    aria-current={isCurrent ? 'step' : undefined}
                                    className={cn(
                                        'text-[0.8125rem] uppercase tracking-[0.08em]',
                                        isCurrent ? 'text-white' : 'text-obsidian-500',
                                    )}
                                >
                                    {label}
                                    {isDone && <span className="sr-only"> (completed)</span>}
                                </span>
                            </div>
                            {index < STEPS.length - 1 && (
                                <span
                                    className={cn(
                                        'h-px w-8',
                                        isDone ? 'bg-champagne/50' : 'bg-white/10',
                                    )}
                                    aria-hidden="true"
                                />
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
