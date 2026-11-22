import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '@/App';
import { usePreferencesStore } from '@/store/preferencesStore';
import { EMPTY_PREFERENCES } from '@/types/domain';
import { catalog } from '@/data/catalog';

/**
 * Sprint 3 UI integration: the two optional preference controls, garment imagery on
 * result cards, and the shoulder-tracking control inside the AR tab.
 *
 * These are the parts a reviewer clicks, as opposed to the pure logic covered in
 * `departmentRetailers.test.ts` and `shoulderTracking.test.ts`.
 */

function renderAt(path = '/preferences') {
    return render(
        <MemoryRouter
            initialEntries={[path]}
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
            <App />
        </MemoryRouter>,
    );
}

async function completeRequired(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /^Work/i }));
    await user.click(screen.getByRole('button', { name: /^Business Formal — /i }));
    await user.type(screen.getByLabelText(/total clothing budget/i), '400');
    await user.click(screen.getByRole('button', { name: /^Classic$/i }));
    await user.click(screen.getByRole('button', { name: /no color preference/i }));
}

function fakeStream() {
    const stop = vi.fn();
    const stream = {
        getTracks: () => [{ stop }, { stop }],
        getVideoTracks: () => [{ stop }],
    } as unknown as MediaStream;
    return { stream, stop };
}

function installCamera() {
    const { stream, stop } = fakeStream();
    const getUserMedia = vi.fn(() => Promise.resolve(stream));
    Object.defineProperty(window.navigator, 'mediaDevices', {
        configurable: true,
        writable: true,
        value: { getUserMedia },
    });
    return { getUserMedia, stop };
}

beforeEach(() => {
    usePreferencesStore.getState().reset();
    window.localStorage.clear();
});

afterEach(() => {
    Reflect.deleteProperty(window.navigator as unknown as Record<string, unknown>, 'mediaDevices');
});

describe('department selector (Sprint 3)', () => {
    it('renders three options with All selected by default', () => {
        renderAt();

        const group = screen.getByRole('group', { name: /department/i });
        const buttons = within(group).getAllByRole('button');
        expect(buttons).toHaveLength(3);

        expect(screen.getByRole('button', { name: /^All/i })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
        expect(screen.getByRole('button', { name: /^Womenswear/i })).toHaveAttribute(
            'aria-pressed',
            'false',
        );
    });

    it('is optional — generation succeeds without touching it', async () => {
        const user = userEvent.setup();
        renderAt();

        await completeRequired(user);
        await user.click(screen.getByRole('button', { name: /generate outfits/i }));

        // No validation complaint about department, and results appear.
        expect(await screen.findByRole('list', { name: /recommended outfits/i })).toBeVisible();
        expect(usePreferencesStore.getState().preferences.department).toBe('All');
        expect(screen.queryByText(/choose a department/i)).toBeNull();
    });

    it('selecting a department persists and narrows results', async () => {
        const user = userEvent.setup();
        renderAt();

        await user.click(screen.getByRole('button', { name: /^Menswear/i }));
        expect(usePreferencesStore.getState().preferences.department).toBe('Menswear');

        await completeRequired(user);
        await user.click(screen.getByRole('button', { name: /generate outfits/i }));
        await screen.findByRole('list', { name: /recommended outfits/i });

        const results = usePreferencesStore.getState().results;
        expect(results.length).toBeGreaterThan(0);
        for (const entry of results) {
            expect(entry.outfit.department).toBe('Menswear');
        }
    });

    it('survives a round trip to results and back', async () => {
        const user = userEvent.setup();
        renderAt();

        await user.click(screen.getByRole('button', { name: /^Womenswear/i }));
        await completeRequired(user);
        await user.click(screen.getByRole('button', { name: /generate outfits/i }));
        await screen.findByRole('list', { name: /recommended outfits/i });

        await user.click(screen.getByRole('button', { name: /edit preferences/i }));

        expect(screen.getByRole('button', { name: /^Womenswear/i })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
    });
});

describe('retailer selector (Sprint 3)', () => {
    it('lists the shops that actually exist in the catalog', () => {
        renderAt();
        const group = screen.getByRole('group', { name: /preferred retailers/i });
        const buttons = within(group).getAllByRole('button');

        const catalogRetailers = new Set(catalog.products.map((product) => product.retailer));
        expect(buttons).toHaveLength(catalogRetailers.size);

        // No shop is offered that sells nothing.
        for (const retailer of catalogRetailers) {
            expect(within(group).getByRole('button', { name: new RegExp(`^${retailer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })).toBeVisible();
        }
    });

    it('starts unfiltered and explains that no shop filter is active', () => {
        renderAt();
        expect(screen.getByText(/no filter — every shop/i)).toBeVisible();
        // The clear affordance is hidden when there is nothing to clear.
        expect(
            screen.queryByRole('button', { name: /include all retailers/i }),
        ).toBeNull();
    });

    it('toggles a shop on and off', async () => {
        const user = userEvent.setup();
        renderAt();

        const group = screen.getByRole('group', { name: /preferred retailers/i });
        const zara = within(group).getByRole('button', { name: /^Zara$/i });

        await user.click(zara);
        expect(zara).toHaveAttribute('aria-pressed', 'true');
        expect(usePreferencesStore.getState().preferences.preferredRetailers).toEqual(['Zara']);

        await user.click(zara);
        expect(zara).toHaveAttribute('aria-pressed', 'false');
        expect(usePreferencesStore.getState().preferences.preferredRetailers).toEqual([]);
    });

    it('offers a one-click clear that returns to all retailers', async () => {
        const user = userEvent.setup();
        renderAt();

        const group = screen.getByRole('group', { name: /preferred retailers/i });
        await user.click(within(group).getByRole('button', { name: /^Zara$/i }));

        await user.click(screen.getByRole('button', { name: /include all retailers/i }));
        expect(usePreferencesStore.getState().preferences.preferredRetailers).toEqual([]);
    });

    it('filters results and exposes the relax escape hatch when nothing matches', async () => {
        const user = userEvent.setup();

        // Menswear + Mejuri (jewellery only) is a genuine dead end.
        await user.click(renderAt() && screen.getByRole('button', { name: /^Menswear/i }));
        await completeRequired(user);

        const group = screen.getByRole('group', { name: /preferred retailers/i });
        await user.click(within(group).getByRole('button', { name: /^Mejuri$/i }));

        await user.click(screen.getByRole('button', { name: /generate outfits/i }));

        // Empty state offers the retailer escape hatch specifically.
        const relax = await screen.findAllByRole('button', { name: /show \d+ outfits?/i });
        expect(relax.length).toBeGreaterThan(0);

        const includeAll = await screen.findByText(/include all retailers/i);
        expect(includeAll).toBeVisible();
    });
});

describe('garment imagery on result cards (Sprint 3)', () => {
    it('renders a visual for the hero and for each listed piece', async () => {
        const user = userEvent.setup();
        renderAt();

        await completeRequired(user);
        await user.click(screen.getByRole('button', { name: /generate outfits/i }));

        const grid = await screen.findByRole('list', { name: /recommended outfits/i });
        const firstCard = within(grid).getAllByRole('listitem')[0];

        // Every piece contributes a labelled outlined figure, because the catalog
        // carries no photography. No <img> with a missing src is rendered.
        const figures = within(firstCard).getAllByRole('img');
        expect(figures.length).toBeGreaterThan(0);
        const brokenImages = firstCard.querySelectorAll('img:not([src]), img[src=""]');
        expect(brokenImages).toHaveLength(0);
    });

    it('states the piece count, including pieces beyond the thumbnail strip', async () => {
        const user = userEvent.setup();
        renderAt();

        await completeRequired(user);
        await user.click(screen.getByRole('button', { name: /generate outfits/i }));

        const grid = await screen.findByRole('list', { name: /recommended outfits/i });
        const firstCard = within(grid).getAllByRole('listitem')[0];
        expect(within(firstCard).getByText(/\d+ pieces/i)).toBeVisible();
    });
});

describe('shoulder tracking control (Sprint 3)', () => {
    it('is absent in silhouette mode because there is nothing to track', async () => {
        const user = userEvent.setup();
        usePreferencesStore.setState({
            preferences: {
                ...EMPTY_PREFERENCES,
                occasion: 'Work',
                dressCode: 'Business Formal',
                budgetInput: '400',
                budget: 400,
                styles: ['Classic'],
                colors: ['Navy'],
            },
        });
        usePreferencesStore.getState().generate();

        renderAt('/results/o-08/preview');
        await user.click(await screen.findByRole('tab', { name: /ar try-on/i }));
        await user.click(await screen.findByRole('button', { name: /use silhouette mode/i }));

        await screen.findByTestId('ar-silhouette');
        expect(screen.queryByRole('heading', { name: /automatic shoulder tracking/i })).toBeNull();
        expect(screen.queryByTestId('tracking-status')).toBeNull();
    });

    it('appears in camera mode with a toggle, and keeps the manual sliders', async () => {
        installCamera();
        const user = userEvent.setup();
        usePreferencesStore.setState({
            preferences: {
                ...EMPTY_PREFERENCES,
                occasion: 'Work',
                dressCode: 'Business Formal',
                budgetInput: '400',
                budget: 400,
                styles: ['Classic'],
                colors: ['Navy'],
            },
        });
        usePreferencesStore.getState().generate();

        renderAt('/results/o-08/preview');
        await user.click(await screen.findByRole('tab', { name: /ar try-on/i }));
        await user.click(await screen.findByRole('button', { name: /enable camera/i }));

        await waitFor(() => {
            expect(screen.getByTestId('ar-stage').getAttribute('data-stage-mode')).toBe('camera');
            expect(screen.getByRole('heading', { name: /automatic shoulder tracking/i })).toBeVisible();
        });

        // Tracking is on by default and can be switched off.
        const toggle = screen.getByRole('button', { name: /tracking on/i });
        expect(toggle).toHaveAttribute('aria-pressed', 'true');
        await user.click(toggle);
        expect(screen.getByRole('button', { name: /tracking off/i })).toHaveAttribute(
            'aria-pressed',
            'false',
        );

        // The manual override still exists alongside it — this is the requirement
        // that automatic tracking must not replace manual control.
        expect(screen.getByLabelText(/scale/i)).toBeVisible();
        expect(screen.getByLabelText(/opacity/i)).toBeVisible();
    });

    it('a manual slider adjustment suspends auto-follow and offers Resume', async () => {
        installCamera();
        const user = userEvent.setup();
        usePreferencesStore.setState({
            preferences: {
                ...EMPTY_PREFERENCES,
                occasion: 'Work',
                dressCode: 'Business Formal',
                budgetInput: '400',
                budget: 400,
                styles: ['Classic'],
                colors: ['Navy'],
            },
        });
        usePreferencesStore.getState().generate();

        renderAt('/results/o-08/preview');
        await user.click(await screen.findByRole('tab', { name: /ar try-on/i }));
        await user.click(await screen.findByRole('button', { name: /enable camera/i }));

        await waitFor(() => {
            expect(screen.getByTestId('ar-stage').getAttribute('data-stage-mode')).toBe('camera');
        });

        fireEvent.change(screen.getByLabelText(/scale/i), { target: { value: '130' } });

        // Control has been handed back to the user.
        expect(
            await screen.findByText(/paused while you align it by hand/i),
        ).toBeVisible();
        expect(screen.getByRole('button', { name: /resume tracking/i })).toBeVisible();
        expect(screen.getByTestId('tracking-status')).toHaveAttribute(
            'data-tracking-status',
            'off',
        );
    });
});
