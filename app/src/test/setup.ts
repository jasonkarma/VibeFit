import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
    cleanup();
    window.localStorage.clear();
});

/**
 * jsdom has no `matchMedia`. Default to "no reduced-motion preference" so the
 * motion layer is exercised, and let individual tests override it.
 */
if (typeof window !== 'undefined' && !window.matchMedia) {
    window.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
}

/** jsdom lacks IntersectionObserver, which framer-motion probes for. */
if (typeof window !== 'undefined' && !('IntersectionObserver' in window)) {
    class MockIntersectionObserver {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
        takeRecords = vi.fn(() => []);
        root = null;
        rootMargin = '';
        thresholds = [];
    }
    Object.defineProperty(window, 'IntersectionObserver', {
        writable: true,
        configurable: true,
        value: MockIntersectionObserver,
    });
}

if (typeof window !== 'undefined' && !window.scrollTo) {
    Object.defineProperty(window, 'scrollTo', { writable: true, value: vi.fn() });
}

/**
 * jsdom does not implement media playback. `HTMLMediaElement.prototype.play` throws
 * "Not implemented" and logs to stderr, which floods the output of every AR test and
 * hides real failures.
 *
 * Stubbed to return a resolved promise so it behaves like a browser that allowed
 * playback. Tests that care about a *blocked* autoplay reject this promise
 * locally — the stub is the optimistic default, not a claim about reality.
 *
 * `getUserMedia` is deliberately NOT stubbed here: its absence is a real
 * production state (browsers without the API), and the preview tests install their
 * own stub where a camera is needed.
 */
if (typeof window !== 'undefined' && window.HTMLMediaElement) {
    Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
        configurable: true,
        writable: true,
        value: vi.fn(() => Promise.resolve()),
    });
    Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', {
        configurable: true,
        writable: true,
        value: vi.fn(),
    });
}
