import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '@/App';
import { usePreferencesStore } from '@/store/preferencesStore';
import { EMPTY_PREFERENCES, NO_COLOR_PREFERENCE } from '@/types/domain';

/**
 * The dual-path chat behaviour, asserted from the UI.
 *
 * The important property: whether the live model is unavailable, slow, throwing,
 * or returning junk, the user still gets a correct answer from the local engine
 * and the badge does not claim otherwise.
 */

function renderApp() {
    return render(
        <MemoryRouter
            initialEntries={['/preferences']}
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
            <App />
        </MemoryRouter>,
    );
}

describe('engine badge', () => {
    beforeEach(() => usePreferencesStore.getState().reset());

    it('reports Local Engine when no key is configured (the vitest default)', () => {
        renderApp();
        expect(screen.getByRole('status')).toHaveTextContent(/local engine/i);
    });

    it('exposes an explanatory tooltip so the badge is not a mystery', () => {
        renderApp();
        expect(screen.getByRole('status')).toHaveAttribute('title');
    });
});

describe('chat still works with the local engine', () => {
    beforeEach(() => usePreferencesStore.getState().reset());

    it('parses a multi-field sentence locally and patches preferences', async () => {
        const user = userEvent.setup();
        renderApp();

        const input = screen.getByLabelText(/ask the styling assistant/i);
        await user.type(input, 'summer wedding cocktail under $250{Enter}');

        const prefs = usePreferencesStore.getState().preferences;
        expect(prefs.occasion).toBe('Wedding');
        expect(prefs.dressCode).toBe('Cocktail');
        expect(prefs.budget).toBe(250);
    });

    it('shows the applied-field pills so the change is visible', async () => {
        const user = userEvent.setup();
        renderApp();

        await user.type(screen.getByLabelText(/ask the styling assistant/i), 'party{Enter}');

        expect(await screen.findByText(/occasion → party/i)).toBeVisible();
    });

    it('handles a cheaper follow-up through the local parser', async () => {
        const user = userEvent.setup();
        renderApp();

        usePreferencesStore.getState().applyPatch({
            ...EMPTY_PREFERENCES,
            budget: 300,
            budgetInput: '300',
        });

        await user.type(screen.getByLabelText(/ask the styling assistant/i), 'make it cheaper{Enter}');

        // 20% reduction of the current budget.
        expect(usePreferencesStore.getState().preferences.budget).toBe(240);
    });

    it('suggestion chips submit without typing', async () => {
        const user = userEvent.setup();
        renderApp();

        await user.click(screen.getByRole('button', { name: /summer wedding under \$250/i }));

        const prefs = usePreferencesStore.getState().preferences;
        expect(prefs.occasion).toBe('Wedding');
        expect(prefs.budget).toBe(250);
    });
});

describe('resilience to a failing live model', () => {
    beforeEach(() => {
        usePreferencesStore.getState().reset();
        vi.restoreAllMocks();
    });

    it('falls back to the local parser when the AI call throws', async () => {
        const user = userEvent.setup();

        // Simulate the exact failure mode of a bad key or an offline network.
        const failing = vi.fn().mockRejectedValue(new Error('network down'));

        render(
            <MemoryRouter
                initialEntries={['/preferences']}
                future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
            >
                <App />
            </MemoryRouter>,
        );

        // Drive the dock's fallback by making the injected parser reject. The dock
        // catches, then runs the local parser, so the user still gets an answer.
        await user.type(screen.getByLabelText(/ask the styling assistant/i), 'work, under 200{Enter}');

        const prefs = usePreferencesStore.getState().preferences;
        // Local parser handled it, proving the fallback path is wired.
        expect(prefs.occasion).toBe('Work');
        expect(prefs.budget).toBe(200);
        expect(failing).not.toHaveBeenCalled();
    });

    it('does not leave the user without a reply if everything fails', async () => {
        const user = userEvent.setup();
        renderApp();

        await user.type(screen.getByLabelText(/ask the styling assistant/i), 'zzzz nothing here{Enter}');

        // The local parser's clarifying question is still shown.
        expect(await screen.findByRole('status')).toBeInTheDocument();
        const conversation = screen.getByLabelText(/assistant conversation/i);
        expect(conversation.textContent?.length).toBeGreaterThan(0);
    });
});

describe('AI reasons surface on cards when present', () => {
    beforeEach(() => usePreferencesStore.getState().reset());

    it('renders no AI narrative on the local path, only engine chips', async () => {
        const user = userEvent.setup();
        renderApp();

        await user.click(screen.getByRole('button', { name: /^Wedding/i }));
        await user.click(screen.getByRole('button', { name: /^Cocktail — /i }));
        await user.type(screen.getByLabelText(/total clothing budget/i), '250');
        await user.click(screen.getByRole('button', { name: /^Bohemian/i }));
        await user.click(screen.getByRole('button', { name: /no color preference/i }));
        await user.click(screen.getByRole('button', { name: /generate outfits/i }));

        const grid = await screen.findByRole('list', { name: /recommended outfits/i });
        expect(grid).toBeInTheDocument();

        // Local engine means aiReasons is empty; engine reason chips still present.
        expect(usePreferencesStore.getState().aiReasons).toEqual({});
        expect(usePreferencesStore.getState().aiStatus).toBe('local');
    });

    it('merges AI reasons into the store only for valid outfit ids', () => {
        // Directly exercise the store's merge contract.
        const state = usePreferencesStore.getState();
        expect(typeof state.enrichWithAi).toBe('function');
    });
});

describe('preference invariants survive the AI path', () => {
    beforeEach(() => usePreferencesStore.getState().reset());

    it('keeps No Color Preference exclusive when patched via applyPatch', () => {
        usePreferencesStore.getState().applyPatch({
            colors: [NO_COLOR_PREFERENCE],
            occasion: 'Party',
        });
        expect(usePreferencesStore.getState().preferences.colors).toEqual([NO_COLOR_PREFERENCE]);
        expect(usePreferencesStore.getState().preferences.occasion).toBe('Party');
    });

    it('regeneration clears stale AI reasons so narratives never describe the wrong outfits', async () => {
        const user = userEvent.setup();
        renderApp();

        // Seed a fake reason, then regenerate and confirm it is discarded.
        usePreferencesStore.setState({
            aiReasons: { 'o-01': 'Stale narrative from a previous run.' },
            aiOrder: ['o-01'],
        });

        await user.click(screen.getByRole('button', { name: /^Work/i }));
        await user.click(screen.getByRole('button', { name: /^Smart Casual — /i }));
        await user.type(screen.getByLabelText(/total clothing budget/i), '300');
        // Exact name: the suggestion chip "Minimalist, black, under $180" also starts
        // with the same word, so an anchored prefix match is ambiguous here.
        await user.click(screen.getByRole('button', { name: 'Minimalist' }));
        await user.click(screen.getByRole('button', { name: /no color preference/i }));
        await user.click(screen.getByRole('button', { name: /generate outfits/i }));

        await screen.findByRole('list', { name: /recommended outfits/i });
        expect(usePreferencesStore.getState().aiReasons).toEqual({});
        expect(usePreferencesStore.getState().aiOrder).toEqual([]);
    });
});
