import { describe, expect, it } from 'vitest';
import { EMPTY_PREFERENCES, NO_COLOR_PREFERENCE, type UserPreferences } from '@/types/domain';
import { parseChatMessage } from '../parseIntent';

const blank: UserPreferences = { ...EMPTY_PREFERENCES };

const filled: UserPreferences = {
    ...EMPTY_PREFERENCES,
    occasion: 'Work',
    dressCode: 'Business Formal',
    budget: 300,
    budgetInput: '300',
    styles: ['Classic'],
    colors: ['Navy'],
};

describe('chat parser — occasion and dress code', () => {
    it('reads a wedding from natural phrasing', () => {
        const result = parseChatMessage('What should I wear to a summer wedding?', blank);
        expect(result.patch.occasion).toBe('Wedding');
        expect(result.understood).toBe(true);
    });

    it('distinguishes work from a work party', () => {
        // "party" must win over "work": the user is dressing for the party.
        const result = parseChatMessage('office holiday party', blank);
        expect(result.patch.occasion).toBe('Party');
    });

    it('maps black tie before the generic casual match', () => {
        const result = parseChatMessage('black tie reception', blank);
        expect(result.patch.dressCode).toBe('Black Tie');
        expect(result.patch.occasion).toBe('Wedding');
    });

    it('reads smart casual without being fooled by "casual"', () => {
        const result = parseChatMessage('smart casual for the office', blank);
        expect(result.patch.dressCode).toBe('Smart Casual');
        expect(result.patch.occasion).toBe('Work');
    });
});

describe('chat parser — budget', () => {
    const budgetCases: Array<[string, number]> = [
        ['summer wedding under $250', 250],
        ['budget of 180', 180],
        ['max 300 please', 300],
        ['something for 120 dollars', 120],
        ['under 1,250', 1250],
        ['up to $95.50', 95.5],
    ];

    it.each(budgetCases)('extracts the amount from "%s"', (message, expected) => {
        const result = parseChatMessage(message, blank);
        expect(result.patch.budget).toBeCloseTo(expected, 2);
        expect(result.patch.budgetInput).toBeDefined();
    });

    it('refuses a zero budget and says why instead of silently ignoring it', () => {
        const result = parseChatMessage('budget of 0', blank);
        expect(result.patch.budget).toBeUndefined();
        expect(result.reply.toLowerCase()).toContain('greater than $0');
    });
});

describe('chat parser — style and color', () => {
    it('collects multiple styles from one sentence', () => {
        const result = parseChatMessage('something minimalist and trendy', blank);
        expect(result.patch.styles).toEqual(['Minimalist', 'Trendy']);
    });

    it('treats "neutral" as earth tones', () => {
        const result = parseChatMessage('neutral palette please', blank);
        expect(result.patch.colors).toEqual(['Earth Tones']);
    });

    it('never returns a concrete color alongside No Color Preference', () => {
        const result = parseChatMessage('any color, maybe black', blank);
        expect(result.patch.colors).toEqual([NO_COLOR_PREFERENCE]);
    });
});

describe('chat parser — multi-field and follow-ups', () => {
    it('populates several preferences from one sentence', () => {
        const result = parseChatMessage(
            'What should I wear to a summer wedding, cocktail, under $250, minimalist, no color preference?',
            blank,
        );
        expect(result.patch.occasion).toBe('Wedding');
        expect(result.patch.dressCode).toBe('Cocktail');
        expect(result.patch.budget).toBe(250);
        expect(result.patch.styles).toEqual(['Minimalist']);
        expect(result.patch.colors).toEqual([NO_COLOR_PREFERENCE]);
        expect(result.appliedFields.length).toBeGreaterThanOrEqual(4);
    });

    it('lowers the budget by roughly 20% on "make it cheaper"', () => {
        const result = parseChatMessage('show me a cheaper option', filled);
        expect(result.patch.budget).toBe(240); // 300 * 0.8
        expect(result.patch.occasion).toBeUndefined();
    });

    it('steps formality up on "something fancier"', () => {
        const result = parseChatMessage('can you make it fancier', filled);
        expect(result.patch.dressCode).toBe('Cocktail');
    });
});

describe('chat parser — preservation and fallbacks', () => {
    it('does not touch unrelated fields when only one is mentioned', () => {
        const result = parseChatMessage('make it a party', filled);
        expect(result.patch.occasion).toBe('Party');
        // Everything else must survive untouched — this is Story 9 AC2 via chat.
        expect(result.patch.dressCode).toBeUndefined();
        expect(result.patch.budget).toBeUndefined();
        expect(result.patch.styles).toBeUndefined();
        expect(result.patch.colors).toBeUndefined();
    });

    it('asks a specific clarifying question when nothing is understood', () => {
        const result = parseChatMessage('hmm not sure', blank);
        expect(result.understood).toBe(false);
        expect(result.patch).toEqual({});
        // Names the missing pieces rather than a generic failure message.
        expect(result.reply).toMatch(/occasion|dress code|budget|style|color/i);
    });

    it('handles empty input without throwing', () => {
        const result = parseChatMessage('   ', blank);
        expect(result.understood).toBe(false);
        expect(result.reply.length).toBeGreaterThan(0);
    });

    it('is deterministic for identical input', () => {
        const first = parseChatMessage('party, cocktail, under 200, trendy', filled);
        const second = parseChatMessage('party, cocktail, under 200, trendy', filled);
        expect(first).toEqual(second);
    });

    it('omits a field that is already set to the matched value', () => {
        const result = parseChatMessage('black tie', { ...blank, dressCode: 'Black Tie' });
        expect(result.patch.dressCode).toBeUndefined();
    });

    it('resets everything on an explicit start-over', () => {
        const result = parseChatMessage('start over', filled);
        expect(result.patch).toMatchObject({
            occasion: null,
            dressCode: null,
            budget: null,
            styles: [],
            colors: [],
        });
    });
});
