import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Glass surface primitive — the base of every card, dock, and panel.
 *
 * `as` exists so the element stays semantically appropriate: a list row should
 * render as `<li>`, a section header as `<section>`, never a `<div>` soup.
 */
type SurfaceElement = 'div' | 'section' | 'article' | 'aside' | 'li' | 'header' | 'footer';

interface SurfaceProps extends HTMLAttributes<HTMLElement> {
    as?: SurfaceElement;
    /** Slightly brighter glass, used for hover targets and open states. */
    elevated?: boolean;
    /** Champagne ring, used for the selected state of a selectable tile. */
    selected?: boolean;
    /** Removes padding so the consumer can control the internal layout. */
    bare?: boolean;
    children?: ReactNode;
}

export function Surface({
    as: Tag = 'div',
    elevated = false,
    selected = false,
    bare = false,
    className,
    children,
    ...rest
}: SurfaceProps) {
    return (
        <Tag
            className={cn(
                'relative rounded-surface border shadow-glass',
                'backdrop-blur-xl transition-colors duration-200',
                elevated ? 'bg-white/[0.05] border-white/[0.14]' : 'bg-white/[0.03] border-white/10',
                selected && 'border-champagne/60 shadow-glow-gold',
                !bare && 'p-5',
                className,
            )}
            {...rest}
        >
            {children}
        </Tag>
    );
}
