import { projectShouldersToStage } from './shoulderTracking';

export interface PosePoint {
    x: number;
    y: number;
    z: number;
    visibility: number;
}

export interface GarmentPose {
    shoulders: [PosePoint, PosePoint];
    elbows: [PosePoint | null, PosePoint | null];
    wrists: [PosePoint | null, PosePoint | null];
    hips: [PosePoint | null, PosePoint | null];
}

type CameraViewport = Pick<HTMLVideoElement, 'videoWidth' | 'videoHeight' | 'clientWidth' | 'clientHeight'>;

export function garmentPoseFromLandmarks(
    landmarks: Array<Omit<PosePoint, 'z'> & { z?: number }>,
    video: CameraViewport,
): GarmentPose | undefined {
    const aspect = video.clientWidth && video.clientHeight ? video.clientHeight / video.clientWidth : 1;
    const point = (index: number): PosePoint | null => {
        const landmark = landmarks[index];
        if (!landmark || landmark.visibility < 0.6 ||
            ![landmark.x, landmark.y, landmark.z].every(Number.isFinite)) return null;
        const stage = projectShouldersToStage({
            centerX: landmark.x, centerY: landmark.y, width: 1, confidence: landmark.visibility,
        }, video);
        return {
            x: 1 - stage.centerX,
            y: -stage.centerY * aspect,
            z: -(landmark.z ?? 0) * stage.width,
            visibility: landmark.visibility,
        };
    };
    const left = point(11);
    const right = point(12);
    if (!left || !right) return;
    return {
        shoulders: [left, right],
        elbows: [point(13), point(14)],
        wrists: [point(15), point(16)],
        hips: [point(23), point(24)],
    };
}
