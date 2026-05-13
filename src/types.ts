import type { FingerStates } from './lib/gestures/fingerGeometry'
import type { AdvancedGestureId, StableGestureResult } from './lib/gestures/gestureTypes'
import type { GestureIntelligenceDebugFrame } from './lib/gestures/intelligence/types'

export type RecognitionFlowPhase =
  | 'idle'
  | 'starting'
  | 'active'
  | 'stopped'
  | 'error'

export type CameraErrorCode =
  | null
  | 'api_unsupported'
  | 'permission_denied'
  | 'no_device'
  | 'busy'
  | 'no_video_target'
  | 'unknown'

export type VisionDetectionState = 'idle' | 'loading_models' | 'initializing' | 'ready' | 'error'

/** True while WASM / models / detector pipeline is starting (not yet inferring). */
export function visionIsBootstrapping(s: VisionDetectionState): boolean {
  return s === 'loading_models' || s === 'initializing'
}

export type DisplayHandSide = 'Left' | 'Right' | 'Unknown'

/** One physical hand slot after mirror normalization. */
export interface HandSlotAnalysis {
  readonly side: 'Left' | 'Right'
  readonly present: boolean
  readonly fingerStates: FingerStates | null
  readonly stableGesture: StableGestureResult | null
  readonly openFingerCount: number
}

/** Per-frame stable snapshot for UI / voice / chat. */
export interface MultiHandGestureSnapshot {
  readonly left: HandSlotAnalysis
  readonly right: HandSlotAnalysis
  readonly primaryStable: StableGestureResult | null
  readonly secondaryStable: StableGestureResult | null
  /** Populated only when development gesture diagnostics are enabled. */
  readonly intelligenceDebug?: GestureIntelligenceDebugFrame
}

/** Rich gesture summary for assistant bubbles and export. */
export interface ChatGestureBlock {
  readonly headline: string
  readonly lineUz: string
  readonly lineRu: string
  readonly primaryGestureId?: AdvancedGestureId
}

export interface ChatMessage {
  readonly id: string
  readonly role: 'user' | 'assistant'
  readonly content: string
  readonly emoji?: string
  readonly ts: number
  /** Natural-language gloss in the active UI language. */
  readonly translation?: string
  /** Companion line in the other language (RU ↔ UZ). */
  readonly crossLang?: string
  /** When true, assistant text reveals progressively (once). */
  readonly assistantTyping?: boolean
  readonly gestureBlock?: ChatGestureBlock
  /** Recognition confidence for the primary gesture (0–100), when known. */
  readonly recognitionConfidencePct?: number
}
