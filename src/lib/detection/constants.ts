import { FilesetResolver } from '@mediapipe/tasks-vision'

export const TASKS_VISION_VERSION = '0.10.21'

export const VISION_WASM_ROOT = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`

export const HAND_LANDMARKER_MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

export const POSE_LANDMARKER_MODEL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

export type VisionFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>

let filesetPromise: Promise<VisionFileset> | null = null

/** Single shared WASM fileset for all vision tasks (smaller init, one cache). */
export function loadVisionTasksFileset(): Promise<VisionFileset> {
  if (!filesetPromise) {
    filesetPromise = FilesetResolver.forVisionTasks(VISION_WASM_ROOT)
  }
  return filesetPromise
}

export function resetVisionFilesetCache(): void {
  filesetPromise = null
}
