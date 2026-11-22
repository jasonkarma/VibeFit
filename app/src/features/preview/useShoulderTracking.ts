import { useCallback, useEffect, useRef, useState } from 'react';
import {
    AUTO_FOLLOW_CONFIDENCE,
    estimateShouldersFromFrame,
    transformFromShoulders,
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
    /** Called by manual controls to suspend auto-follow. */
    suspend: () => void;
    /** Re-enable auto-follow after a manual adjustment. */
    resume: () => void;
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

    /** Suspended by a manual adjustment; auto-follow stops until resumed. */
    const suspendedRef = useRef(false);
    /** Smoothed values carried between frames. */
    const smoothedRef = useRef<{ scale: number; offsetX: number; offsetY: number } | null>(null);
    /** Count of consecutive confident hits, to debounce the takeover. */
    const hitsRef = useRef(0);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const suspend = useCallback(() => {
        suspendedRef.current = true;
        setAutoFollowing(false);
        setStatus('off');
    }, []);

    const resume = useCallback(() => {
        suspendedRef.current = false;
        hitsRef.current = 0;
        smoothedRef.current = null;
        setStatus('searching');
    }, []);

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

        const tick = (now: number) => {
            if (cancelled) return;

            if (now - lastRun >= DETECT_INTERVAL_MS) {
                lastRun = now;
                const video = videoRef.current;

                if (video && video.readyState >= 2) {
                    // One canvas reused across frames; allocating per frame would
                    // churn the GC during a live demo.
                    if (!canvasRef.current) {
                        canvasRef.current = document.createElement('canvas');
                    }

                    const next = estimateShouldersFromFrame(video, canvasRef.current);

                    if (!next) {
                        // Losing the subject does not immediately drop the overlay —
                        // a brief miss (turning, blinking light) should not reset the
                        // garment to its default position.
                        hitsRef.current = 0;
                        setEstimate(null);
                        if (!suspendedRef.current) setStatus('searching');
                    } else {
                        hitsRef.current += 1;
                        setEstimate(next);

                        if (suspendedRef.current) {
                            // Tracking continues in the background so the confidence
                            // hint stays live, but nothing moves.
                        } else if (next.confidence >= AUTO_FOLLOW_CONFIDENCE) {
                            const raw = transformFromShoulders(next);
                            const previous = smoothedRef.current;

                            const smoothed = previous
                                ? {
                                    scale: previous.scale + (raw.scale - previous.scale) * SMOOTHING,
                                    offsetX:
                                        previous.offsetX + (raw.offsetX - previous.offsetX) * SMOOTHING,
                                    offsetY:
                                        previous.offsetY + (raw.offsetY - previous.offsetY) * SMOOTHING,
                                }
                                : raw;

                            smoothedRef.current = smoothed;

                            // Only take over after a few consecutive confident hits,
                            // so a single spurious detection never yanks the garment.
                            if (hitsRef.current >= CONFIRM_FRAMES) {
                                onTransformRef.current({
                                    scale: Math.round(smoothed.scale),
                                    offsetX: Math.round(smoothed.offsetX),
                                    offsetY: Math.round(smoothed.offsetY),
                                });
                                setAutoFollowing(true);
                                setStatus('tracking');
                            }
                        } else if (!suspendedRef.current && hitsRef.current < CONFIRM_FRAMES) {
                            setStatus('searching');
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
            canvasRef.current = null;
        };
    }, [enabled, active, videoRef]);

    return { status, estimate, autoFollowing, suspend, resume };
}
