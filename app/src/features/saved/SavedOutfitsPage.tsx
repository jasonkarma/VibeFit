import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Heart } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { PageTransition } from '@/components/ui/PageTransition';
import { catalog } from '@/data/catalog';
import { rankedOutfitById } from '@/engine/lookup';
import { useMotion } from '@/lib/motion';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useSavedOutfitsStore } from '@/store/savedOutfitsStore';
import { EMPTY_PREFERENCES, type RankedOutfit } from '@/types/domain';
import { OutfitCard } from '@/features/results/OutfitCard';

export function SavedOutfitsPage() {
    const ids = useSavedOutfitsStore((state) => state.outfitIds);
    const hasRecommendations = usePreferencesStore((state) => state.lastGeneratedAt !== null &&
        Boolean(state.preferences.occasion && state.preferences.dressCode && state.preferences.budget));
    const entries = useMemo(() => ids
        .map((id) => rankedOutfitById(id, EMPTY_PREFERENCES, catalog))
        .filter((entry): entry is RankedOutfit => entry !== null), [ids]);
    const { container } = useMotion();
    const navigate = useNavigate();

    return (
        <PageTransition>
            <header className="mb-8">
                <h1 className="font-display text-4xl leading-tight text-white sm:text-5xl">Saved Outfits</h1>
                {entries.length > 0 && (
                    <p aria-live="polite" className="mt-2 text-sm text-obsidian-400">
                        {entries.length} {entries.length === 1 ? 'outfit' : 'outfits'}
                    </p>
                )}
            </header>

            {entries.length > 0 ? (
                <motion.ul
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                    aria-label="Saved outfits"
                >
                    {entries.map((entry, index) => (
                        <li key={entry.outfit.id}>
                            <OutfitCard
                                entry={entry}
                                index={index}
                                collectionPath="/saved"
                                onOpen={() => navigate(`/saved/${entry.outfit.id}`)}
                            />
                        </li>
                    ))}
                </motion.ul>
            ) : (
                <section className="mx-auto max-w-lg rounded-surface border border-white/10 bg-white/[0.03] px-6 py-12 text-center sm:px-10">
                    <Heart className="mx-auto h-6 w-6 text-champagne" aria-hidden="true" />
                    <h2 className="mt-4 font-display text-2xl text-white">No saved outfits yet</h2>
                    <p className="mt-2 text-sm text-obsidian-400">Save an outfit from your recommendations to find it here.</p>
                    <Link
                        to={hasRecommendations ? '/results' : '/preferences'}
                        className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-pill bg-champagne px-4 text-sm font-semibold text-obsidian hover:bg-champagne-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-champagne"
                    >
                        {hasRecommendations ? 'View recommendations' : 'Find outfits'}
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                </section>
            )}
        </PageTransition>
    );
}
