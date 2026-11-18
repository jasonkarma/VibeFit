/**
 * Formatting helpers. Kept pure and dependency-free so they are trivially
 * testable and safe to call from the engine.
 */

const USD = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});

const USD_WITH_CENTS = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

/** Whole-dollar display used in budget meters and reason strings. */
export function formatUsd(amount: number): string {
    return USD.format(amount);
}

/** Cents-precision display, reserved for individual item prices. */
export function formatUsdExact(amount: number): string {
    return USD_WITH_CENTS.format(amount);
}

export function formatPercent(value: number): string {
    return `${Math.round(value)}%`;
}

/**
 * Normalise a raw budget field value.
 *
 * Accepts an optional leading `$`, thousands separators, and a decimal part.
 * Returns `null` when the string cannot be read as a positive number, so the
 * caller can distinguish "not a number yet" from a valid figure.
 */
export function parseBudgetInput(raw: string): number | null {
    const trimmed = raw.trim();
    if (trimmed === '') return null;

    // Strip currency symbol and separators; a bare "-" or "." is not a number.
    const cleaned = trimmed.replace(/[$,\s]/g, '');
    if (!/^-?\d*\.?\d*$/.test(cleaned) || cleaned === '' || cleaned === '-' || cleaned === '.') {
        return null;
    }

    const value = Number.parseFloat(cleaned);
    if (!Number.isFinite(value)) return null;
    return value;
}

/** Round to cents so totals never show floating-point noise. */
export function roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
}
