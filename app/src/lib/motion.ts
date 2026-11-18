import { useEffect, useState } from 'react';
import type { Transition, Variants } from 'framer-motion';

/**
 * Motion vocabulary — "Editorial Obsidian & Champagne".
 *
 * Hard rule: animation is presentational only. It never gates mount, never
 * carries information that isn't also in the DOM or in an aria attribute, and
 * it fully collapses under reduced motion and inside Vitest.
 */

/** True inside Vitest, where every animation must resolve synchronously. */
export const MOTION_DISABLED: boolean =
    Boolean(import.meta.env?.VITEST) || import.meta.env?.MODE === 'test';

export const easing = {
    editorial: [0.22, 1, 0.36, 1] as [number, number, number, number],
    snap: [0.4, 0, 0.2, 1] as [number, number, number, number],
};

export function pageTransition(reduced: boolean): Variants {
    if (reduced || MOTION_DISABLED) {
        return { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } };
    }
    return {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.24, ease: easing.editorial } },
        exit: { opacity: 0, y: -4, transition: { duration: 0.16, ease: easing.editorial } },
    };
}

export function staggerContainer(reduced: boolean): Variants {
    if (reduced || MOTION_DISABLED) {
        return { hidden: {}, show: {} };
    }
    return {
        hidden: {},
        show: {
            transition: { staggerChildren: 0.08, delayChildren: 0.04 },
        },
    };
}

export function cardReveal(reduced: boolean): Variants {
    if (reduced || MOTION_DISABLED) {
        return { hidden: { opacity: 1 }, show: { opacity: 1 } };
    }
    return {
        hidden: { opacity: 0, y: 12 },
        show: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.32, ease: easing.editorial },
        },
    };
}

export function patchPop(reduced: boolean): Variants {
    if (reduced || MOTION_DISABLED) {
        return { hidden: { opacity: 1, scale: 1 }, show: { opacity: 1, scale: 1 } };
    }
    return {
        hidden: { opacity: 0, scale: 0.9 },
        show: { opacity: 1, scale: 1, transition: { duration: 0.18, ease: easing.snap } },
    };
}

export const shakeKeyframes = [0, -6, 6, -3, 0];

export function shakeTransition(reduced: boolean): Transition {
    if (reduced || MOTION_DISABLED) return { duration: 0 };
    return { duration: 0.22, ease: 'easeInOut' };
}

/** Matches the CSS `prefers-reduced-motion` query and stays in sync with it. */
export function usePrefersReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
        const query = window.matchMedia('(prefers-reduced-motion: reduce)');
        setReduced(query.matches);

        const handler = (event: MediaQueryListEvent) => setReduced(event.matches);
        // Safari < 14 only supports addListener.
        if (typeof query.addEventListener === 'function') {
            query.addEventListener('change', handler);
            return () => query.removeEventListener('change', handler);
        }
        query.addListener(handler);
        return () => query.removeListener(handler);
    }, []);

    return reduced;
}

/**
 * One hook giving every component the same collapsed-or-animated decision.
 * `reduced` is true in Vitest regardless of the OS setting.
 */
export function useMotion() {
    const prefersReduced = usePrefersReducedMotion();
    const reduced = prefersReduced || MOTION_DISABLED;

    return {
        reduced,
        page: pageTransition(reduced),
        container: staggerContainer(reduced),
        card: cardReveal(reduced),
        patch: patchPop(reduced),
        shake: shakeTransition(reduced),
    };
}
