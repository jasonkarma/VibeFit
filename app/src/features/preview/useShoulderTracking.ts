import { useCallback, useEffect, useRef, useState } from 'react';
import {
    AUTO_FOLLOW_CONFIDENCE,
    estimateShouldersFromFrame,
    transformFromShoulders,
    projectShouldersToStage,
    type ShoulderEstimate,
} from './shoulderTracking';
import type { OverlayTransform } from './overlayTransform';

/**
 * Drive automatic shoulder tracking while the camera is live (Sprint 3).
 *
 * Three behaviours matter more than the detection itself:
 *
 *  1. **Tracking is opt-out, not opt-in, once the camera is on** — but it never
 *     overrides the user. Any manual slider movement suspends auto-follow, so the
 *     sliders keep working exactly as they did in Sprint 2. Without this the two
 *     would fight and the overlay would feel possessed.
 *  2. **Smoothing.** Raw per-frame estimates jitter by a few percent, which reads
 *     as a shaking garment. An exponential moving average keeps the overlay calm
 *     while still following real movement.
 *  3. **It must cost nothing when it is not running.** In Vitest, in silhouette
 *     mode, or with the toggle off, the animation loop is never started — so no
 *     `requestAnimationFrame` runs and no canvas is created.
 */

export type TrackingStatus = 'off' | 'searching' | 'tracking';

export interface UseShoulderTrackingOptions {
    /** The live video element, or null when no stream is attached. */
    videoRef: React.RefObject<HTMLVideoElement | null>;
    /** Only track when the camera is genuinely live. */
    active: boolean;
    /** User-facing toggle. */
    enabled: boolean;
    /** Called with smoothed slider values when a confident estimate lands. */
    onTransform: (transform: Pick<OverlayTransform, 'scale' | 'offsetX' | 'offsetY'>) => void;
}

export interface UseShoulderTrackingResult {
    status: TrackingStatus;
    /** Most recent estimate, or null. Useful for the on-screen confidence hint. */
    estimate: ShoulderEstimate | null;
    /** True while auto-follow is moving the garment. */
    autoFollowing: boolean;

}

/** How often to run detection. 12fps is ample and keeps the main thread free. */
const DETECT_INTERVAL_MS = 80;
/** EMA weight for new samples; lower = smoother but laggier. */
const SMOOTHING = 0.22;
/** Frames of consecutive confident detections required before taking over. */
const CONFIRM_FRAMES = 3;

export function useShoulderTracking({
    videoRef,
    active,
    enabled,
    onTransform,
}: UseShoulderTrackingOptions): UseShoulderTrackingResult {
    const [status, setStatus] = useState<TrackingStatus>('off');
    const [estimate, setEstimate] = useState<ShoulderEstimate | null>(null);
    const [autoFollowing, setAutoFollowing] = useState(false);

    /*
     * The callback is stored in a ref so the effect does not need it in its
     * dependency list. If it were a dependency, an inline arrow in the parent would
     * tear down and restart the animation loop on every render — which is both
     * wasteful and a source of dropped frames.
     */
    const onTransformRef = useRef(onTransform);
    useEffect(() => {
        onTransformRef.current = onTransform;
    }, [onTransform]);

    useEffect(() => {
        // Every early return here is a "do not start a loop" guarantee.
        if (!enabled || !active) {
            setStatus('off');
            setEstimate(null);
            setAutoFollowing(false);
            return;
        }

        if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
            return;
        }

        setStatus('searching');
        let frame = 0;
        let cancelled = false;
        let lastRun = 0;
        let hits = 0;
        let canvas: HTMLCanvasElement | undefined;
        let smoothed: ReturnType<typeof transformFromShoulders> | undefined;

        const tick = (now: number) => {
            if (cancelled) return;

            if (now - lastRun >= DETECT_INTERVAL_MS) {
                lastRun = now;
                const video = videoRef.current;

                if (video && video.readyState >= 2) {
                    // One canvas reused across frames; allocating per frame would
                    // churn the GC during a live demo.
                    canvas ??= document.createElement('canvas');
                    const next = estimateShouldersFromFrame(video, canvas);
                    setEstimate(next);

                    if (!next || next.confidence < AUTO_FOLLOW_CONFIDENCE) {
                        hits = 0;
                        setAutoFollowing(false);
                        setStatus('searching');
                    } else {
                        hits += 1;
                        if (hits >= CONFIRM_FRAMES) {
                            // Match the centered object-cover crop before applying
                            // the horizontal mirror in transformFromShoulders.
                            const raw = transformFromShoulders(
                                projectShouldersToStage(next, video),
                            );
                            const previous = smoothed ?? raw;
                            smoothed = {
                                scale: previous.scale + (raw.scale - previous.scale) * SMOOTHING,
                                offsetX: previous.offsetX + (raw.offsetX - previous.offsetX) * SMOOTHING,
                                offsetY: previous.offsetY + (raw.offsetY - previous.offsetY) * SMOOTHING,
                            };
                            onTransformRef.current({
                                scale: Math.round(smoothed.scale),
                                offsetX: Math.round(smoothed.offsetX),
                                offsetY: Math.round(smoothed.offsetY),
                            });
                            setAutoFollowing(true);
                            setStatus('tracking');
                        }
                    }
                }
            }

            frame = window.requestAnimationFrame(tick);
        };

        frame = window.requestAnimationFrame(tick);

        return () => {
            cancelled = true;
            window.cancelAnimationFrame(frame);
        };
    }, [enabled, active, videoRef]);

    return { status, estimate, autoFollowing };
}
