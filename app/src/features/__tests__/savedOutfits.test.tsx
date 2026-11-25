import { beforeEach, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '@/App';
import { EMPTY_PREFERENCES } from '@/types/domain';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useSavedOutfitsStore } from '@/store/savedOutfitsStore';

function renderAt(path: string) {
    return render(
        <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <App />
        </MemoryRouter>,
    );
}

beforeEach(() => {
    usePreferencesStore.getState().reset();
    useSavedOutfitsStore.persist.clearStorage();
    useSavedOutfitsStore.setState({ outfitIds: [] });
});

it('saves from recommendations and reflects the same favorite in outfit details and the saved list', async () => {
    const user = userEvent.setup();
    usePreferencesStore.getState().applyPatch({
        ...EMPTY_PREFERENCES,
        occasion: 'Work',
        dressCode: 'Smart Casual',
        budget: 300,
        budgetInput: '300',
        department: 'Womenswear',
    });
    usePreferencesStore.getState().generate();
    const generation = usePreferencesStore.getState().lastGeneratedAt;
    renderAt('/results');

    const outfit = await screen.findByRole('article', { name: 'Neutral Layers' });
    const save = within(outfit).getByRole('button', { name: /^save neutral layers$/i });
    expect(save).toHaveAttribute('aria-pressed', 'false');
    await user.click(save);
    expect(save).toHaveAttribute('aria-pressed', 'true');

    await user.click(within(outfit).getByRole('button', { name: /view details for neutral layers/i }));
    expect(await screen.findByRole('button', { name: /^save neutral layers$/i }))
        .toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: /back to recommendations/i }));
    await screen.findByRole('list', { name: /recommended outfits/i });
    expect(usePreferencesStore.getState().lastGeneratedAt).toBe(generation);
    await user.click(screen.getByRole('link', { name: 'Saved Outfits' }));

    const savedList = await screen.findByRole('list', { name: 'Saved outfits' });
    expect(within(savedList).getAllByRole('article')).toHaveLength(1);
    expect(within(savedList).getByRole('article', { name: 'Neutral Layers' })).toBeVisible();
});

it('restores browser favorites without a recommendation session and lets users revisit or remove them', async () => {
    const user = userEvent.setup();
    const storageKey = useSavedOutfitsStore.persist.getOptions().name!;
    useSavedOutfitsStore.getState().toggleOutfit('o-12');
    const stored = localStorage.getItem(storageKey);
    expect(stored).not.toBeNull();

    useSavedOutfitsStore.setState({ outfitIds: [] });
    localStorage.setItem(storageKey, stored!);
    await useSavedOutfitsStore.persist.rehydrate();
    renderAt('/saved');

    await user.click(await screen.findByRole('button', { name: 'View details for Neutral Layers' }));
    expect(await screen.findByRole('heading', { name: 'Neutral Layers' })).toBeVisible();
    expect(screen.getByRole('list', { name: 'Garments in this outfit' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: /preview & ar try-on/i }));
    expect(await screen.findByRole('tab', { name: 'Combined look' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Close preview' }));
    await user.click(await screen.findByRole('button', { name: 'Back to Saved Outfits' }));

    await user.click(await screen.findByRole('button', { name: 'Remove Neutral Layers from saved outfits' }));
    expect(await screen.findByText('No saved outfits yet')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Find outfits' })).toHaveAttribute('href', '/preferences');
    expect(JSON.parse(localStorage.getItem(storageKey)!).state.outfitIds).toEqual([]);
});
