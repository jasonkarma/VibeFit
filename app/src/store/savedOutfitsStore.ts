import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { catalog } from '@/data/catalog';

interface SavedOutfitsState {
    outfitIds: string[];
    toggleOutfit: (id: string) => void;
}

const catalogIds = new Set(catalog.outfits.map((outfit) => outfit.id));

export const useSavedOutfitsStore = create<SavedOutfitsState>()(
    persist(
        (set) => ({
            outfitIds: [],
            toggleOutfit: (id) => {
                if (!catalogIds.has(id)) return;
                set(({ outfitIds }) => ({
                    outfitIds: outfitIds.includes(id)
                        ? outfitIds.filter((savedId) => savedId !== id)
                        : [id, ...outfitIds],
                }));
            },
        }),
        {
            name: 'vibefit:saved-outfits',
            partialize: ({ outfitIds }) => ({ outfitIds }),
            merge: (persisted, current) => {
                const saved = (persisted as { outfitIds?: unknown } | undefined)?.outfitIds;
                if (!Array.isArray(saved)) return current;

                const ids = saved.filter((id): id is string => typeof id === 'string' && catalogIds.has(id));
                return { ...current, outfitIds: [...new Set(ids)] };
            },
        },
    ),
);
