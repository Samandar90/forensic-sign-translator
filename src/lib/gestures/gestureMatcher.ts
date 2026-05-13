import type { FingerStates, HandLandmarks } from '../detection/handLandmarker'

/**
 * Future-facing gesture layer: definitions, per-frame samples, and a matcher API.
 * No concrete gesture templates or recognition logic — wire models here later.
 */

export interface GestureDefinition {
  readonly id: string
  readonly labelRu: string
  readonly labelUz: string
}

export interface GestureFrame {
  readonly t: number
  readonly landmarks: HandLandmarks
  readonly fingers: FingerStates
}

export interface GestureMatch {
  readonly gestureId: string
  readonly score: number
}

export interface GestureMatcher {
  /** Register or replace a gesture definition (implementation TBD). */
  register(def: GestureDefinition): void
  /** Score the latest frame against known definitions (implementation TBD). */
  match(frame: GestureFrame): readonly GestureMatch[]
}

export function createGestureMatcher(): GestureMatcher {
  const defs = new Map<string, GestureDefinition>()
  return {
    register(def: GestureDefinition): void {
      defs.set(def.id, def)
    },
    match(frame: GestureFrame): readonly GestureMatch[] {
      void frame
      return []
    },
  }
}
