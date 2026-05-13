export type AdvancedGestureId = 'LIKE' | 'PEACE' | 'HELLO' | 'STOP' | 'FIST'

export interface ClassifiedGesture {
  readonly id: AdvancedGestureId
  readonly confidence: number
  /** Multi-factor refined score 0–1 (optional for legacy callers). */
  readonly refinedConfidence?: number
  readonly components?: StableGestureResult['components']
}

export interface StableGestureResult {
  readonly id: AdvancedGestureId
  readonly confidencePct: number
  readonly components: {
    readonly finger: number
    readonly thumb: number
    readonly palm: number
    readonly template: number
    readonly stability: number
  }
}
