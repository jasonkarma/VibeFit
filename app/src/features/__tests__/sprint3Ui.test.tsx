import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '@/App';
import { usePreferencesStore } from '@/store/preferencesStore';
import { EMPTY_PREFERENCES } from '@/types/domain';
import { catalog } from '@/data/catalog';
import { rankedOutfitById } from '@/engine/lookup';

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
        const vans = within(group).getByRole('button', { name: /^Vans$/i });

        await user.click(vans);
        expect(vans).toHaveAttribute('aria-pressed', 'true');
        expect(usePreferencesStore.getState().preferences.preferredRetailers).toEqual(['Vans']);

        await user.click(vans);
        expect(vans).toHaveAttribute('aria-pressed', 'false');
        expect(usePreferencesStore.getState().preferences.preferredRetailers).toEqual([]);
    });

    it('offers a one-click clear that returns to all retailers', async () => {
        const user = userEvent.setup();
        renderAt();

        const group = screen.getByRole('group', { name: /preferred retailers/i });
        await user.click(within(group).getByRole('button', { name: /^Vans$/i }));

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
    it('shows every piece, with photos and shopping destinations on the recommendation itself', async () => {
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
        const entry = rankedOutfitById('o-08', usePreferencesStore.getState().preferences, catalog)!;
        const photoUrl = '/catalog/poplin-fixture.webp';
        const items = entry.items.map((item) =>
            item.id === 'p-poplin' ? { ...item, image: photoUrl } :
            item.id === 'p-hoops' ? { ...item, productUrl: null, retailerUrl: 'https://example.com/earrings' } :
            item.id === 'p-straight-trouser' ? { ...item, productUrl: null } : item,
        );
        usePreferencesStore.setState({ results: [{ ...entry, items }] });

        renderAt('/results');

        const card = await screen.findByRole('article', { name: entry.outfit.name });
        const pieces = within(card).getByRole('list', { name: `Products in ${entry.outfit.name}` });
        expect(within(pieces).getAllByRole('listitem')).toHaveLength(items.length);
        expect(within(card).getAllByRole('img', { name: 'Must-Have Oxford Shirt · White' })).toHaveLength(2);
        const photo = within(pieces).getByRole('img', { name: 'Must-Have Oxford Shirt · White' });
        expect(photo).toHaveAttribute('src', photoUrl);
        const shop = within(pieces).getByRole('link', { name: /view item at everlane.*must-have oxford shirt/i });
        expect(shop).toHaveAttribute('href', items.find((item) => item.id === 'p-poplin')!.productUrl);
        expect(shop).toHaveAttribute('target', '_blank');
        expect(shop).toHaveAttribute('rel', 'noopener noreferrer');
        expect(within(pieces).getByRole('link', { name: /browse mejuri.*bold huggie hoops/i }))
            .toHaveAttribute('href', 'https://example.com/earrings');
        expect(within(pieces).getAllByText('Link Unavailable')).toHaveLength(1);

        fireEvent.error(photo);
        expect(within(pieces).getByRole('img', { name: /must-have oxford shirt.*illustrative/i })).toBeVisible();
        expect(within(card).getByText(`${items.length} pieces`)).toBeVisible();
    });

    it('recommends all three verified Neutral Layers garments with product photos under $300', async () => {
        usePreferencesStore.setState({
            preferences: {
                ...EMPTY_PREFERENCES,
                occasion: 'Work',
                dressCode: 'Smart Casual',
                budgetInput: '300',
                budget: 300,
                department: 'Womenswear',
            },
        });
        usePreferencesStore.getState().generate();
        renderAt('/results');

        const card = await screen.findByRole('article', { name: 'Neutral Layers' });
        const list = within(card).getByRole('list', { name: 'Products in Neutral Layers' });
        const links = within(list).getAllByRole('link', { name: /^view item at/i });
        expect(links.map((link) => link.getAttribute('href'))).toEqual([
            'https://www.everlane.com/products/womens-cashmere-slim-crew-sweater-navy',
            'https://www.everlane.com/products/womens-wide-leg-pant-stretch-linen-trench-coat-khaki',
            'https://www.ghbass.com/products/women-whitney-weejuns-penny-loafer-black',
        ]);
        expect(within(list).getAllByRole('img').map((photo) => photo.getAttribute('src'))).toEqual([
            '/catalog/everlane-cashmere-slim-crew-navy.jpg',
            '/catalog/everlane-wide-leg-stretch-linen-khaki.jpg',
            '/catalog/ghbass-whitney-weejuns-black.jpg',
        ]);
        expect(usePreferencesStore.getState().results.find((entry) => entry.outfit.id === 'o-12'))
            .toMatchObject({ knownTotal: 295, priceComplete: true });
    });
});

it('shows the photographed wedding outfits and opens camera try-on without an expanded chat', async () => {
    const user = userEvent.setup();
    usePreferencesStore.setState({
        preferences: {
            ...EMPTY_PREFERENCES,
            occasion: 'Wedding',
            dressCode: 'Smart Casual',
            budgetInput: '456',
            budget: 456,
            styles: ['Trendy'],
        },
    });
    usePreferencesStore.getState().generate();
    renderAt('/results');

    const assistant = screen.getByText('Style assistant');
    const disclosure = assistant.closest('details');
    expect(disclosure).not.toHaveAttribute('open');
    await user.click(assistant);
    expect(disclosure).toHaveAttribute('open');
    await user.click(assistant);
    expect(disclosure).not.toHaveAttribute('open');

    for (const [name, photoCount] of [['Garden Formal', 3], ['Bomber Wedding', 4]] as const) {
        const card = screen.getByRole('article', { name });
        const products = within(card).getByRole('list', { name: `Products in ${name}` });
        expect(within(products).getAllByRole('link', { name: /^view item/i })).toHaveLength(photoCount);
        expect(products.querySelectorAll('img[src^="/catalog/"]')).toHaveLength(photoCount);
    }

    await user.click(screen.getByRole('link', { name: /try on garden formal with camera/i }));
    expect(await screen.findByRole('tab', { name: /ar try-on/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: /enable camera/i })).toBeVisible();
    await user.click(screen.getByRole('button', { name: /use silhouette mode/i }));
    expect(await screen.findByTestId('ar-overlay')).toHaveAttribute('src', '/catalog/p-garden-jersey-flat.jpg');
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

        expect(screen.getByTestId('overlay-value-offsetY')).toHaveTextContent('24%');
        expect(screen.getByTestId('overlay-value-scale')).toHaveTextContent('75%');
        const toggle = screen.getByRole('button', { name: /tracking on/i });
        expect(toggle).toHaveAttribute('aria-pressed', 'true');
        await user.click(toggle);
        expect(screen.getByRole('button', { name: /tracking off/i })).toHaveAttribute('aria-pressed', 'false');

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
