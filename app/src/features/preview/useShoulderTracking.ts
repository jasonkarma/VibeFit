import { useEffect, useRef, useState } from 'react';
import { AUTO_FOLLOW_CONFIDENCE, transformFromShoulders, type ShoulderEstimate } from './shoulderTracking';
import type { OverlayTransform } from './overlayTransform';
import type { createPoseTracker } from './poseLandmarker';

type TrackingStatus = 'off' | 'loading' | 'searching' | 'tracking' | 'unavailable';
type PoseTracker = Awaited<ReturnType<typeof createPoseTracker>>;
type TrackedTransform = Pick<OverlayTransform, 'scale' | 'offsetX' | 'offsetY'> & { rotation: number };
const FRAME_INTERVAL_MS = 65;

interface UseShoulderTrackingOptions {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    active: boolean;
    enabled: boolean;
    onTransform: (transform: TrackedTransform) => void;
}

export function useShoulderTracking({ videoRef, active, enabled, onTransform }: UseShoulderTrackingOptions) {
    const [status, setStatus] = useState<TrackingStatus>('off');
    const [estimate, setEstimate] = useState<ShoulderEstimate | null>(null);
    const onTransformRef = useRef(onTransform);
    useEffect(() => { onTransformRef.current = onTransform; }, [onTransform]);

    useEffect(() => {
        if (!active || !enabled) {
            setStatus('off');
            setEstimate(null);
            return;
        }

        let tracker: PoseTracker | undefined;
        let cancelled = false;
        let frame = 0;
        let lastRun = 0;
        let lastVideoTime = -1;
        let hits = 0;
        let previous: TrackedTransform | undefined;
        setStatus('loading');

        function tick(now: number) {
            if (cancelled || !tracker) return;
            const video = videoRef.current;
            if (video && video.readyState >= 2 && video.currentTime !== lastVideoTime && now - lastRun >= FRAME_INTERVAL_MS) {
                lastRun = now;
                lastVideoTime = video.currentTime;
                try {
                    const next = tracker.detect(video, now);
                    setEstimate(next);
                    if (!next || next.confidence < AUTO_FOLLOW_CONFIDENCE) {
                        hits = 0;
                        previous = undefined;
                        setStatus('searching');
                    } else if (++hits >= 3) {
                        const raw = { ...transformFromShoulders(next), rotation: next.rotation ?? 0 };
                        const smooth = (key: keyof TrackedTransform) =>
                            previous ? previous[key] + (raw[key] - previous[key]) * 0.38 : raw[key];
                        previous = { scale: smooth('scale'), offsetX: smooth('offsetX'), offsetY: smooth('offsetY'), rotation: smooth('rotation') };
                        onTransformRef.current(previous);
                        setStatus('tracking');
                    }
                } catch {
                    setEstimate(null);
                    setStatus('unavailable');
                    tracker.close();
                    tracker = undefined;
                    return;
                }
            }
            frame = window.requestAnimationFrame(tick);
        }

        void import('./poseLandmarker').then(({ createPoseTracker }) => {
            if (!cancelled) return createPoseTracker();
        }).then((created) => {
            if (!created) return;
            if (cancelled) {
                created.close();
                return;
            }
            tracker = created;
            setStatus('searching');
            frame = window.requestAnimationFrame(tick);
        }).catch(() => {
            if (!cancelled) setStatus('unavailable');
        });

        return () => {
            cancelled = true;
            window.cancelAnimationFrame(frame);
            tracker?.close();
        };
    }, [active, enabled, videoRef]);

    return { status, estimate, autoFollowing: status === 'tracking' };
}
