import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Camera lifecycle for AR try-on (Story 10 AC4–10.5).
 *
 * Three rules drive this hook, all of them privacy or correctness requirements
 * rather than conveniences:
 *
 *  1. **`getUserMedia` is never called without an explicit user action.** Consent is
 *     separate state from device status, and the request only fires from `request()`,
 *     which only the consent card's button calls. Merging the two into one enum is
 *     what produces the bug where "denied" is remembered as "stop asking" and the
 *     user can never retry.
 *  2. **The stream is always released.** Every track is stopped on unmount and on
 *     `stop()`. A prototype that leaves the camera light on after navigation is worse
 *     than one without the feature.
 *  3. **Failure is a first-class outcome, not an exception.** Denial, a missing
 *     device, a device busy in another app, and a browser without the API all resolve
 *     to a rendered silhouette stage. Nothing throws to the caller.
 */

export type CameraStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';

/** Why the camera could not be used, for the fallback copy. */
export type CameraFailureReason =
    | 'permission-denied'
    | 'no-device'
    | 'device-busy'
    | 'not-supported'
    | 'unknown';

export interface CameraState {
    status: CameraStatus;
    reason: CameraFailureReason | null;
    stream: MediaStream | null;
}

export interface UseCameraStreamResult extends CameraState {
    /** Requests the camera. Safe to call repeatedly; no-op while requesting/active. */
    request: () => Promise<void>;
    /** Stops every track and returns to `idle`. */
    stop: () => void;
    /** True while the video should be displayed. */
    isActive: boolean;
}

/**
 * Map a `getUserMedia` rejection to a reason we can explain to the user.
 *
 * `DOMException` names are checked rather than messages, because messages are
 * browser-specific and localised. jsdom and older browsers may reject with a plain
 * `Error`, hence the fallback.
 */
export function classifyCameraError(error: unknown): CameraFailureReason {
    const name =
        error && typeof error === 'object' && 'name' in error
            ? String((error as { name?: unknown }).name ?? '')
            : '';

    switch (name) {
        case 'NotAllowedError':
        case 'PermissionDeniedError':
        case 'SecurityError':
            return 'permission-denied';
        case 'NotFoundError':
        case 'DevicesNotFoundError':
            return 'no-device';
        case 'NotReadableError':
        case 'TrackStartError':
            return 'device-busy';
        case 'TypeError':
        case 'NotSupportedError':
            return 'not-supported';
        default:
            return 'unknown';
    }
}

export function useCameraStream(): UseCameraStreamResult {
    const [state, setState] = useState<CameraState>({
        status: 'idle',
        reason: null,
        stream: null,
    });

    /**
     * The stream is mirrored in a ref because cleanup must see the current value
     * without re-subscribing, and because React batches state updates — reading
     * `state.stream` inside a cleanup closure can observe a stale `null` and leak
     * the device.
     */
    const streamRef = useRef<MediaStream | null>(null);

    const stopTracks = useCallback(() => {
        const stream = streamRef.current;
        if (!stream) return;
        for (const track of stream.getTracks()) {
            try {
                track.stop();
            } catch {
                // A track that refuses to stop is already dead; nothing to recover.
            }
        }
        streamRef.current = null;
    }, []);

    const stop = useCallback(() => {
        stopTracks();
        setState({ status: 'idle', reason: null, stream: null });
    }, [stopTracks]);

    const request = useCallback(async () => {
        // Guard on the ref, not state: a double-click can fire twice before React
        // commits the `requesting` state, and two live streams means one leaks.
        if (streamRef.current) return;

        const mediaDevices =
            typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;

        if (!mediaDevices || typeof mediaDevices.getUserMedia !== 'function') {
            setState({ status: 'unavailable', reason: 'not-supported', stream: null });
            return;
        }

        setState({ status: 'requesting', reason: null, stream: null });

        try {
            const stream = await mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } },
                audio: false,
            });
            streamRef.current = stream;
            setState({ status: 'granted', reason: null, stream });
        } catch (error) {
            const reason = classifyCameraError(error);
            setState({
                status: reason === 'permission-denied' ? 'denied' : 'unavailable',
                reason,
                stream: null,
            });
        }
    }, []);

    // Release the camera on unmount. This is the guarantee that no video source
    // survives a navigation away from the preview.
    useEffect(
        () => () => {
            stopTracks();
        },
        [stopTracks],
    );

    return {
        ...state,
        request,
        stop,
        isActive: state.status === 'granted' && state.stream !== null,
    };
}

/** Copy for each failure reason. One place, so the UI cannot drift from reality. */
export const CAMERA_FAILURE_COPY: Record<CameraFailureReason, string> = {
    'permission-denied':
        'Camera permission was declined. You can still try the garment on over the silhouette — or allow camera access in your browser settings and try again.',
    'no-device':
        'No camera was found on this device. Silhouette mode works exactly the same, minus the live video.',
    'device-busy':
        'The camera is already in use by another application. Close it and try again, or continue with the silhouette.',
    'not-supported':
        'This browser does not expose a camera API. Silhouette mode gives you the same alignment controls.',
    unknown:
        'The camera could not be started. You can retry, or continue in silhouette mode.',
};
