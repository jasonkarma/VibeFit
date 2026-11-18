import type { ReactNode } from 'react';
import { AmbientBackground } from './AmbientBackground';
import { Header } from './Header';

interface AppShellProps {
    children: ReactNode;
    homeHref?: string;
}

/**
 * Persistent chrome around every route: ambient mesh, masthead, content column.
 */
export function AppShell({ children, homeHref }: AppShellProps) {
    return (
        <>
            <AmbientBackground />
            <div className="flex min-h-screen flex-col">
                <Header homeHref={homeHref} />
                <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-32">{children}</main>
                <footer className="mx-auto w-full max-w-6xl px-6 pb-8">
                    <p className="text-center text-[0.6875rem] leading-relaxed text-obsidian-500">
                        Prototype for MSIS-609. Prices are curated sample data, not live retailer pricing.
                        Purchases happen on retailer sites.
                    </p>
                </footer>
            </div>
        </>
    );
}
