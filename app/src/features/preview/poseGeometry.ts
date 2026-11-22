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
    if (!pose || !left || !right) return null;

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

    const centerX = (a.centerX + b.centerX) / 2;
    const width = Math.hypot(dx, dy);
    const mouthLeft = pose[9];
    const mouthRight = pose[10];
    let neckline: ShoulderEstimate['neckline'];
    if (mouthLeft?.visibility >= 0.65 && mouthRight?.visibility >= 0.65) {
        const mouth = projectShouldersToStage({
            centerX: (mouthLeft.x + mouthRight.x) / 2,
            centerY: (mouthLeft.y + mouthRight.y) / 2,
            width: 0,
            confidence: Math.min(mouthLeft.visibility, mouthRight.visibility),
        }, video);
        const shoulderSpanInHeight = width / aspect;
        const gap = centerY - mouth.centerY;
        // Locate the front collar between the projected shoulder joints and
        // the mouth. Require the mouth to be visible and above the torso.
        if (mouth.centerY > 0 && mouth.centerX > a.centerX && mouth.centerX < b.centerX &&
            gap >= shoulderSpanInHeight * 0.12 && gap <= shoulderSpanInHeight * 0.95) {
            const lift = Math.min(0.24 * shoulderSpanInHeight, 0.40 * gap);
            neckline = { x: centerX + lift * aspect * dy / dx, y: centerY - lift };
        }
    }

    return {
        centerX,
        centerY,
        width,
        confidence: Math.min(a.confidence, b.confidence),
        neckline,
        rotation: -Math.atan2(dy, dx) * 180 / Math.PI,
    };
}
