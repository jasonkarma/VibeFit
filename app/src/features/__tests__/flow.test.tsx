import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '@/App';
import { usePreferencesStore } from '@/store/preferencesStore';

/**
 * End-to-end journeys through the real app shell.
 *
 * These assert the UI-level acceptance criteria — visible labels, alert text,
 * retention after returning to edit, and the empty-state escape hatches — which
 * the engine tests cannot cover because they never touch the DOM.
 */

function renderApp(initialRoute = '/preferences') {
    return render(
        <MemoryRouter
            initialEntries={[initialRoute]}
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
            <App />
        </MemoryRouter>,
    );
}

async function completeFullPreferenceSet(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /^Wedding/i }));
    await user.click(screen.getByRole('button', { name: /^Cocktail — /i }));
    await user.type(screen.getByLabelText(/total clothing budget/i), '250');
    await user.click(screen.getByRole('button', { name: /^Bohemian/i }));
    await user.click(screen.getByRole('button', { name: /no color preference/i }));
}

describe('VIBE-11 — occasion selection', () => {
    beforeEach(() => usePreferencesStore.getState().reset());

    it('renders all four occasions (AC 11.1)', () => {
        renderApp();
        for (const occasion of ['Casual Outing', 'Work', 'Party', 'Wedding']) {
            expect(screen.getByRole('button', { name: new RegExp(`^${occasion}`, 'i') })).toBeVisible();
        }
    });

    it('marks the selected occasion with aria-pressed (AC 11.2)', async () => {
        const user = userEvent.setup();
        renderApp();

        const party = screen.getByRole('button', { name: /^Party/i });
        expect(party).toHaveAttribute('aria-pressed', 'false');

        await user.click(party);
        expect(party).toHaveAttribute('aria-pressed', 'true');
        expect(usePreferencesStore.getState().preferences.occasion).toBe('Party');
    });

    it('shows a clear validation message when occasion is missing (AC 11.3)', async () => {
        const user = userEvent.setup();
        renderApp();

        await user.click(screen.getByRole('button', { name: /generate outfits/i }));

        const alert = await screen.findByText(/pick an occasion so we can style/i);
        expect(alert).toBeVisible();
        // The message is announced, not merely coloured.
        expect(alert.closest('[role="alert"]')).not.toBeNull();
    });
});

describe('VIBE-13 — dress code', () => {
    beforeEach(() => usePreferencesStore.getState().reset());

    it('renders five labelled options (AC 13.1)', () => {
        renderApp();
        // Each option's accessible name starts with its code and includes the
        // formality descriptor, e.g. "Business Formal — Tailoring, polished".
        for (const code of ['Casual', 'Smart Casual', 'Business Formal', 'Cocktail', 'Black Tie']) {
            expect(
                screen.getByRole('button', { name: new RegExp(`^${code} — `, 'i') }),
            ).toBeVisible();
        }
    });

    it('saves the choice and allows changing it (AC 13.2, 13.3)', async () => {
        const user = userEvent.setup();
        renderApp();

        await user.click(screen.getByRole('button', { name: /^Smart Casual — /i }));
        expect(usePreferencesStore.getState().preferences.dressCode).toBe('Smart Casual');

        await user.click(screen.getByRole('button', { name: /^Black Tie — /i }));
        expect(usePreferencesStore.getState().preferences.dressCode).toBe('Black Tie');
    });
});

describe('VIBE-14 — budget', () => {
    beforeEach(() => usePreferencesStore.getState().reset());

    it('accepts a USD amount (AC 14.1)', async () => {
        const user = userEvent.setup();
        renderApp();

        const input = screen.getByLabelText(/total clothing budget/i);
        await user.type(input, '250');
        expect(input).toHaveValue('250');
        expect(usePreferencesStore.getState().preferences.budget).toBe(250);
    });

    it('rejects a non-numeric budget with a helpful message (AC 14.2)', async () => {
        const user = userEvent.setup();
        renderApp();

        const input = screen.getByLabelText(/total clothing budget/i);
        await user.type(input, 'abc');
        await user.tab();

        expect(await screen.findByText(/use numbers only, like 250/i)).toBeVisible();
        expect(input).toHaveAttribute('aria-invalid', 'true');
        // aria-describedby must actually resolve to the alert node.
        const describedBy = input.getAttribute('aria-describedby');
        expect(describedBy).toBeTruthy();
        expect(document.getElementById(describedBy!.split(' ')[0])).not.toBeNull();
    });

    it('rejects zero and negative budgets', async () => {
        const user = userEvent.setup();
        renderApp();
        const input = screen.getByLabelText(/total clothing budget/i);

        await user.type(input, '0');
        await user.tab();
        expect(await screen.findByText(/budget must be greater than \$0/i)).toBeVisible();

        await user.clear(input);
        await user.type(input, '-50');
        await user.tab();
        expect(await screen.findByText(/budget can't be negative/i)).toBeVisible();
    });

    it('suppresses the error while the user is still typing', async () => {
        const user = userEvent.setup();
        renderApp();

        const input = screen.getByLabelText(/total clothing budget/i);
        await user.type(input, 'abc');
        // Not yet blurred: no scolding mid-entry.
        expect(screen.queryByText(/use numbers only/i)).toBeNull();
    });
});

describe('VIBE-15 — style and color', () => {
    beforeEach(() => usePreferencesStore.getState().reset());

    it('requires at least one style (AC 15.1)', async () => {
        const user = userEvent.setup();
        renderApp();

        await user.click(screen.getByRole('button', { name: /generate outfits/i }));
        expect(await screen.findByText(/choose at least one style/i)).toBeVisible();
    });

    it('keeps No Color Preference exclusive of concrete colors (AC 15.2)', async () => {
        const user = userEvent.setup();
        renderApp();

        await user.click(screen.getByRole('button', { name: /^Black$/i }));
        await user.click(screen.getByRole('button', { name: /no color preference/i }));

        const colors = usePreferencesStore.getState().preferences.colors;
        expect(colors).toEqual(['No Color Preference']);

        await user.click(screen.getByRole('button', { name: /^Navy$/i }));
        expect(usePreferencesStore.getState().preferences.colors).toEqual(['Navy']);
    });
});

describe('full flow — generate, retain, refine', () => {
    beforeEach(() => usePreferencesStore.getState().reset());

    it('generates recommendations and shows distinct outfits (AC 8.1–8.3, 11.4)', async () => {
        const user = userEvent.setup();
        renderApp();

        await completeFullPreferenceSet(user);
        await user.click(screen.getByRole('button', { name: /generate outfits/i }));

        const grid = await screen.findByRole('list', { name: /recommended outfits/i });
        const cards = within(grid).getAllByRole('article');
        expect(cards.length).toBeGreaterThan(0);

        // Each card exposes a distinct accessible name containing the outfit name.
        const names = cards.map((card) => within(card).getByRole('button', { name: /view details for/i }).getAttribute('aria-label'));
        expect(new Set(names).size).toBe(names.length);

        // Occasion was retained through generation (AC 11.4).
        expect(usePreferencesStore.getState().preferences.occasion).toBe('Wedding');
    });

    it('returns to preferences without losing selections (Story 9 AC1, AC 15.3)', async () => {
        const user = userEvent.setup();
        renderApp();

        await completeFullPreferenceSet(user);
        await user.click(screen.getByRole('button', { name: /generate outfits/i }));
        await screen.findByRole('list', { name: /recommended outfits/i });

        await user.click(screen.getByRole('button', { name: /edit preferences/i }));

        // Every previous choice is still reflected in the UI.
        expect(screen.getByRole('button', { name: /^Wedding/i })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
        expect(screen.getByRole('button', { name: /^Cocktail — /i })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
        expect(screen.getByLabelText(/total clothing budget/i)).toHaveValue('250');
        expect(screen.getByRole('button', { name: /^Bohemian/i })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
        expect(screen.getByRole('button', { name: /no color preference/i })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
    });

    it('regenerates with the revised input while keeping other fields (AC 9.2, 9.3)', async () => {
        const user = userEvent.setup();
        renderApp();

        await completeFullPreferenceSet(user);
        await user.click(screen.getByRole('button', { name: /generate outfits/i }));
        await screen.findByRole('list', { name: /recommended outfits/i });

        await user.click(screen.getByRole('button', { name: /edit preferences/i }));

        // Change only the budget.
        const input = screen.getByLabelText(/total clothing budget/i);
        await user.clear(input);
        await user.type(input, '400');

        await user.click(screen.getByRole('button', { name: /generate outfits/i }));
        await screen.findByRole('list', { name: /recommended outfits/i });

        const prefs = usePreferencesStore.getState().preferences;
        expect(prefs.budget).toBe(400);
        // The untouched fields survived the change.
        expect(prefs.occasion).toBe('Wedding');
        expect(prefs.dressCode).toBe('Cocktail');
        expect(prefs.styles).toEqual(['Bohemian']);
    });

    it('shows a helpful empty state with working escape hatches (AC 8.4, 9.4)', async () => {
        const user = userEvent.setup();
        renderApp();

        // The impossible charter combination.
        await user.click(screen.getByRole('button', { name: /^Work/i }));
        await user.click(screen.getByRole('button', { name: /^Business Formal — /i }));
        await user.type(screen.getByLabelText(/total clothing budget/i), '400');
        await user.click(screen.getByRole('button', { name: /^Streetwear/i }));
        await user.click(screen.getByRole('button', { name: /^Colorful$/i }));
        await user.click(screen.getByRole('button', { name: /generate outfits/i }));

        // A message, not a blank screen.
        expect(
            await screen.findByText(/nothing in the collection fits every constraint/i),
        ).toBeVisible();

        // At least one recovery action, and it must actually recover.
        const recoverButtons = await screen.findAllByRole('button', { name: /show \d+ outfits?/i });
        expect(recoverButtons.length).toBeGreaterThan(0);

        await user.click(recoverButtons[0]);
        expect(await screen.findByRole('list', { name: /recommended outfits/i })).toBeVisible();
    });

    it('redirects to preferences when results are requested with no inputs', async () => {
        renderApp('/results');
        // Guard sends the user back rather than rendering an empty results frame.
        expect(await screen.findByText(/tell us about the occasion/i)).toBeVisible();
    });
});

describe('Sprint 2 — results to detail round trip', () => {
    beforeEach(() => usePreferencesStore.getState().reset());

    it('opens a detail page and returns without regenerating results (Story 6 AC1, AC4)', async () => {
        const user = userEvent.setup();
        renderApp();

        await completeFullPreferenceSet(user);
        await user.click(screen.getByRole('button', { name: /generate outfits/i }));
        await screen.findByRole('list', { name: /recommended outfits/i });

        const generatedAt = usePreferencesStore.getState().lastGeneratedAt;
        const resultIds = usePreferencesStore.getState().results.map((entry) => entry.outfit.id);

        // Open the first recommendation.
        const grid = screen.getByRole('list', { name: /recommended outfits/i });
        const firstCard = within(grid).getAllByRole('listitem')[0];
        await user.click(within(firstCard).getByRole('button', { name: /view details for/i }));

        // The detail screen is genuinely a new destination.
        expect(
            await screen.findByRole('list', { name: /garments in this outfit/i }),
        ).toBeVisible();
        expect(screen.getByRole('button', { name: /back to recommendations/i })).toBeVisible();

        await user.click(screen.getByRole('button', { name: /back to recommendations/i }));
        await screen.findByRole('list', { name: /recommended outfits/i });

        // The cached generation survived the round trip untouched — including the
        // timestamp, which is what proves results were not silently rebuilt.
        const state = usePreferencesStore.getState();
        expect(state.lastGeneratedAt).toBe(generatedAt);
        expect(state.results.map((entry) => entry.outfit.id)).toEqual(resultIds);
        expect(state.preferences.occasion).toBe('Wedding');
    });
});
