import type { GarmentPose } from './garmentPose';

/** A normalised shoulder estimate, independent of pixel dimensions. */
export interface ShoulderEstimate {
    rotation?: number;
    garmentPose?: GarmentPose;
    /** Centre of the shoulder line, 0–1 across the frame width. */
    centerX: number;
    /** Shoulder line height, 0–1 down the frame height. */
    centerY: number;
    /** Shoulder span as a fraction of frame width, 0–1. */
    width: number;
    /** 0–1. Threshold used to decide whether to follow the estimate. */
    confidence: number;
}

export const AUTO_FOLLOW_CONFIDENCE = 0.6;

/** Convert normalized camera coordinates to the visible object-cover stage. */
export function projectShouldersToStage(
    estimate: ShoulderEstimate,
    video: Pick<HTMLVideoElement, 'videoWidth' | 'videoHeight' | 'clientWidth' | 'clientHeight'>,
): ShoulderEstimate {
    const { videoWidth, videoHeight, clientWidth, clientHeight } = video;
    if (!videoWidth || !videoHeight || !clientWidth || !clientHeight) return estimate;

    const cover = Math.max(clientWidth / videoWidth, clientHeight / videoHeight);
    const widthRatio = videoWidth * cover / clientWidth;
    const heightRatio = videoHeight * cover / clientHeight;
    return {
        ...estimate,
        centerX: 0.5 + (estimate.centerX - 0.5) * widthRatio,
        centerY: 0.5 + (estimate.centerY - 0.5) * heightRatio,
        width: estimate.width * widthRatio,
    };
}

/**
 * Convert a shoulder estimate into overlay slider values.
 *
 * The mapping is intentionally simple and monotonic so the user can reason about
 * it: a wider detected span scales the garment up, a subject off-centre shifts it,
 * and a lower shoulder line moves it down.
 *
 * `baseWidth` is the reference span at which the garment renders at 100% — roughly
 * a person standing at conversational distance from a laptop camera. Everything
 * else is expressed relative to that, which keeps the numbers stable across camera
 * resolutions and aspect ratios.
 */
export function transformFromShoulders(
    estimate: ShoulderEstimate,
    baseWidth = 0.42,
): { scale: number; offsetX: number; offsetY: number } {
    const scaleRatio = clamp(estimate.width / baseWidth, 0.55, 1.9);
    const scale = clamp(Math.round(scaleRatio * 100), 40, 160);

    // A shoulder centre above 0.5 means the subject is in the upper frame; the
    // garment should move up with them. Multiplication converts a 0–1 position into
    // the ±50% slider range.
    const offsetX = clamp(Math.round((0.5 - estimate.centerX) * 100), -50, 50);
    const offsetY = clamp(Math.round((estimate.centerY - 0.28) * 100), -50, 50);

    return { scale, offsetX, offsetY };
}

function clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
}
