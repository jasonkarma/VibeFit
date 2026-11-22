import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

interface HeaderProps {
    /** Where the wordmark links to. Results screen points back to preferences. */
    homeHref?: string;
}

/**
 * Editorial masthead: serif wordmark, mono capability note, reset affordance.
 */
export function Header({ homeHref = '/preferences' }: HeaderProps) {
    return (
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-7">
            <Link
                to={homeHref}
                className="group flex items-baseline gap-2.5 rounded-md"
                aria-label="VibeFit home"
            >
                <span className="font-display text-2xl tracking-tight text-white">VibeFit</span>
                <span className="hidden font-data text-[0.625rem] uppercase tracking-[0.18em] text-obsidian-500 sm:inline">
                    AI Styling
                </span>
            </Link>

            <div className="flex items-center gap-2 rounded-pill border border-white/10 bg-white/[0.03] px-3 py-1.5 backdrop-blur-xl">
                <Sparkles className="h-3 w-3 text-violet" aria-hidden="true" />
                <span className="font-data text-[0.625rem] uppercase tracking-[0.12em] text-obsidian-400">
                    Sprint 2 Prototype
                </span>
            </div>
        </header>
    );
}
