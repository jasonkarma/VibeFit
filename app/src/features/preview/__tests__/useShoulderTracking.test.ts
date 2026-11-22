import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createPoseTracker } from '../poseLandmarker';
import { photoAnchor } from '../photoAnchors';

vi.mock('../poseLandmarker', () => ({ createPoseTracker: vi.fn() }));
import { useShoulderTracking } from '../useShoulderTracking';

afterEach(() => vi.restoreAllMocks());

it('requires consecutive confident frames after a miss or manual pause', async () => {
    const estimate = { centerX: 0.5, centerY: 0.28, width: 0.42, confidence: 1 };
    const detect = vi.fn().mockReturnValue(estimate);
    const close = vi.fn();
    vi.mocked(createPoseTracker).mockResolvedValue({ detect, close });
    let frame: FrameRequestCallback;
    let time = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
        frame = callback;
        return 1;
    });
    const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const video = document.createElement('video');
    Object.defineProperty(video, 'readyState', { value: 2 });
    const videoRef = { current: video };
    const onTransform = vi.fn();
    const { result, rerender } = renderHook(({ active, enabled }) =>
        useShoulderTracking({ videoRef, active, enabled, onTransform }),
        { initialProps: { active: true, enabled: true } },
    );

    function tick() {
        act(() => { video.currentTime += 0.1; frame(time += 100); });
    }

    await waitFor(() => expect(result.current.status).toBe('searching'));
    tick();
    tick();
    detect.mockReturnValueOnce({ ...estimate, confidence: 0 });
    tick();
    tick();
    tick();
    expect(onTransform).not.toHaveBeenCalled();
    tick();
    expect(result.current.autoFollowing).toBe(true);
    expect(onTransform).toHaveBeenCalledTimes(1);

    detect.mockReturnValueOnce(null);
    tick();
    expect(result.current).toMatchObject({ status: 'searching', autoFollowing: false });
    expect(onTransform).toHaveBeenCalledTimes(1);

    rerender({ active: true, enabled: false });
    expect(cancel).toHaveBeenCalled();
    expect(result.current).toMatchObject({ status: 'off', estimate: null });
    rerender({ active: true, enabled: true });
    await waitFor(() => expect(result.current.status).toBe('searching'));
    tick();
    tick();
    expect(onTransform).toHaveBeenCalledTimes(1);
    tick();
    expect(onTransform).toHaveBeenCalledTimes(2);

    rerender({ active: false, enabled: true });
    expect(result.current).toMatchObject({ status: 'off', estimate: null });
});

it('withholds a calibrated photo until the collar can be placed at a supported scale', async () => {
    const shoulders = { centerX: 0.5, centerY: 0.57, width: 0.44, confidence: 1 };
    const detect = vi.fn().mockReturnValue(shoulders);
    vi.mocked(createPoseTracker).mockResolvedValue({ detect, close: vi.fn() });
    let frame: FrameRequestCallback;
    let time = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
        frame = callback;
        return 1;
    });
    const video = document.createElement('video');
    Object.defineProperty(video, 'readyState', { value: 2 });
    const videoRef = { current: video };
    const onTransform = vi.fn();
    const { result } = renderHook(() => useShoulderTracking({
        active: true, enabled: true, videoRef, onTransform,
        anchor: photoAnchor('/catalog/m-soft-crew-flat.jpg'),
    }));

    const advance = () => {
        for (let i = 0; i < 3; i += 1) {
            act(() => { video.currentTime += 0.1; frame(time += 100); });
        }
    };
    await waitFor(() => expect(result.current.status).toBe('searching'));
    advance();
    expect(onTransform).not.toHaveBeenCalled();

    const supported = { ...shoulders, neckline: { x: 0.5, y: 0.49 } };
    detect.mockReturnValue({ ...supported, width: 0.81 });
    advance();
    expect(onTransform).not.toHaveBeenCalled();

    detect.mockReturnValue(supported);
    advance();
    expect(result.current.autoFollowing).toBe(true);
    expect(onTransform).toHaveBeenLastCalledWith({ offsetX: 1, offsetY: 17, rotation: 0, scale: 97 });
});
