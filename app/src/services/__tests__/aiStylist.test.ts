import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_PREFERENCES, NO_COLOR_PREFERENCE, type UserPreferences } from '@/types/domain';
import {
    __getAiConfigForTests,
    __setDegradedForTests,
    extractJson,
    getAiModelLabel,
    getAiStatus,
    interpretParseResponse,
    interpretRankResponse,
    isAiConfigured,
    parsePreferencesWithAi,
    rankOutfitsWithAi,
    sanitiseReason,
} from '../aiStylist';

/**
 * The AI layer must never be load-bearing for correctness.
 *
 * These tests focus on the boundary between "model said something" and "app
 * state changed", because that is where a live model can do real damage: invent
 * an outfit, invent a price, or smuggle in a contradictory preference.
 */

const blank: UserPreferences = { ...EMPTY_PREFERENCES };

const allowedIds = new Set(['o-01', 'o-03', 'o-08']);

describe('configuration and fallback', () => {
    beforeEach(() => {
        __setDegradedForTests(false);
    });

    afterEach(() => {
        __setDegradedForTests(false);
    });

    it('is disabled inside vitest even if a key is present', () => {
        // The suite must never depend on a network or a paid key.
        expect(isAiConfigured()).toBe(false);
        expect(getAiStatus()).toBe('local');
        expect(getAiModelLabel()).toBe('Local Engine');
    });

    it('resolves the default model and base URL from env with sane defaults', () => {
        const config = __getAiConfigForTests();
        expect(config.model).toBe('claude-opus-5-5');
        expect(config.baseUrl).toContain('/v1');
    });

    it('never calls fetch when unconfigured', async () => {
        const spy = vi.spyOn(globalThis, 'fetch');
        const result = await parsePreferencesWithAi('wedding under 250', blank);
        expect(result).toBeNull();
        expect(spy).not.toHaveBeenCalled();
    });

    it('never calls fetch when ranking is unconfigured', async () => {
        const spy = vi.spyOn(globalThis, 'fetch');
        const result = await rankOutfitsWithAi(blank, []);
        expect(result).toBeNull();
        expect(spy).not.toHaveBeenCalled();
    });
});

describe('extractJson', () => {
    it('parses a bare JSON object', () => {
        expect(extractJson('{"reply":"hi"}')).toEqual({ reply: 'hi' });
    });

    it('strips markdown fences the model added despite instructions', () => {
        expect(extractJson('```json\n{"reply":"hi"}\n```')).toEqual({ reply: 'hi' });
    });

    it('recovers JSON surrounded by prose', () => {
        expect(extractJson('Sure! Here you go: {"reply":"hi"} Hope that helps.')).toEqual({
            reply: 'hi',
        });
    });

    it('returns null on genuinely malformed output', () => {
        expect(extractJson('not json at all')).toBeNull();
        expect(extractJson('')).toBeNull();
    });
});

describe('preference interpretation — vocabulary enforcement', () => {
    it('accepts a valid full patch', () => {
        const result = interpretParseResponse(
            {
                reply: 'Set for a wedding.',
                preferences: {
                    occasion: 'Wedding',
                    dressCode: 'Cocktail',
                    budget: 250,
                    styles: ['Minimalist'],
                    colors: [NO_COLOR_PREFERENCE],
                },
            },
            blank,
        );

        expect(result).not.toBeNull();
        expect(result!.patch.occasion).toBe('Wedding');
        expect(result!.patch.dressCode).toBe('Cocktail');
        expect(result!.patch.budget).toBe(250);
        expect(result!.patch.budgetInput).toBe('250');
        expect(result!.patch.styles).toEqual(['Minimalist']);
        expect(result!.patch.colors).toEqual([NO_COLOR_PREFERENCE]);
    });

    it('rejects an occasion outside the vocabulary', () => {
        const result = interpretParseResponse(
            { reply: 'x', preferences: { occasion: 'Funeral' } },
            blank,
        );
        expect(result!.patch.occasion).toBeUndefined();
    });

    it('drops unknown styles but keeps valid ones', () => {
        const result = interpretParseResponse(
            { reply: 'x', preferences: { styles: ['Minimalist', 'Gorpcore', 'Trendy'] } },
            blank,
        );
        expect(result!.patch.styles).toEqual(['Minimalist', 'Trendy']);
    });

    it('enforces No Color Preference exclusivity even if the model contradicts itself', () => {
        const result = interpretParseResponse(
            { reply: 'x', preferences: { colors: ['Black', NO_COLOR_PREFERENCE] } },
            blank,
        );
        // Opt-out wins; the model does not get to hold both.
        expect(result!.patch.colors).toEqual([NO_COLOR_PREFERENCE]);
    });

    it('rejects a non-positive budget through the same rules as the form', () => {
        const zero = interpretParseResponse({ reply: 'x', preferences: { budget: 0 } }, blank);
        expect(zero!.patch.budget).toBeUndefined();

        const negative = interpretParseResponse({ reply: 'x', preferences: { budget: -50 } }, blank);
        expect(negative!.patch.budget).toBeUndefined();
    });

    it('does not emit a patch for a field already set to the same value', () => {
        const current: UserPreferences = { ...blank, occasion: 'Wedding' };
        const result = interpretParseResponse(
            { reply: 'x', preferences: { occasion: 'Wedding' } },
            current,
        );
        expect(result!.patch.occasion).toBeUndefined();
        expect(result!.appliedFields).toEqual([]);
    });

    it('preserves unrelated fields by simply not including them', () => {
        const current: UserPreferences = {
            ...blank,
            occasion: 'Work',
            dressCode: 'Business Formal',
            budget: 300,
            budgetInput: '300',
            styles: ['Classic'],
            colors: ['Navy'],
        };
        const result = interpretParseResponse({ reply: 'x', preferences: { budget: 200 } }, current);

        // Only budget appears in the patch, so everything else survives by omission.
        expect(Object.keys(result!.patch)).toContain('budget');
        expect(result!.patch.occasion).toBeUndefined();
        expect(result!.patch.dressCode).toBeUndefined();
        expect(result!.patch.styles).toBeUndefined();
        expect(result!.patch.colors).toBeUndefined();
    });

    it('flags clarification requests', () => {
        const result = interpretParseResponse(
            { reply: 'What is your budget?', needsClarification: true },
            blank,
        );
        expect(result!.needsClarification).toBe(true);
        expect(result!.understood).toBe(true);
    });

    it('returns null on a structurally invalid payload', () => {
        expect(interpretParseResponse('just a string', blank)).toBeNull();
        expect(interpretParseResponse(null, blank)).toBeNull();
    });
});

describe('ranking interpretation — hallucination guards', () => {
    it('drops outfit IDs that are not in the candidate list', () => {
        const result = interpretRankResponse(
            {
                reply: 'picked',
                rankings: [
                    { outfitId: 'o-01', reason: 'A clean minimalist look for a casual outing.' },
                    { outfitId: 'o-999-does-not-exist', reason: 'Invented outfit.' },
                ],
            },
            allowedIds,
        );

        expect(result).not.toBeNull();
        expect(result).toHaveLength(1);
        expect(result![0].outfitId).toBe('o-01');
    });

    it('returns null-safe empty when every ID was invented', () => {
        const result = interpretRankResponse(
            {
                reply: 'picked',
                rankings: [
                    { outfitId: 'fake-1', reason: 'nope' },
                    { outfitId: 'fake-2', reason: 'nope' },
                ],
            },
            allowedIds,
        );
        expect(result).toEqual([]);
    });

    it('de-duplicates repeated IDs, keeping the first reason', () => {
        const result = interpretRankResponse(
            {
                rankings: [
                    { outfitId: 'o-01', reason: 'First reason wins.' },
                    { outfitId: 'o-01', reason: 'Second reason ignored.' },
                ],
            },
            allowedIds,
        );
        expect(result).toHaveLength(1);
        expect(result![0].reason).toBe('First reason wins.');
    });

    it('caps the result at six, matching the UI limit', () => {
        const bigSet = new Set(Array.from({ length: 12 }, (_, i) => `o-${i}`));
        const result = interpretRankResponse(
            {
                rankings: Array.from({ length: 12 }, (_, i) => ({
                    outfitId: `o-${i}`,
                    reason: `Reason number ${i}.`,
                })),
            },
            bigSet,
        );
        expect(result).toHaveLength(6);
    });

    it('tolerates malformed individual entries without discarding the batch', () => {
        const result = interpretRankResponse(
            {
                rankings: [
                    { outfitId: 'o-01', reason: 'Valid one.' },
                    { outfitId: 'o-03' }, // missing reason
                    null,
                    'garbage',
                    { outfitId: 'o-08', reason: 'Also valid.' },
                ],
            },
            allowedIds,
        );
        expect(result).toHaveLength(2);
        expect(result!.map((r) => r.outfitId)).toEqual(['o-01', 'o-08']);
    });

    it('returns null when the rankings array is missing entirely', () => {
        expect(interpretRankResponse({ reply: 'nothing' }, allowedIds)).toBeNull();
        expect(interpretRankResponse({ rankings: 'not-an-array' }, allowedIds)).toBeNull();
    });
});

describe('reason sanitisation — no invented prices', () => {
    it('removes a dollar amount', () => {
        const cleaned = sanitiseReason('This look comes in at $186, comfortably within budget.');
        expect(cleaned).not.toContain('$');
        expect(cleaned).not.toContain('186');
        expect(cleaned.length).toBeGreaterThan(0);
    });

    it('removes amounts with separators and cents', () => {
        const cleaned = sanitiseReason('Total is $1,249.50 which fits.');
        expect(cleaned).not.toMatch(/\d{3}/);
        expect(cleaned).not.toContain('$');
    });

    it('removes "dollars" phrasings', () => {
        const cleaned = sanitiseReason('Only 250 dollars for the whole outfit.');
        expect(cleaned).not.toContain('250');
        expect(cleaned.toLowerCase()).not.toContain('dollars');
    });

    it('removes USD-prefixed amounts', () => {
        const cleaned = sanitiseReason('Priced at USD 300.');
        expect(cleaned).not.toContain('300');
    });

    it('keeps a clean reason intact and capitalised', () => {
        const cleaned = sanitiseReason('a polished black-tie look for a winter wedding');
        expect(cleaned).toBe('A polished black-tie look for a winter wedding.');
    });

    it('collapses whitespace and tidies punctuation left by removal', () => {
        const cleaned = sanitiseReason('Fits well   at $200 , nice and clean');
        expect(cleaned).not.toMatch(/\s{2,}/);
        expect(cleaned).not.toContain(' ,');
    });

    it('returns empty string when nothing survives, so the caller drops the reason', () => {
        expect(sanitiseReason('$250')).toBe('');
        expect(sanitiseReason('   ')).toBe('');
    });

    it('caps length so a verbose model cannot break the card layout', () => {
        const long = 'A '.repeat(200);
        expect(sanitiseReason(long).length).toBeLessThanOrEqual(160);
    });

    it('drops a price-only remnant rather than surfacing a fragment', () => {
        // After price removal this is nearly empty; better to drop than to show junk.
        const cleaned = sanitiseReason('$120.');
        expect(cleaned.length === 0 || !cleaned.includes('120')).toBe(true);
    });
});
