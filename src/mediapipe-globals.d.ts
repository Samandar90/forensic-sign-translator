/**
 * Global type declarations for MediaPipe loaded via CDN <script> tags.
 * The UMD bundles expose these on the global scope.
 */

export interface NormalizedLandmark {
  x: number
  y: number
  z: number
  visibility?: number
}

export type NormalizedLandmarkList = NormalizedLandmark[]
export type NormalizedLandmarkListList = NormalizedLandmarkList[]

export interface Handedness {
  index: number
  score: number
  label: 'Left' | 'Right'
}

export interface HandsResults {
  multiHandLandmarks: NormalizedLandmarkListList
  multiHandWorldLandmarks: NormalizedLandmarkListList
  multiHandedness: Handedness[]
  image: HTMLCanvasElement | HTMLImageElement | ImageBitmap
}

export interface HandsOptions {
  selfieMode?: boolean
  maxNumHands?: number
  modelComplexity?: 0 | 1
  minDetectionConfidence?: number
  minTrackingConfidence?: number
}

export interface HandsConfig {
  locateFile?: (path: string, prefix?: string) => string
}

declare class HandsClass {
  constructor(config?: HandsConfig)
  setOptions(options: HandsOptions): void
  onResults(listener: (results: HandsResults) => void): void
  initialize(): Promise<void>
  reset(): void
  send(inputs: { image: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement }): Promise<void>
  close(): Promise<void>
}

declare global {
  const Hands: typeof HandsClass
}
