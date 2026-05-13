import { PoseLandmarker } from '@mediapipe/tasks-vision'
import type { VisionFileset } from './constants'
import { POSE_LANDMARKER_MODEL } from './constants'

export async function createPoseLandmarker(fileset: VisionFileset): Promise<PoseLandmarker> {
  return PoseLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: POSE_LANDMARKER_MODEL,
      delegate: 'CPU',
    },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputSegmentationMasks: false,
  })
}
