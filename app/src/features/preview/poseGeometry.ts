import { projectShouldersToStage, type ShoulderEstimate } from './shoulderTracking';

interface Landmark {
    x: number;
    y: number;
    visibility: number;
}

export function shouldersFromLandmarks(
    pose: Landmark[] | undefined,
    video: Pick<HTMLVideoElement, 'videoWidth' | 'videoHeight' | 'clientWidth' | 'clientHeight'>,
): ShoulderEstimate | null {
    const left = pose?.[11];
    const right = pose?.[12];
    if (!left || !right) return null;

    const first = projectShouldersToStage({ centerX: left.x, centerY: left.y, width: 0, confidence: left.visibility }, video);
    const second = projectShouldersToStage({ centerX: right.x, centerY: right.y, width: 0, confidence: right.visibility }, video);
    const [a, b] = first.centerX < second.centerX ? [first, second] : [second, first];
    const dx = b.centerX - a.centerX;
    const centerY = (a.centerY + b.centerY) / 2;
    const aspect = video.clientWidth && video.clientHeight ? video.clientHeight / video.clientWidth : 1;
    const dy = (b.centerY - a.centerY) * aspect;

    // Require both shoulders to be on screen and a mostly front-facing pose.
    if (a.centerX < 0 || b.centerX > 1 || centerY < 0.18 || centerY > 0.82 ||
        dx < 0.14 || Math.abs(dy) > dx * 0.45) return null;

    return {
        centerX: (a.centerX + b.centerX) / 2,
        centerY,
        width: Math.hypot(dx, dy),
        confidence: Math.min(a.confidence, b.confidence),
        rotation: -Math.atan2(dy, dx) * 180 / Math.PI,
    };
}
