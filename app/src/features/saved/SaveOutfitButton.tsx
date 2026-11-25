import { Heart } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useSavedOutfitsStore } from '@/store/savedOutfitsStore';

interface SaveOutfitButtonProps {
    outfitId: string;
    outfitName: string;
    removeLabel?: boolean;
    className?: string;
}

export function SaveOutfitButton({
    outfitId, outfitName, removeLabel = false, className,
}: SaveOutfitButtonProps) {
    const saved = useSavedOutfitsStore((state) => state.outfitIds.includes(outfitId));
    const toggleOutfit = useSavedOutfitsStore((state) => state.toggleOutfit);

    return (
        <button
            type="button"
            onClick={() => toggleOutfit(outfitId)}
            aria-label={removeLabel ? `Remove ${outfitName} from saved outfits` : `Save ${outfitName}`}
            aria-pressed={removeLabel ? undefined : saved}
            className={cn(
                'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-pill border px-3 text-xs font-medium',
                'transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-champagne',
                saved
                    ? 'border-champagne/45 bg-champagne/10 text-champagne hover:bg-champagne/20'
                    : 'border-white/15 bg-white/[0.03] text-obsidian-50 hover:border-champagne/45 hover:text-champagne',
                className,
            )}
        >
            <Heart className={cn('h-4 w-4', saved && 'fill-current')} aria-hidden="true" />
            {removeLabel ? 'Remove' : saved ? 'Saved' : 'Save'}
        </button>
    );
}
