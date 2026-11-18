import { describe, expect, it } from 'vitest';
import {
    MOTION_DISABLED,
    cardReveal,
    pageTransition,
    patchPop,
    shakeTransition,
    staggerContainer,
} from '../motion';

/**
 * Guard test for the design-layer contract.
 *
 * The promise to the team is "animation never owns behaviour". That is easy to
 * state and easy to break three refactors later, so it is enforced here: in a
 * test environment every variant must resolve to a no-op, meaning no assertion
 * can ever depend on a frame having elapsed.
 */
describe('motion is disabled under test', () => {
    it('reports MOTION_DISABLED as true inside Vitest', () => {
        expect(MOTION_DISABLED).toBe(true);
    });

    it('collapses pageTransition to an immediate visible state', () => {
        const variants = pageTransition(false);
        expect(variants.initial).toMatchObject({ opacity: 1 });
        expect((variants.animate as { transition?: unknown }).transition).toBeUndefined();
    });

    it('collapses the stagger container so children mount instantly', () => {
        const variants = staggerContainer(false);
        expect((variants.show as { transition?: unknown }).transition).toBeUndefined();
    });

    it('collapses card reveals to full opacity', () => {
        const variants = cardReveal(false);
        expect(variants.hidden).toMatchObject({ opacity: 1 });
        expect(variants.show).toMatchObject({ opacity: 1 });
    });

    it('collapses patch pops to full size', () => {
        const variants = patchPop(false);
        expect(variants.hidden).toMatchObject({ opacity: 1, scale: 1 });
    });

    it('gives the shake a zero duration', () => {
        expect(shakeTransition(false)).toMatchObject({ duration: 0 });
    });
});

describe('reduced motion collapses the same presets', () => {
    it('honours the reduced flag even outside the test environment', () => {
        const variants = pageTransition(true);
        expect(variants.initial).toMatchObject({ opacity: 1 });
        expect((variants.animate as { transition?: unknown }).transition).toBeUndefined();
    });

    it('shrinks stagger to nothing when reduced', () => {
        const variants = staggerContainer(true);
        expect((variants.show as { transition?: unknown }).transition).toBeUndefined();
    });
});
