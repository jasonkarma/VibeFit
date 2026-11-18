import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

interface FieldErrorProps {
    /** Stable id so the input can point at it via `aria-describedby`. */
    id: string;
    children?: string;
    className?: string;
}

/**
 * Validation message with `role="alert"`.
 *
 * Rendered only when there is a message, so screen readers announce it at the
 * moment it appears. Colour is reinforced by an icon and explicit text — the
 * rose tint alone is never the signal.
 */
export function FieldError({ id, children, className }: FieldErrorProps) {
    if (!children) return null;

    return (
        <p
            id={id}
            role="alert"
            className={cn('mt-2 flex items-start gap-1.5 text-[0.8125rem] text-fit-over', className)}
        >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{children}</span>
        </p>
    );
}
