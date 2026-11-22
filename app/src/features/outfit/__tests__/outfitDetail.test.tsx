import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '@/App';
import { usePreferencesStore } from '@/store/preferencesStore';
import { catalog } from '@/data/catalog';
import { rankedOutfitById } from '@/engine/lookup';
import { EMPTY_PREFERENCES, NO_COLOR_PREFERENCE } from '@/types/domain';

/**
 * Stories 6, 7 and 8 at the UI level.
 *
 * These assert what a reviewer sees: the route opens, every piece is listed, a null
 * price reads "Price Unavailable", a null URL produces *no anchor at all*, and going
 * back does not disturb the cached result set.
 *
 * Helper note: preferences are written straight into the store rather than clicked
 * through the form. The form journey is already covered end-to-end in
 * `flow.test.tsx`; re-driving it here would slow these tests down without adding
 * coverage.
 */

function renderAt(path: string) {
    return render(
        <MemoryRouter
            initialEntries={[path]}
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
            <App />
        </MemoryRouter>,
    );
}

/** Work / Business Formal / $400 — surfaces o-08 and o-21. */
function seedWorkPreferences(budget = 400) {
    usePreferencesStore.setState({
        preferences: {
            ...EMPTY_PREFERENCES,
            occasion: 'Work',
            dressCode: 'Business Formal',
            budgetInput: String(budget),
            budget: budget,
            styles: ['Classic'],
            colors: ['Navy'],
        },
    });
}

/** Preferences for the outfit with unknown-price linen trousers. */
function seedPartialPricePreferences() {
    usePreferencesStore.setState({
        preferences: {
            ...EMPTY_PREFERENCES,
            occasion: 'Wedding',
            dressCode: 'Cocktail',
            budgetInput: '300',
            budget: 300,
            styles: ['Minimalist', 'Bohemian'],
            colors: [NO_COLOR_PREFERENCE],
        },
    });
}

beforeEach(() => {
    usePreferencesStore.getState().reset();
});

describe('Story 6 — outfit details', () => {
    it('opens the detail route from a result card (AC 6.1)', async () => {
        const user = userEvent.setup();
        seedWorkPreferences();
        usePreferencesStore.getState().generate();

        renderAt('/results');
        const grid = await screen.findByRole('list', { name: /recommended outfits/i });
        const firstCard = within(grid).getAllByRole('listitem')[0];

        const button = within(firstCard).getByRole('button');
        const label = button.getAttribute('aria-label') ?? '';
        expect(label).toMatch(/view details for/i);

        await user.click(button);

        // The detail page announces itself with the garment list, not just a heading.
        expect(
            await screen.findByRole('list', { name: /garments in this outfit/i }),
        ).toBeVisible();
        expect(
            screen.getByRole('button', { name: /back to recommendations/i }),
        ).toBeVisible();
    });

    it('renders the header, styling rationale and budget breakdown (AC 6.2)', async () => {
        seedWorkPreferences();
        usePreferencesStore.getState().generate();

        renderAt('/results/o-08');

        expect(
            await screen.findByRole('heading', { level: 1, name: /boardroom standard/i }),
        ).toBeVisible();

        // Rationale panel with an explicit provenance badge.
        const rationale = screen.getByRole('region', { name: /why this outfit/i });
        expect(rationale).toBeVisible();
        // No live key in tests, so provenance must honestly say local.
        expect(within(rationale).getByText(/local engine/i)).toBeVisible();

        // Budget-fit breakdown.
        expect(screen.getByRole('heading', { name: /total outfit price/i })).toBeVisible();
        expect(screen.getByRole('meter')).toBeVisible();
    });

    it('lists every garment piece with a product photo (AC 6.3)', async () => {
        seedWorkPreferences();
        usePreferencesStore.getState().generate();

        renderAt('/results/o-08');

        const list = await screen.findByRole('list', { name: /garments in this outfit/i });
        const outfit = catalog.outfits.find((entry) => entry.id === 'o-08')!;

        expect(within(list).getAllByRole('listitem')).toHaveLength(outfit.itemIds.length);

        expect(within(list).getAllByRole('img')).toHaveLength(outfit.itemIds.length);
        expect(within(list).queryByText(/prototype visual/i)).toBeNull();
        expect(within(list).getByRole('img', { name: 'Whitney Weejuns Penny Loafer · Black' }))
            .toHaveAttribute('src', '/catalog/ghbass-whitney-weejuns-black.jpg');

        for (const itemId of outfit.itemIds) {
            expect(list.querySelector(`[data-testid="outfit-item-${itemId}"]`)).not.toBeNull();
        }
    });

    it('preserves preferences AND the cached result set on back navigation (AC 6.4)', async () => {
        const user = userEvent.setup();
        seedWorkPreferences();
        usePreferencesStore.getState().generate();

        const before = usePreferencesStore.getState();
        const generatedAt = before.lastGeneratedAt;
        const resultIds = before.results.map((entry) => entry.outfit.id);

        renderAt('/results');
        await screen.findByRole('list', { name: /recommended outfits/i });

        // Open the first outfit, then come back.
        const grid = screen.getByRole('list', { name: /recommended outfits/i });
        await user.click(within(within(grid).getAllByRole('listitem')[0]).getByRole('button'));
        await screen.findByRole('list', { name: /garments in this outfit/i });

        await user.click(screen.getByRole('button', { name: /back to recommendations/i }));

        const afterGrid = await screen.findByRole('list', { name: /recommended outfits/i });
        expect(afterGrid).toBeVisible();

        const after = usePreferencesStore.getState();
        // Preferences untouched.
        expect(after.preferences.occasion).toBe('Work');
        expect(after.preferences.dressCode).toBe('Business Formal');
        expect(after.preferences.budget).toBe(400);
        // The cached generation is byte-identical: same timestamp, same outfits.
        expect(after.lastGeneratedAt).toBe(generatedAt);
        expect(after.results.map((entry) => entry.outfit.id)).toEqual(resultIds);
    });

    it('resolves a deep link with a cold result cache (D10 fallback)', async () => {
        // Preferences present, but no generated results — a refresh or new tab.
        seedWorkPreferences();
        expect(usePreferencesStore.getState().results).toEqual([]);

        renderAt('/results/o-21');

        expect(
            await screen.findByRole('heading', { level: 1, name: /poplin standard/i }),
        ).toBeVisible();
        expect(screen.getByRole('list', { name: /garments in this outfit/i })).toBeVisible();
    });

    it('shows an explicit not-found state for an unknown outfit id', async () => {
        seedWorkPreferences();

        renderAt('/results/o-does-not-exist');

        expect(
            await screen.findByRole('heading', { name: /couldn.t find that outfit/i }),
        ).toBeVisible();
        expect(
            screen.getByRole('button', { name: /back to recommendations/i }),
        ).toBeVisible();
    });

    it('redirects to preferences when the route is opened with no inputs', async () => {
        renderAt('/results/o-08');
        expect(await screen.findByText(/tell us about the occasion/i)).toBeVisible();
    });
});

describe('Story 7 — itemised USD pricing', () => {
    it('renders each known price as $XX.XX in the mono role (AC 7.1)', async () => {
        seedWorkPreferences();
        usePreferencesStore.getState().generate();

        renderAt('/results/o-08');

        const list = await screen.findByRole('list', { name: /garments in this outfit/i });
        const outfit = catalog.outfits.find((entry) => entry.id === 'o-08')!;

        for (const itemId of outfit.itemIds) {
            const product = catalog.products.find((entry) => entry.id === itemId)!;
            if (product.price === null) continue;

            const card = list.querySelector(`[data-testid="outfit-item-${itemId}"]`)!;
            // e.g. $59.00 — two decimals, always a dollar sign.
            const expected = `$${product.price.toFixed(2)}`;
            const priceNode = within(card as HTMLElement).getByText(expected);
            expect(priceNode).toBeVisible();
            // Prices use the data face, per the design system.
            expect(priceNode.className).toContain('font-data');
        }
    });

    it('shows a complete total compared against the budget (AC 7.2)', async () => {
        seedWorkPreferences(400);
        usePreferencesStore.getState().generate();

        renderAt('/results/o-08');

        const total = await screen.findByTestId('outfit-total');
        // shirt 49 + blazer 119 + trousers 53 + loafers 195 + hoops 88.50
        expect(total).toHaveTextContent('$504.50');

        expect(screen.getByRole('heading', { name: /total outfit price/i })).toBeVisible();
        // $504.50 against a $400 budget is over.
        expect(screen.getByTestId('budget-verdict')).toHaveTextContent(/over your budget/i);
        expect(screen.queryByTestId('partial-total-notice')).toBeNull();
    });

    it('flags a partial total for the seeded null-price item (AC 7.3)', async () => {
        seedPartialPricePreferences();
        usePreferencesStore.getState().generate();

        renderAt('/results/o-18');

        const list = await screen.findByRole('list', { name: /garments in this outfit/i });

        // The item row says Price Unavailable and shows no dollar figure at all.
        const linenCard = list.querySelector('[data-testid="outfit-item-p-linen-trouser"]');
        expect(linenCard).not.toBeNull();
        expect(within(linenCard as HTMLElement).getByText('Price Unavailable')).toBeVisible();
        expect(linenCard!.getAttribute('data-price-known')).toBe('false');

        // No "$" anywhere in that card. This is the assertion that stops a future
        // refactor from quietly substituting $0.00.
        expect((linenCard as HTMLElement).textContent).not.toMatch(/\$\s?\d/);

        // The total is labelled as a lower bound, not as a total.
        expect(screen.getByRole('heading', { name: /known subtotal/i })).toBeVisible();
        expect(screen.getAllByTestId('partial-total-notice')[0]).toHaveTextContent(
            /lower bound/i,
        );
        // Camisole 41 + sandals 101 + scarf 32 = 174.
        expect(screen.getByTestId('outfit-total')).toHaveTextContent('$174.00');
        // No budget verdict is offered, because the real cost is unknown.
        expect(screen.queryByTestId('budget-verdict')).toBeNull();
    });

    it('shows the Sample Price retrieval indicator on every known price (AC 7.4)', async () => {
        seedWorkPreferences();
        usePreferencesStore.getState().generate();

        renderAt('/results/o-08');

        const list = await screen.findByRole('list', { name: /garments in this outfit/i });
        const labels = within(list).getAllByText(/sample price • retrieved/i);
        expect(labels.length).toBeGreaterThan(0);
        expect(labels[0]).toHaveTextContent('Sample Price • Retrieved 2026-11-22');
    });
});

describe('Story 8 — retailer shopping links', () => {
    it('renders a safe external link per item with a URL (AC 8b.1)', async () => {
        seedWorkPreferences();
        usePreferencesStore.getState().generate();

        renderAt('/results/o-08');

        const list = await screen.findByRole('list', { name: /garments in this outfit/i });

        const poplinCard = list.querySelector('[data-testid="outfit-item-p-poplin"]') as HTMLElement;
        const link = within(poplinCard).getByRole('link', { name: /view item at everlane/i });

        expect(link).toHaveAttribute('href', 'https://www.everlane.com/products/womens-relaxed-oxford-shirt-white');
        expect(link).toHaveAttribute('target', '_blank');
        // `noopener` prevents tabnabbing; `noreferrer` stops referrer leakage.
        expect(link.getAttribute('rel')).toContain('noopener');
        expect(link.getAttribute('rel')).toContain('noreferrer');
    });

    it('suppresses the link entirely for the seeded null-URL item (AC 8b.2)', async () => {
        seedWorkPreferences();
        usePreferencesStore.getState().generate();

        const entry = rankedOutfitById('o-08', usePreferencesStore.getState().preferences, catalog)!;
        usePreferencesStore.setState({
            results: [{ ...entry, items: entry.items.map((item) =>
                item.id === 'p-hoops' ? { ...item, productUrl: null } : item,
            ) }],
        });

        renderAt('/results/o-08');

        const list = await screen.findByRole('list', { name: /garments in this outfit/i });
        const hoopsCard = list.querySelector('[data-testid="outfit-item-p-hoops"]') as HTMLElement;

        expect(hoopsCard).not.toBeNull();
        expect(within(hoopsCard).getByTestId('link-unavailable-p-hoops')).toBeVisible();
        expect(within(hoopsCard).getByText('Link Unavailable')).toBeVisible();

        // Not one anchor in the card — not even a disabled-looking one.
        expect(within(hoopsCard).queryAllByRole('link')).toHaveLength(0);
        expect(hoopsCard.querySelector('a')).toBeNull();
        expect(hoopsCard.getAttribute('data-link-available')).toBe('false');
    });
});

describe('Story 10 — preview entry point', () => {
    it('offers Preview & AR Try-On only when the outfit has a supported garment', async () => {
        seedWorkPreferences();
        usePreferencesStore.getState().generate();

        // o-08 contains the wool blazer → AR CTA present.
        const { unmount } = renderAt('/results/o-08');
        expect(
            await screen.findByRole('button', { name: /preview & ar try-on/i }),
        ).toBeVisible();
        unmount();

        // o-21 is poplin + chino + loafers → no AR garment, so no CTA and no dead end.
        renderAt('/results/o-21');
        await screen.findByRole('heading', { level: 1, name: /poplin standard/i });
        expect(
            screen.queryByRole('button', { name: /preview & ar try-on/i }),
        ).toBeNull();
    });

    it('navigates from the detail screen into the preview route (AC 10.1)', async () => {
        const user = userEvent.setup();
        seedWorkPreferences();
        usePreferencesStore.getState().generate();

        renderAt('/results/o-08');

        await user.click(
            await screen.findByRole('button', { name: /preview & ar try-on/i }),
        );

        expect(await screen.findByRole('tablist', { name: /preview mode/i })).toBeVisible();
        expect(screen.getByRole('tab', { name: /combined look/i })).toBeVisible();
        expect(screen.getByRole('tab', { name: /ar try-on/i })).toBeVisible();
    });
});
