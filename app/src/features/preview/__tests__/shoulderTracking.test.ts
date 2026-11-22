import { describe, expect, it } from 'vitest';
import { transformFromShoulders, projectShouldersToStage, type ShoulderEstimate } from '../shoulderTracking';
import { shouldersFromLandmarks } from '../poseGeometry';
import { photoAnchor } from '../photoAnchors';

const viewport = { videoWidth: 1000, videoHeight: 800, clientWidth: 600, clientHeight: 800 };

function landmarks(x: number, y: number) {
    return Array.from({ length: 33 }, (_, index) => ({
        x: x + (index === 12 ? 0.16 : 0),
        y: y + (index === 12 ? 0.04 : 0),
        visibility: index === 12 ? 0.9 : 1,
    }));
}

it('moves the overlay with mirrored shoulder motion and follows tilt', () => {
    const first = shouldersFromLandmarks(landmarks(0.36, 0.45), viewport)!;
    const second = shouldersFromLandmarks(landmarks(0.46, 0.50), viewport)!;
    expect(first.confidence).toBe(0.9);
    expect(first.rotation).toBeLessThan(0);
    expect(transformFromShoulders(first).offsetX).toBeGreaterThan(transformFromShoulders(second).offsetX);
    expect(transformFromShoulders(first).offsetY).toBeLessThan(transformFromShoulders(second).offsetY);
});

it('requires two plausible shoulders inside the camera crop', () => {
    expect(shouldersFromLandmarks(undefined, viewport)).toBeNull();
    expect(shouldersFromLandmarks(landmarks(0.03, 0.45), viewport)).toBeNull();
    expect(shouldersFromLandmarks(landmarks(0.36, 0.03), viewport)).toBeNull();
});

it('places the actual sweater collar above the detected shoulder joints', () => {
    const stage = { videoWidth: 600, videoHeight: 800, clientWidth: 600, clientHeight: 800 };
    const visible = landmarks(0.31, 0.57);
    visible[12] = { x: 0.71, y: 0.57, visibility: 1 };
    visible[9] = { x: 0.47, y: 0.37, visibility: 1 };
    visible[10] = { x: 0.55, y: 0.37, visibility: 1 };
    const estimate = shouldersFromLandmarks(visible, stage)!;
    const anchor = photoAnchor('/catalog/m-soft-crew-flat.jpg')!;
    const transform = transformFromShoulders(estimate, anchor);

    expect(estimate.neckline?.y).toBeCloseTo(0.498, 3);
    expect(anchor.y + transform.offsetY / 100).toBeCloseTo(estimate.neckline!.y, 2);
    expect(anchor.x + transform.offsetX / 100).toBeCloseTo(0.49, 2);
    expect(transform.scale).toBe(88);

    visible[9].visibility = 0.3;
    expect(shouldersFromLandmarks(visible, stage)?.neckline).toBeUndefined();
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
