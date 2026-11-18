import type { PreferenceErrors, UserPreferences } from '@/types/domain';
import { parseBudgetInput } from '@/lib/format';

/**
 * Preference validation.
 *
 * Messages follow one rule: tell the user what to do, not what they did wrong.
 * "Use numbers only, like 250" beats "invalid input". Every message is asserted
 * verbatim in `validation.test.ts`, so rewriting copy is a deliberate act.
 */

export const BUDGET_MIN_EXCLUSIVE = 0;
export const BUDGET_MAX = 100_000;

export const MESSAGES = {
    occasion: 'Pick an occasion so we can style for the right event.',
    dressCode: 'Choose a dress code — it sets the formality of your outfits.',
    styles: 'Choose at least one style you like.',
    colors: 'Pick a color, or choose No Color Preference.',
    budgetEmpty: 'Enter your clothing budget in US dollars.',
    budgetNan: 'Use numbers only, like 250.',
    budgetZero: 'Budget must be greater than $0.',
    budgetNegative: "Budget can't be negative.",
    budgetTooLarge: "That's higher than expected — try a value under $100,000.",
} as const;

/**
 * Budget validation, returned as a discriminated result so the caller can both
 * render a message and store the parsed value without re-parsing.
 */
export type BudgetValidation =
    | { ok: true; value: number }
    | { ok: false; error: string };

export function validateBudget(raw: string): BudgetValidation {
    const trimmed = raw.trim();

    if (trimmed === '') {
        return { ok: false, error: MESSAGES.budgetEmpty };
    }

    const numericPart = trimmed.replace(/[$,\s]/g, '');

    // A leading minus — even a bare "-" mid-typing — is a negative-intent entry,
    // not a non-numeric one. "Use numbers only" would be the wrong advice here,
    // because the digits were fine; the sign was the problem.
    if (/^-\d*\.?\d*$/.test(numericPart)) {
        return { ok: false, error: MESSAGES.budgetNegative };
    }

    const value = parseBudgetInput(trimmed);

    if (value === null) {
        return { ok: false, error: MESSAGES.budgetNan };
    }
    if (value === 0) {
        return { ok: false, error: MESSAGES.budgetZero };
    }
    if (value < 0) {
        return { ok: false, error: MESSAGES.budgetNegative };
    }
    if (!Number.isFinite(value)) {
        return { ok: false, error: MESSAGES.budgetNan };
    }
    if (value > BUDGET_MAX) {
        return { ok: false, error: MESSAGES.budgetTooLarge };
    }

    return { ok: true, value: Math.round(value * 100) / 100 };
}

/**
 * Budget field sanitising.
 *
 * Deliberately permissive: characters are *not* stripped as the user types.
 *
 * Filtering the input down to digits looks tidy but quietly breaks acceptance
 * criterion 14.2 — a user pasting "250 dollars" would watch the letters vanish
 * with no explanation, and the "reject non-numeric input with a helpful message"
 * case could never actually occur. Leaving the characters in place lets
 * validation explain what is wrong, which is both honest and demonstrable.
 *
 * Nothing is lost by this: `parseBudgetInput` already tolerates "$", thousands
 * separators, and surrounding whitespace, so the lenient path still accepts
 * "$1,250.50" typed or pasted verbatim.
 */
export function sanitizeBudgetTyping(raw: string): string {
    return raw;
}

export function validatePreferences(prefs: UserPreferences): PreferenceErrors {
    const errors: PreferenceErrors = {};

    if (!prefs.occasion) {
        errors.occasion = MESSAGES.occasion;
    }

    if (!prefs.dressCode) {
        errors.dressCode = MESSAGES.dressCode;
    }

    if (prefs.styles.length === 0) {
        errors.styles = MESSAGES.styles;
    }

    if (prefs.colors.length === 0) {
        errors.colors = MESSAGES.colors;
    }

    const budget = validateBudget(prefs.budgetInput);
    if (!budget.ok) {
        errors.budget = budget.error;
    }

    return errors;
}

export function hasErrors(errors: PreferenceErrors): boolean {
    return Object.keys(errors).length > 0;
}
