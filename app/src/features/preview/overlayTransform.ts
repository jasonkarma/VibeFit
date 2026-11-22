/**
 * Garment overlay transform for AR try-on.
 *
 * Deliberately a plain data object with no React in it. Two reasons:
 *
 *  1. It is the exact seam a pose-estimation model would write into later. Today a
 *     user drags sliders; tomorrow a model writes the same four numbers. Keeping
 *     the shape stable now means the UI does not change when that happens.
 *  2. It is trivially testable — the transform maths is asserted directly, rather
 *     than by reading computed styles out of jsdom.
 */

export interface OverlayTransform {
    /** Percent scale, 40–160. 100 = the asset's natural size. */
    scale: number;
    /** Horizontal offset in percent of frame width, -50 to 50. */
    offsetX: number;
    /** Vertical offset in percent of frame height, -50 to 50. */
    offsetY: number;
    /** Opacity percent, 20–100. */
    opacity: number;
}

export const DEFAULT_OVERLAY_TRANSFORM: OverlayTransform = {
    scale: 100,
    offsetX: 0,
    offsetY: 0,
    opacity: 90,
};

export const TRANSFORM_LIMITS = {
    scale: { min: 40, max: 160 },
    offsetX: { min: -50, max: 50 },
    offsetY: { min: -50, max: 50 },
    opacity: { min: 20, max: 100 },
} as const;

/**
 * CSS for the overlay element.
 *
 * `transform-origin` sits at 50% 40% rather than dead centre: garments hang from
 * the shoulders, so scaling and shifting from a point near the collar reads
 * naturally. Centre-origin makes a scaled jacket drift away from the body, which
 * is the single fastest way to make a try-on look broken.
 *
 * Only `transform` and `opacity` are animated, per the Sprint 1 performance rule.
 */
export function overlayStyle(transform: OverlayTransform): {
    transform: string;
    opacity: number;
    transformOrigin: string;
} {
    const { scale, offsetX, offsetY, opacity } = clampTransform(transform);
    return {
        transform: `translate(${offsetX}%, ${offsetY}%) scale(${scale / 100})`,
        opacity: opacity / 100,
        transformOrigin: '50% 40%',
    };
}

/** Clamp every field into its allowed range. Guards against bad stored values. */
export function clampTransform(transform: OverlayTransform): OverlayTransform {
    return {
        scale: clamp(transform.scale, TRANSFORM_LIMITS.scale),
        offsetX: clamp(transform.offsetX, TRANSFORM_LIMITS.offsetX),
        offsetY: clamp(transform.offsetY, TRANSFORM_LIMITS.offsetY),
        opacity: clamp(transform.opacity, TRANSFORM_LIMITS.opacity),
    };
}

function clamp(value: number, range: { min: number; max: number }): number {
    if (!Number.isFinite(value)) return range.min;
    return Math.min(range.max, Math.max(range.min, value));
}
