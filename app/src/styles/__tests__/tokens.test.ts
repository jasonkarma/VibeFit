import { describe, expect, it } from 'vitest';
import { budgetTierFor, contrastRatio, palette } from '../tokens';

/**
 * Contrast guard for the colour combinations the UI actually ships.
 *
 * Gold is used as a fill with obsidian text; white is used on glass. If someone
 * later swaps a token, this fails before an unreadable badge reaches the demo.
 */
describe('shipped colour combinations stay readable', () => {
    const cases: Array<[string, string, string, number]> = [
        ['obsidian text on champagne fill', palette.obsidian, palette.champagne, 4.5],
        ['white text on obsidian canvas', palette.textPrimary, palette.obsidian, 7],
        ['secondary text on obsidian canvas', palette.textSecondary, palette.obsidian, 4.5],
        ['rose validation text on obsidian', palette.over, palette.obsidian, 4.5],
        ['emerald budget text on obsidian', palette.comfortable, palette.obsidian, 4.5],
        ['amber budget text on obsidian', palette.tight, palette.obsidian, 4.5],
        ['violet AR badge on obsidian', palette.violet, palette.obsidian, 4.5],
    ];

    it.each(cases)('%s meets its ratio', (_label, foreground, background, minimum) => {
        expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(minimum);
    });

    it('confirms tertiary text is intentionally below body-text contrast', () => {
        // Auxiliary labels only; documented so nobody promotes it to body copy.
        expect(contrastRatio(palette.textTertiary, palette.obsidian)).toBeLessThan(4.5);
        expect(contrastRatio(palette.textTertiary, palette.obsidian)).toBeGreaterThan(3);
    });
});

describe('budget tiers', () => {
    it('maps amounts to the expected tier', () => {
        expect(budgetTierFor(50)?.id).toBe('essential');
        expect(budgetTierFor(150)?.id).toBe('curated');
        expect(budgetTierFor(250)?.id).toBe('elevated');
        expect(budgetTierFor(600)?.id).toBe('atelier');
    });

    it('returns null for amounts that cannot be a tier', () => {
        expect(budgetTierFor(0)).toBeNull();
        expect(budgetTierFor(-10)).toBeNull();
        expect(budgetTierFor(Number.NaN)).toBeNull();
    });

    it('has no gaps between tiers', () => {
        for (let amount = 1; amount <= 700; amount += 1) {
            expect(budgetTierFor(amount)).not.toBeNull();
        }
    });
});
