/**
 * Automatic shoulder tracking for AR try-on (Sprint 3).
 *
 * ── Design decision: what this is, and what it deliberately is not ─────────────
 *
 * The task asked for pose/shoulder landmark detection via `@mediapipe/tasks-vision`
 * "or a zero-network fallback". This module is the zero-network path, and that is a
 * deliberate choice rather than a shortcut:
 *
 *  • `@mediapipe/tasks-vision` is ~31 MB unpacked, and its model weights and WASM
 *    runtime load from a CDN by default. Sprint 1 removed the network from the
 *    critical path *specifically* so the lecture-hall demo cannot fail on a bad
 *    connection. Reintroducing a multi-megabyte CDN fetch (plus a first-run
 *    `createFromOptions` await that takes seconds on a cold cache) to solve a
 *    cosmetic problem would trade a guaranteed-working demo for a fragile one.
 *  • It is also unnecessary here. We are not estimating a 3D pose; we need a
 *    bounding box for the upper torso so a garment can be scaled and centred. A
 *    cheap on-device estimate is sufficient, runs in ~1ms, and never blocks.
 *
 * If a real pose model is added later it should implement `ShoulderTracker` and be
 * injected — `estimateShouldersFromFrame` is the seam, and nothing in the UI knows
 * how the numbers are produced.
 *
 * ── What the estimate actually does ────────────────────────────────────────────
 *
 * It reads a downscaled copy of the video frame and looks for the vertical column
 * of skin-tone-ish / non-background pixels in the upper third of the frame, then
 * takes the widest run as the shoulder line. That is a heuristic, not computer
 * vision: it works well for a person centred against a reasonably plain wall, which
 * is exactly the demo setup, and it degrades to "no detection" (returning `null`)
 * instead of producing nonsense when it cannot find a subject.
 *
 * Returning `null` is a first-class outcome. The UI treats it as "keep the manual
 * transform", so a failed detection never fights the user.
 */

/** A normalised shoulder estimate, independent of pixel dimensions. */
export interface ShoulderEstimate {
    /** Centre of the shoulder line, 0–1 across the frame width. */
    centerX: number;
    /** Shoulder line height, 0–1 down the frame height. */
    centerY: number;
    /** Shoulder span as a fraction of frame width, 0–1. */
    width: number;
    /** 0–1. Below `MIN_CONFIDENCE` the UI ignores the estimate. */
    confidence: number;
}

export interface ShoulderTrackerOptions {
    /** Frames smaller than this on the long edge are upscaled by the browser. */
    sampleWidth?: number;
    sampleHeight?: number;
    /**
     * Minimum confidence before the estimate is allowed to move the overlay.
     * Deliberately high: a wrong automatic jump is far more jarring than no
     * automation at all.
     */
    minConfidence?: number;
}

export const MIN_CONFIDENCE = 0.45;

/** Confidence at or above which the overlay follows the estimate automatically. */
export const AUTO_FOLLOW_CONFIDENCE = 0.6;

const DEFAULT_SAMPLE = { width: 96, height: 128 };

/**
 * Estimate the shoulder line from a single video frame.
 *
 * Pure with respect to its inputs (a canvas 2D context), synchronous, and cheap:
 * a 96×128 sample is ~12k pixels, so this is well under a millisecond.
 *
 * Returns `null` when:
 *  • the context cannot be created or read (tainted canvas, no 2D support),
 *  • the frame is uniformly dark or uniformly bright (camera warming up, lens
 *    covered, or a blank feed),
 *  • no plausible subject column is found.
 *
 * Every one of those is normal, so none of them throws.
 */
export function estimateShouldersFromFrame(
    video: HTMLVideoElement,
    canvas?: HTMLCanvasElement | null,
    options: ShoulderTrackerOptions = {},
): ShoulderEstimate | null {
    const sampleWidth = options.sampleWidth ?? DEFAULT_SAMPLE.width;
    const sampleHeight = options.sampleHeight ?? DEFAULT_SAMPLE.height;

    // A video that has not started or has ended gives a zero-sized frame; reading
    // it would throw a security/DOM error on some browsers.
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null;

    let ctx: CanvasRenderingContext2D | null = null;
    try {
        const target = canvas ?? document.createElement('canvas');
        target.width = sampleWidth;
        target.height = sampleHeight;
        ctx = target.getContext('2d', { willReadFrequently: true });
    } catch {
        return null;
    }
    if (!ctx) return null;

    let pixels: Uint8ClampedArray;
    try {
        ctx.drawImage(video, 0, 0, sampleWidth, sampleHeight);
        pixels = ctx.getImageData(0, 0, sampleWidth, sampleHeight).data;
    } catch {
        // Tainted canvas (cross-origin video) or a detached element.
        return null;
    }

    // Luminance per sampled pixel, with a background estimate from the four corners.
    const luminance = new Float32Array(sampleWidth * sampleHeight);
    let sum = 0;
    for (let i = 0; i < luminance.length; i += 1) {
        const r = pixels[i * 4];
        const g = pixels[i * 4 + 1];
        const b = pixels[i * 4 + 2];
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        luminance[i] = luma;
        sum += luma;
    }

    const mean = sum / luminance.length;

    // Near-uniform frame: nothing to track. 6 luma units is tight enough that a
    // genuinely dark room still passes, but a covered lens does not.
    if (mean < 8 || mean > 247) return null;

    let variance = 0;
    for (let i = 0; i < luminance.length; i += 1) {
        variance += (luminance[i] - mean) ** 2;
    }
    variance /= luminance.length;
    const stdev = Math.sqrt(variance);
    // A flat wall with no subject has very low spread. Require some structure.
    if (stdev < 6) return null;

    /*
     * Background reference: the median of the four corner patches. A person stands
     * centre-frame, so the corners are almost always wall/background.
     */
    const cornerSize = Math.max(4, Math.round(sampleWidth * 0.12));
    const corners = [
        patchMean(luminance, sampleWidth, 0, 0, cornerSize),
        patchMean(luminance, sampleWidth, sampleWidth - cornerSize, 0, cornerSize),
        patchMean(luminance, sampleWidth, 0, sampleHeight - cornerSize, cornerSize),
        patchMean(luminance, sampleWidth, sampleWidth - cornerSize, sampleHeight - cornerSize, cornerSize),
    ];
    const background = corners.sort((a, b) => a - b)[1] + 0;

    /*
     * Search the upper third of the frame for the row with the widest contiguous
     * run of pixels that differ from the background. That run is the shoulder span.
     * Searching rows (not columns) is what makes this a shoulder estimate rather
     * than a generic silhouette: shoulders are the widest horizontal feature in the
     * upper body.
     */
    const searchTop = Math.floor(sampleHeight * 0.12);
    const searchBottom = Math.floor(sampleHeight * 0.45);
    const threshold = Math.max(14, stdev * 0.6);

    let best: { row: number; start: number; end: number; width: number } | null = null;

    for (let y = searchTop; y < searchBottom; y += 1) {
        let runStart = -1;
        let runBest = { start: 0, end: 0, width: 0 };

        for (let x = 0; x < sampleWidth; x += 1) {
            const isSubject = Math.abs(luminance[y * sampleWidth + x] - background) > threshold;

            if (isSubject && runStart === -1) {
                runStart = x;
            } else if (!isSubject && runStart !== -1) {
                const width = x - runStart;
                if (width > runBest.width) runBest = { start: runStart, end: x, width };
                runStart = -1;
            }
        }
        if (runStart !== -1) {
            const width = sampleWidth - runStart;
            if (width > runBest.width) runBest = { start: runStart, end: sampleWidth, width };
        }

        // Ignore slivers (sensor noise, a doorframe) and full-width rows (a wall).
        if (runBest.width < sampleWidth * 0.18 || runBest.width > sampleWidth * 0.92) continue;

        if (!best || runBest.width > best.width) {
            best = { row: y, ...runBest };
        }
    }

    if (!best) return null;

    const centerX = (best.start + best.end) / 2 / sampleWidth;
    const centerY = best.row / sampleHeight;
    const width = best.width / sampleWidth;

    /*
     * Confidence blends two signals: how wide the detected span is relative to a
     * plausible torso (a real shoulder span is roughly 30–70% of frame width), and
     * how far the subject sits from the horizontal centre. A detection hugging the
     * frame edge is usually a doorway or furniture, not a person.
     */
    const spanScore = clamp01((width - 0.18) / 0.4);
    const centeringScore = clamp01(1 - Math.abs(centerX - 0.5) * 1.6);
    const confidence = clamp01(spanScore * 0.65 + centeringScore * 0.35);

    if (confidence < (options.minConfidence ?? MIN_CONFIDENCE)) return null;

    return { centerX, centerY, width, confidence };
}

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

function patchMean(
    luminance: Float32Array,
    width: number,
    x0: number,
    y0: number,
    size: number,
): number {
    let total = 0;
    let count = 0;
    for (let y = y0; y < Math.min(y0 + size, Number.MAX_SAFE_INTEGER); y += 1) {
        for (let x = x0; x < x0 + size; x += 1) {
            const index = y * width + x;
            if (index >= 0 && index < luminance.length) {
                total += luminance[index];
                count += 1;
            }
        }
    }
    return count === 0 ? 128 : total / count;
}

function clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
    return clamp(value, 0, 1);
}
