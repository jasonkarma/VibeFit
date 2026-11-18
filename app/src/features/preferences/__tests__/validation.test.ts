import { describe, expect, it } from 'vitest';
import { EMPTY_PREFERENCES, NO_COLOR_PREFERENCE } from '@/types/domain';
import { MESSAGES, validateBudget, validatePreferences } from '../validation';

describe('budget validation (AC 14.2)', () => {
    const cases: Array<[string, string, string]> = [
        ['empty string', '', MESSAGES.budgetEmpty],
        ['whitespace only', '   ', MESSAGES.budgetEmpty],
        ['zero', '0', MESSAGES.budgetZero],
        ['zero with currency symbol', '$0', MESSAGES.budgetZero],
        ['zero decimal', '0.00', MESSAGES.budgetZero],
        ['negative', '-50', MESSAGES.budgetNegative],
        ['negative with currency symbol', '-$50', MESSAGES.budgetNegative],
        ['letters', 'abc', MESSAGES.budgetNan],
        ['mixed text', '250 dollars', MESSAGES.budgetNan],
        ['stray decimal', '.', MESSAGES.budgetNan],
        ['bare minus', '-', MESSAGES.budgetNegative],
        ['too large', '100001', MESSAGES.budgetTooLarge],
    ];

    it.each(cases)('rejects %s with a helpful message', (_label, input, expected) => {
        const result = validateBudget(input);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toBe(expected);
    });

    const acceptances: Array<[string, number]> = [
        ['250', 250],
        ['$250', 250],
        ['1,250', 1250],
        ['$1,250.50', 1250.5],
        ['0.01', 0.01],
        [' 300 ', 300],
        ['100000', 100000],
    ];

    it.each(acceptances)('accepts %s as %d', (input, expected) => {
        const result = validateBudget(input);
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value).toBeCloseTo(expected, 2);
    });

    it('accepts the boundary value 100000 but rejects 100000.01', () => {
        expect(validateBudget('100000').ok).toBe(true);
        expect(validateBudget('100000.01').ok).toBe(false);
    });
});

describe('preference validation', () => {
    it('reports every missing required field', () => {
        const errors = validatePreferences({ ...EMPTY_PREFERENCES });
        expect(errors.occasion).toBe(MESSAGES.occasion);
        expect(errors.dressCode).toBe(MESSAGES.dressCode);
        expect(errors.styles).toBe(MESSAGES.styles);
        expect(errors.colors).toBe(MESSAGES.colors);
        expect(errors.budget).toBe(MESSAGES.budgetEmpty);
    });

    it('passes with a complete, valid selection', () => {
        const errors = validatePreferences({
            ...EMPTY_PREFERENCES,
            occasion: 'Work',
            dressCode: 'Smart Casual',
            budget: 250,
            budgetInput: '250',
            styles: ['Minimalist'],
            colors: [NO_COLOR_PREFERENCE],
        });
        expect(errors).toEqual({});
    });

    it('requires at least one style (AC 15.1)', () => {
        const errors = validatePreferences({
            ...EMPTY_PREFERENCES,
            occasion: 'Work',
            dressCode: 'Casual',
            budget: 100,
            budgetInput: '100',
            styles: [],
            colors: [NO_COLOR_PREFERENCE],
        });
        expect(errors.styles).toBe(MESSAGES.styles);
    });

    it('requires a colour choice including the explicit no-preference option (AC 15.2)', () => {
        const errors = validatePreferences({
            ...EMPTY_PREFERENCES,
            occasion: 'Work',
            dressCode: 'Casual',
            budget: 100,
            budgetInput: '100',
            styles: ['Classic'],
            colors: [],
        });
        expect(errors.colors).toBe(MESSAGES.colors);
    });
});
