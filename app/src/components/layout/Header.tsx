import { Link, NavLink } from 'react-router-dom';
import { Heart } from 'lucide-react';

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

            <nav aria-label="Main navigation">
                <NavLink
                    to="/saved"
                    className="flex min-h-11 items-center gap-2 rounded-pill border border-white/10 bg-white/[0.03] px-3 text-xs font-medium text-obsidian-50 transition-colors hover:border-champagne/45 hover:text-champagne focus-visible:outline focus-visible:outline-2 focus-visible:outline-champagne aria-[current=page]:border-champagne/45 aria-[current=page]:text-champagne"
                >
                    <Heart className="h-4 w-4" aria-hidden="true" />
                    Saved Outfits
                </NavLink>
            </nav>
        </header>
    );
}
