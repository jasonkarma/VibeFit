import { describe, expect, it } from 'vitest';
import {
    MISSING_RETRIEVAL_DATE,
    PRICE_UNAVAILABLE,
    budgetVerdict,
    formatItemPrice,
    hasDisplayablePrice,
    hasShoppingLink,
    samplePriceLabel,
    shopLinkLabel,
    summarisePricing,
} from '../pricing';
import type { Product } from '@/types/domain';

/**
 * Story 7 correctness, tested as pure logic.
 *
 * The rule under test on almost every line here is the same one: **an unknown
 * price must never become a number.** A green suite on this file is the reason the
 * UI can be trusted not to invent a total.
 */

function product(overrides: Partial<Product> = {}): Product {
    return {
        id: 'p-test',
        name: 'Test Piece',
        retailer: 'Test Retailer',
        slot: 'top',
        department: 'Womenswear',
        price: 50,
        productUrl: 'https://example.com/product',
        priceRetrievedAt: '2026-11-18',
        colors: ['Black'],
        styles: ['Minimalist'],
        image: null,
        arSupported: false,
        overlayAsset: null,
        ...overrides,
    };
}

describe('formatItemPrice (AC 7.1)', () => {
    it('renders two decimal places with a dollar sign', () => {
        expect(formatItemPrice(19.9)).toBe('$19.90');
        expect(formatItemPrice(59)).toBe('$59.00');
        expect(formatItemPrice(0.5)).toBe('$0.50');
    });

    it('returns null for an unknown price rather than a zero figure', () => {
        // The single most important assertion in this file. `$0.00` would be a lie.
        expect(formatItemPrice(null)).toBeNull();
    });

    it('returns null for non-finite values so NaN cannot leak into the UI', () => {
        expect(formatItemPrice(Number.NaN)).toBeNull();
        expect(formatItemPrice(Number.POSITIVE_INFINITY)).toBeNull();
    });
});

describe('samplePriceLabel (AC 7.4)', () => {
    it('states the sample nature and the retrieval date', () => {
        expect(samplePriceLabel('2026-11-18')).toBe('Sample Price • Retrieved 2026-11-18');
    });

    it('degrades honestly when the retrieval date is missing', () => {
        expect(samplePriceLabel(null)).toBe(`Sample Price • ${MISSING_RETRIEVAL_DATE}`);
        expect(samplePriceLabel('   ')).toBe(`Sample Price • ${MISSING_RETRIEVAL_DATE}`);
    });

    it('always contains the words "Sample Price" so the disclaimer cannot be lost', () => {
        expect(samplePriceLabel('2026-01-01')).toContain('Sample Price');
        expect(samplePriceLabel(null)).toContain('Sample Price');
    });
});

describe('summarisePricing (AC 7.2, 7.3)', () => {
    it('reports a complete total when every price is known', () => {
        const summary = summarisePricing([
            product({ id: 'a', price: 19.9 }),
            product({ id: 'b', price: 34.9 }),
            product({ id: 'c', price: 55 }),
        ]);

        expect(summary.kind).toBe('complete');
        if (summary.kind !== 'complete') throw new Error('unreachable');
        expect(summary.total).toBe(109.8);
        expect(summary.missingCount).toBe(0);
    });

    it('rounds to cents so floating-point noise never reaches the UI', () => {
        const summary = summarisePricing([
            product({ id: 'a', price: 0.1 }),
            product({ id: 'b', price: 0.2 }),
        ]);

        if (summary.kind !== 'complete') throw new Error('expected complete');
        // 0.1 + 0.2 === 0.30000000000000004 without rounding.
        expect(summary.total).toBe(0.3);
    });

    it('excludes a null price from the sum and flags the summary partial', () => {
        const unknown = product({ id: 'p-linen-trouser', price: null });
        const summary = summarisePricing([
            product({ id: 'a', price: 42 }),
            unknown,
            product({ id: 'b', price: 79 }),
        ]);

        expect(summary.kind).toBe('partial');
        if (summary.kind !== 'partial') throw new Error('unreachable');
        expect(summary.knownTotal).toBe(121);
        expect(summary.missingCount).toBe(1);
        expect(summary.missing.map((item) => item.id)).toEqual(['p-linen-trouser']);
    });

    it('never substitutes a number for an unknown price', () => {
        const summary = summarisePricing([product({ price: null })]);
        if (summary.kind !== 'partial') throw new Error('expected partial');

        // Known subtotal is zero because nothing is priced — but the *kind* says
        // partial, so a caller cannot present this as a real total of $0.00.
        expect(summary.knownTotal).toBe(0);
        expect(summary.missingCount).toBe(1);
        expect(summary.missing).toHaveLength(1);
    });

    it('counts multiple unknown prices individually', () => {
        const summary = summarisePricing([
            product({ id: 'a', price: null }),
            product({ id: 'b', price: null }),
            product({ id: 'c', price: 10 }),
        ]);

        if (summary.kind !== 'partial') throw new Error('expected partial');
        expect(summary.missingCount).toBe(2);
        expect(summary.knownTotal).toBe(10);
    });

    it('returns a complete zero for an empty outfit, not a partial', () => {
        const summary = summarisePricing([]);
        expect(summary.kind).toBe('complete');
        if (summary.kind !== 'complete') throw new Error('unreachable');
        expect(summary.total).toBe(0);
    });
});

describe('budgetVerdict (AC 7.2)', () => {
    it('reports headroom when the total is under budget', () => {
        const verdict = budgetVerdict(186, 250);
        expect(verdict?.status).toBe('within');
        expect(verdict?.label).toBe('$64.00 under your budget');
    });

    it('reports the overage when the total exceeds budget', () => {
        const verdict = budgetVerdict(310, 250);
        expect(verdict?.status).toBe('over');
        expect(verdict?.label).toBe('$60.00 over your budget');
    });

    it('treats an exact match as within budget', () => {
        const verdict = budgetVerdict(250, 250);
        expect(verdict?.status).toBe('within');
        expect(verdict?.label).toBe('Exactly at your budget');
    });

    it('returns null without a usable budget, so no verdict is invented', () => {
        expect(budgetVerdict(186, null)).toBeNull();
        expect(budgetVerdict(186, 0)).toBeNull();
    });
});

describe('hasDisplayablePrice', () => {
    it('is true only for a real finite number', () => {
        expect(hasDisplayablePrice(product({ price: 0 }))).toBe(true);
        expect(hasDisplayablePrice(product({ price: 19.9 }))).toBe(true);
        expect(hasDisplayablePrice(product({ price: null }))).toBe(false);
        expect(hasDisplayablePrice(product({ price: Number.NaN }))).toBe(false);
    });
});

describe('shopping link guards (AC 8b.2)', () => {
    it('accepts absolute http and https URLs', () => {
        expect(hasShoppingLink(product({ productUrl: 'https://uniqlo.com/x' }))).toBe(true);
        expect(hasShoppingLink(product({ productUrl: 'http://example.com' }))).toBe(true);
    });

    it('rejects null, empty, whitespace and non-absolute values', () => {
        // Each of these must render no anchor at all — never href="#".
        expect(hasShoppingLink(product({ productUrl: null }))).toBe(false);
        expect(hasShoppingLink(product({ productUrl: '' }))).toBe(false);
        expect(hasShoppingLink(product({ productUrl: '   ' }))).toBe(false);
        expect(hasShoppingLink(product({ productUrl: '/relative/path' }))).toBe(false);
        expect(hasShoppingLink(product({ productUrl: 'javascript:alert(1)' }))).toBe(false);
    });

    it('names the retailer in the button label', () => {
        expect(shopLinkLabel('COS')).toBe('Shop at COS');
        expect(shopLinkLabel('  & Other Stories  ')).toBe('Shop at & Other Stories');
    });

    it('falls back to a neutral label rather than an empty "Shop at"', () => {
        expect(shopLinkLabel('   ')).toBe('Shop this piece');
    });
});

describe('unavailable-price copy', () => {
    it('is the exact string the acceptance criteria require', () => {
        expect(PRICE_UNAVAILABLE).toBe('Price Unavailable');
    });
});
