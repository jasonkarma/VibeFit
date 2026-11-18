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
