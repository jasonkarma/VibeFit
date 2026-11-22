import { describe, expect, it, vi } from 'vitest';
import {
    AUTO_FOLLOW_CONFIDENCE,
    MIN_CONFIDENCE,
    estimateShouldersFromFrame,
    transformFromShoulders,
    projectShouldersToStage,
    type ShoulderEstimate,
} from '../shoulderTracking';

/**
 * Automatic shoulder tracking (Sprint 3).
 *
 * The detection itself needs a real video frame, so the pixel path is exercised
 * with a synthetic canvas. What matters most for correctness — and what these tests
 * focus on — is the *contract*: a failed detection returns `null` rather than
 * nonsense, and the transform mapping is monotonic and clamped.
 */

/** Build a fake video element with the dimensions the estimator reads. */
function fakeVideo(width = 640, height = 480): HTMLVideoElement {
    return { videoWidth: width, videoHeight: height } as unknown as HTMLVideoElement;
}

/**
 * Install a canvas stub whose `getImageData` returns a synthetic frame.
 * `paint(x, y)` chooses the colour for each sampled pixel.
 */
function stubCanvas(sampleW: number, sampleH: number, paint: (x: number, y: number) => number) {
    const data = new Uint8ClampedArray(sampleW * sampleH * 4);
    for (let y = 0; y < sampleH; y += 1) {
        for (let x = 0; x < sampleW; x += 1) {
            const luma = paint(x, y);
            const i = (y * sampleW + x) * 4;
            data[i] = luma;
            data[i + 1] = luma;
            data[i + 2] = luma;
            data[i + 3] = 255;
        }
    }

    const canvas = {
        width: 0,
        height: 0,
        getContext: () => ({
            drawImage: vi.fn(),
            getImageData: () => ({ data }),
        }),
    } as unknown as HTMLCanvasElement;

    return canvas;
}

describe('estimateShouldersFromFrame — failure handling', () => {
    it('returns null when the video has no dimensions yet', () => {
        // A camera that has been granted but has not produced a frame. Reading it
        // would throw on some browsers, so this must short-circuit.
        expect(estimateShouldersFromFrame(fakeVideo(0, 0))).toBeNull();
    });

    it('returns null when no 2D context is available', () => {
        const canvas = {
            getContext: () => null,
        } as unknown as HTMLCanvasElement;
        expect(estimateShouldersFromFrame(fakeVideo(), canvas)).toBeNull();
    });

    it('returns null when reading pixels throws (tainted canvas)', () => {
        const canvas = {
            getContext: () => ({
                drawImage: vi.fn(),
                getImageData: () => {
                    throw new DOMException('Security error', 'SecurityError');
                },
            }),
        } as unknown as HTMLCanvasElement;

        // Must not propagate — a cross-origin stream should degrade, not crash.
        expect(estimateShouldersFromFrame(fakeVideo(), canvas)).toBeNull();
    });

    it('returns null for a uniformly dark frame (lens covered)', () => {
        const canvas = stubCanvas(96, 128, () => 4);
        expect(estimateShouldersFromFrame(fakeVideo(), canvas)).toBeNull();
    });

    it('returns null for a uniformly bright frame (blown out)', () => {
        const canvas = stubCanvas(96, 128, () => 252);
        expect(estimateShouldersFromFrame(fakeVideo(), canvas)).toBeNull();
    });

    it('returns null for a flat wall with no subject', () => {
        // Low variance: there is nothing to find, and inventing a subject would
        // move the garment somewhere wrong.
        const canvas = stubCanvas(96, 128, (x, y) => 120 + ((x + y) % 3));
        expect(estimateShouldersFromFrame(fakeVideo(), canvas)).toBeNull();
    });
});

describe('estimateShouldersFromFrame — detection', () => {
    /** Wall at ~200 luma; a darker torso band centred horizontally. */
    function subjectFrame(centerFraction = 0.5, spanFraction = 0.5) {
        return stubCanvas(96, 128, (x, y) => {
            const inUpperBody = y >= 20 && y <= 56;
            const halfSpan = (spanFraction * 96) / 2;
            const centre = centerFraction * 96;
            const isSubject = inUpperBody && Math.abs(x - centre) <= halfSpan;
            return isSubject ? 60 : 200;
        });
    }

    it('finds a centred subject and reports plausible values', () => {
        const estimate = estimateShouldersFromFrame(fakeVideo(), subjectFrame());

        expect(estimate).not.toBeNull();
        const { centerX, centerY, width, confidence } = estimate!;

        expect(centerX).toBeGreaterThan(0.4);
        expect(centerX).toBeLessThan(0.6);
        expect(width).toBeGreaterThan(0.3);
        expect(width).toBeLessThan(0.8);
        // Shoulder line must sit in the upper half of the frame.
        expect(centerY).toBeLessThan(0.5);
        expect(confidence).toBeGreaterThanOrEqual(MIN_CONFIDENCE);
    });

    it('detects an off-centre subject as off-centre', () => {
        const estimate = estimateShouldersFromFrame(fakeVideo(), subjectFrame(0.3, 0.45));
        expect(estimate).not.toBeNull();
        expect(estimate!.centerX).toBeLessThan(0.5);
    });

    it('reports higher confidence for a centred subject than a cornered one', () => {
        const centred = estimateShouldersFromFrame(fakeVideo(), subjectFrame(0.5, 0.5));
        const cornered = estimateShouldersFromFrame(fakeVideo(), subjectFrame(0.12, 0.5));
        expect(centred).not.toBeNull();
        // A detection hugging the frame edge is usually furniture; if it survives the
        // threshold at all it must be less confident than a centred person.
        if (cornered) expect(cornered.confidence).toBeLessThan(centred!.confidence);
    });
});

describe('transformFromShoulders — mapping', () => {
    const base: ShoulderEstimate = { centerX: 0.5, centerY: 0.28, width: 0.42, confidence: 0.9 };

    it('maps a reference-width subject to 100% scale with no offset', () => {
        const result = transformFromShoulders(base);
        expect(result.scale).toBe(100);
        expect(result.offsetX).toBe(0);
        expect(result.offsetY).toBe(0);
    });

    it('scales up for a wider detected span and down for a narrower one', () => {
        const wide = transformFromShoulders({ ...base, width: 0.6 });
        const narrow = transformFromShoulders({ ...base, width: 0.28 });

        expect(wide.scale).toBeGreaterThan(100);
        expect(narrow.scale).toBeLessThan(100);
    });

    it('shifts horizontally opposite to the subject position', () => {
        // Subject on the left → garment moves right to stay on them.
        const left = transformFromShoulders({ ...base, centerX: 0.3 });
        const right = transformFromShoulders({ ...base, centerX: 0.7 });

        expect(left.offsetX).toBeGreaterThan(0);
        expect(right.offsetX).toBeLessThan(0);
    });

    it('shifts vertically with the shoulder line', () => {
        const low = transformFromShoulders({ ...base, centerY: 0.4 });
        expect(low.offsetY).toBeGreaterThan(0);
    });

    it('clamps every output into the slider ranges', () => {
        const extreme = transformFromShoulders({
            centerX: -5,
            centerY: 9,
            width: 40,
            confidence: 1,
        });
        expect(extreme.scale).toBeGreaterThanOrEqual(40);
        expect(extreme.scale).toBeLessThanOrEqual(160);
        expect(extreme.offsetX).toBeGreaterThanOrEqual(-50);
        expect(extreme.offsetX).toBeLessThanOrEqual(50);
        expect(extreme.offsetY).toBeGreaterThanOrEqual(-50);
        expect(extreme.offsetY).toBeLessThanOrEqual(50);
    });

    it('is monotonic in detected width', () => {
        // Guards against a mapping that jumps around, which would read as a glitch.
        const scales = [0.2, 0.3, 0.4, 0.5, 0.6].map(
            (width) => transformFromShoulders({ ...base, width }).scale,
        );
        for (let i = 1; i < scales.length; i += 1) {
            expect(scales[i]).toBeGreaterThanOrEqual(scales[i - 1]);
        }
    });

    it('keeps the auto-follow threshold above the reporting threshold', () => {
        // Two thresholds exist on purpose: a detection can be confident enough to
        // report but not confident enough to move the garment.
        expect(AUTO_FOLLOW_CONFIDENCE).toBeGreaterThan(MIN_CONFIDENCE);
    });
});

it('projects a landscape camera frame onto the cropped portrait stage before mirroring', () => {
    const estimate = { centerX: 0.4, centerY: 0.28, width: 0.2, confidence: 0.9 };
    const projected = projectShouldersToStage(estimate, {
        videoWidth: 1600,
        videoHeight: 900,
        clientWidth: 300,
        clientHeight: 400,
    });
    expect(projected.centerX).toBeCloseTo(0.263);
    expect(projected.centerY).toBe(0.28);
    expect(transformFromShoulders(projected).offsetX).toBe(24);
    expect(transformFromShoulders(projected).scale).toBe(113);
});
