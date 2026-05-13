import type { AdvancedGestureId } from '../gestureTypes'

/** Normalized palm motion features (0–1 scales, except speed in relative units / frame). */
export interface PalmMotionSnapshot {
  /** Approximate palm speed relative to hand scale (per frame delta). */
  readonly speed: number
  /** Max lateral (x) travel in window, normalized by hand scale. */
  readonly lateralExcursion: number
  /** 0–1: sign-flip / oscillation energy for “wave” hello. */
  readonly oscillationScore: number
}

export interface SingleHandIntelligenceDebug {
  readonly scores: Record<AdvancedGestureId, number>
  readonly motion: PalmMotionSnapshot
  readonly landmarkQuality: number
  readonly factorProduct: number
  readonly winner: AdvancedGestureId | null
  readonly second: AdvancedGestureId | null
  readonly margin: number
}

export interface GestureIntelligenceDebugFrame {
  readonly left: SingleHandIntelligenceDebug | null
  readonly right: SingleHandIntelligenceDebug | null
}
