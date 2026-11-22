import { PoseLandmarker } from '@mediapipe/tasks-vision';
import wasmLoaderPath from '../../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_nosimd_internal.js?url';
import wasmBinaryPath from '../../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_nosimd_internal.wasm?url';
import { shouldersFromLandmarks } from './poseGeometry';

export async function createPoseTracker() {
    const landmarker = await PoseLandmarker.createFromOptions(
        { wasmLoaderPath, wasmBinaryPath },
        {
            baseOptions: { modelAssetPath: `${import.meta.env.BASE_URL}models/pose-landmarker-lite.task` },
            runningMode: 'VIDEO',
            numPoses: 1,
        },
    );

    return {
        detect(video: HTMLVideoElement, timestamp: number) {
            return shouldersFromLandmarks(landmarker.detectForVideo(video, timestamp).landmarks[0], video);
        },
        close: () => landmarker.close(),
    };
}
