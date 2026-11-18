import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface SectionHeadingProps {
    /** Step number, rendered in the mono role. */
    step?: number;
    title: string;
    description?: string;
    /** Story key for traceability during review, e.g. VIBE-11. */
    storyKey?: string;
    className?: string;
    children?: ReactNode;
}

/**
 * Section header with a story key so a reviewer can map any screen element back
 * to the Jira ticket it satisfies without opening the acceptance matrix.
 */
export function SectionHeading({
    step,
    title,
    description,
    storyKey,
    className,
    children,
}: SectionHeadingProps) {
    return (
        <div className={cn('mb-5', className)}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                {typeof step === 'number' && (
                    <span className="font-data text-[0.6875rem] text-champagne">
                        {String(step).padStart(2, '0')}
                    </span>
                )}
                <h2 className="font-display text-2xl text-white">{title}</h2>
                {storyKey && (
                    <span className="font-data text-[0.625rem] uppercase tracking-[0.1em] text-obsidian-500">
                        {storyKey}
                    </span>
                )}
            </div>
            {description && (
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-obsidian-400">
                    {description}
                </p>
            )}
            {children}
        </div>
    );
}
