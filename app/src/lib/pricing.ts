import type { Product } from '@/types/domain';
import { formatUsdExact, roundMoney } from './format';

/**
 * Pricing rules for the outfit detail view (Story 7).
 *
 * The whole file exists because of one requirement: **a `null` price must never
 * become a number.** Not `0`, not an estimate, not a range midpoint. Everything
 * else here is presentation, but that rule is correctness, so it lives in a pure
 * module with tests rather than inside JSX where it could drift.
 *
 * The summary is a discriminated union on purpose. A partial total and a complete
 * total are different *kinds* of thing, and a caller that wants to render a total
 * has to narrow the type first — which makes "rendered a partial total as if it
 * were complete" a compile error instead of a review comment.
 */

export const PRICE_UNAVAILABLE = 'Price Unavailable';
export const LINK_UNAVAILABLE = 'Link Unavailable';
export const MISSING_RETRIEVAL_DATE = 'Retrieval date unavailable';

/** Cents-precision item price, or `null` when the catalog genuinely has none. */
export function formatItemPrice(price: number | null): string | null {
    if (price === null || !Number.isFinite(price)) return null;
    return formatUsdExact(price);
}

/**
 * `Sample Price • Retrieved 2026-11-18`.
 *
 * The charter's risk register requires the app to disclose when pricing was
 * captured. Keeping the separator and the word "Sample" fixed means the string is
 * assertable in tests and identical everywhere it appears.
 */
export function samplePriceLabel(priceRetrievedAt: string | null): string {
    const date = priceRetrievedAt?.trim();
    return date ? `Sample Price • Retrieved ${date}` : `Sample Price • ${MISSING_RETRIEVAL_DATE}`;
}

export interface CompletePricing {
    kind: 'complete';
    /** Sum of every item, in dollars. */
    total: number;
    /** Always empty for a complete summary — present so callers need no branch. */
    missing: [];
    missingCount: 0;
}

export interface PartialPricing {
    kind: 'partial';
    /** Sum of the items that *do* have a price. A lower bound, never a total. */
    knownTotal: number;
    /** The items with `price: null`, so the UI can name them. */
    missing: Product[];
    missingCount: number;
}

export type PricingSummary = CompletePricing | PartialPricing;

/**
 * Summarise an outfit's pricing.
 *
 * `null` prices are excluded from the sum and reported separately. An outfit of
 * entirely unknown prices yields `knownTotal: 0` with `missingCount` equal to the
 * item count — the UI must read `missingCount` to know the difference between
 * "free" and "unknown", which is exactly the distinction this type enforces.
 */
export function summarisePricing(items: Product[]): PricingSummary {
    const priced: number[] = [];
    const missing: Product[] = [];

    for (const item of items) {
        if (item.price === null || !Number.isFinite(item.price)) {
            missing.push(item);
        } else {
            priced.push(item.price);
        }
    }

    if (missing.length > 0) {
        const knownTotal = roundMoney(priced.reduce((sum, value) => sum + value, 0));
        return {
            kind: 'partial',
            knownTotal,
            missing,
            missingCount: missing.length,
        };
    }

    return {
        kind: 'complete',
        total: roundMoney(priced.reduce((sum, value) => sum + value, 0)),
        missing: [],
        missingCount: 0,
    };
}

/** A price is displayable only if the catalog actually carries one. */
export function hasDisplayablePrice(product: Product): boolean {
    return product.price !== null && Number.isFinite(product.price);
}

/**
 * Whether a product page can be offered as a shopping destination.
 *
 * Deliberately strict: an empty string, a whitespace string, or anything that is
 * not an absolute http(s) URL means "no link". A disabled-looking or
 * `href="#"` link is worse than no link, because it looks clickable and lies.
 */
export function hasShoppingLink(product: Product): boolean {
    return isShoppingUrl(product.productUrl?.trim());
}

function isShoppingUrl(url?: string): boolean {
    return Boolean(url && /^https?:\/\/[^\s]+$/i.test(url));
}

/** Catalog item links may need a fresh availability and variant check. */
export function shopLinkLabel(retailer: string): string {
    const name = retailer.trim();
    return name ? `Check item at ${name}` : 'Check item';
}

export function shoppingDestination(product: Product): { href: string; label: string } | null {
    const itemUrl = product.productUrl?.trim();
    if (itemUrl && hasShoppingLink(product)) {
        const label = product.productUrlVerifiedAt
            ? `View item at ${product.retailer}`
            : shopLinkLabel(product.retailer);
        return { href: itemUrl, label };
    }

    const retailerUrl = product.retailerUrl?.trim();
    if (retailerUrl && isShoppingUrl(retailerUrl)) {
        return { href: retailerUrl, label: `Browse ${product.retailer}` };
    }
    return null;
}

export interface BudgetVerdict {
    /** `within` | `over` — never `unknown`, because a partial total has no verdict. */
    status: 'within' | 'over';
    /** Signed difference in dollars; negative means over budget. */
    difference: number;
    label: string;
}

/**
 * Compare a total against the user's budget.
 *
 * Only ever called with a complete total. A partial total is compared using a
 * lower bound, which could read as "comfortably within budget" for an outfit that
 * is not — so the caller must not ask, and the type makes it awkward to try.
 */
export function budgetVerdict(total: number, budget: number | null): BudgetVerdict | null {
    if (budget === null || !Number.isFinite(budget) || budget <= 0) return null;

    const difference = roundMoney(budget - total);
    if (difference < 0) {
        return {
            status: 'over',
            difference,
            label: `${formatUsdExact(Math.abs(difference))} over your budget`,
        };
    }

    return {
        status: 'within',
        difference,
        label:
            difference === 0
                ? 'Exactly at your budget'
                : `${formatUsdExact(difference)} under your budget`,
    };
}
