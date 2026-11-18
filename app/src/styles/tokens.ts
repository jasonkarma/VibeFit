/**
 * Design tokens — "Editorial Obsidian & Champagne".
 *
 * Single source of truth for colour and type. Feature components must not
 * hardcode hex values; they use Tailwind utilities generated from the same
 * palette in `tailwind.config.ts`, or import from this file for inline SVG
 * and canvas work.
 */

export const palette = {
    /** Base canvas. Deliberately not pure black. */
    obsidian: '#09090B',
    obsidianElevated: '#111113',

    /** Ambient mesh glows, drawn as static CSS gradients behind all content. */
    meshChampagne: 'rgba(212, 175, 55, 0.08)',
    meshViolet: 'rgba(139, 92, 246, 0.07)',

    /** Primary accent: actions, selected states, active borders, match ring. */
    champagne: '#E5C158',
    champagneSoft: '#EFDC97',
    champagneDeep: '#C9A63F',

    /** AI accent: assistant badges, sparkles, chat dock focus glow. */
    violet: '#A855F7',

    /** Semantic budget-fit signalling. */
    comfortable: '#34D399',
    tight: '#FBBF24',
    over: '#FB7185',

    /** Text ramp. */
    textPrimary: '#FAFAFA',
    textSecondary: '#A1A1AA',
    textTertiary: '#71717A',
} as const;

export const surfaces = {
    /** Base glass surface: white at 3% over obsidian, blurred, hairline border. */
    base: 'bg-white/[0.03] backdrop-blur-xl border border-white/10',
    /** Elevated glass for hover and open states. */
    elevated: 'bg-white/[0.05] backdrop-blur-xl border border-white/[0.14]',
} as const;

export const typeScale = {
    display: { xl: '3.5rem', lg: '3rem', md: '2.5rem' },
    heading: { md: '1.75rem', sm: '1.5rem' },
    body: '0.9375rem',
    label: '0.8125rem',
    mono: '0.8125rem',
} as const;

export const radii = {
    surface: '1rem',
    tile: '0.875rem',
    pill: '999px',
} as const;

/**
 * Budget tiers drive the non-authoritative tier bar next to the budget input.
 * These are presentational hints only — never validation.
 */
export const budgetTiers = [
    { id: 'essential', label: 'Essential', min: 1, max: 99, blurb: 'Everyday staples' },
    { id: 'curated', label: 'Curated', min: 100, max: 199, blurb: 'Considered basics' },
    { id: 'elevated', label: 'Elevated', min: 200, max: 349, blurb: 'Designer-leaning pieces' },
    { id: 'atelier', label: 'Atelier', min: 350, max: Number.POSITIVE_INFINITY, blurb: 'Statement tailoring' },
] as const;

export type BudgetTierId = (typeof budgetTiers)[number]['id'];

export function budgetTierFor(amount: number): (typeof budgetTiers)[number] | null {
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return budgetTiers.find((tier) => amount >= tier.min && amount <= tier.max) ?? null;
}

/**
 * Relative luminance / contrast ratio helpers. Used by `tokens.test.ts` to guard
 * that shipped colour combinations stay readable.
 */
export function hexToRgb(hex: string): [number, number, number] {
    const clean = hex.replace('#', '');
    const full =
        clean.length === 3
            ? clean
                .split('')
                .map((c) => c + c)
                .join('')
            : clean;
    return [
        Number.parseInt(full.slice(0, 2), 16),
        Number.parseInt(full.slice(2, 4), 16),
        Number.parseInt(full.slice(4, 6), 16),
    ];
}

function relativeLuminance(hex: string): number {
    const [r, g, b] = hexToRgb(hex).map((channel) => {
        const srgb = channel / 255;
        return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground: string, background: string): number {
    const l1 = relativeLuminance(foreground);
    const l2 = relativeLuminance(background);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}
