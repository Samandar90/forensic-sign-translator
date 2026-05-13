import type { HandDetectionResult, HandLandmarks } from '../detection/handLandmarker'
import type { FingerStates } from './fingerGeometry'
import { getFingerStates } from './fingerGeometry'
import type { AdvancedGestureId, ClassifiedGesture, StableGestureResult } from './gestureTypes'
import { createGestureSmoother } from './gestureSmoother'
import { classifyHandIntelligence, computeGestureScores } from './intelligence/gestureEngine'
import { createStaticMotion } from './intelligence/motionAnalyzer'
import type { PalmMotionSnapshot } from './intelligence/types'
import type { GestureHistoryBuffer } from './intelligence/gestureHistory'

export function classifyGestureFrame(
  hand: HandDetectionResult,
  motion?: PalmMotionSnapshot | null,
  history?: GestureHistoryBuffer | null,
): ClassifiedGesture | null {
  return classifyHandIntelligence(hand, motion ?? createStaticMotion(), history ?? null)
}

export function getGestureScoreSheet(
  landmarks: HandLandmarks,
  _fingers: FingerStates,
): Record<AdvancedGestureId, number> {
  void _fingers
  const hand: HandDetectionResult = {
    landmarks,
    displaySide: 'Unknown',
    fingerStates: getFingerStates(landmarks),
  }
  return computeGestureScores(hand, createStaticMotion())
}

export function scoreGesturesFrame(
  landmarks: HandLandmarks,
  fingers: FingerStates,
): { best: AdvancedGestureId; components: StableGestureResult['components'] } | null {
  void fingers
  const hand: HandDetectionResult = {
    landmarks,
    displaySide: 'Unknown',
    fingerStates: getFingerStates(landmarks),
  }
  const c = classifyGestureFrame(hand)
  if (!c) return null
  return {
    best: c.id,
    components:
      c.components ?? {
        finger: c.confidence,
        thumb: c.confidence,
        palm: c.confidence,
        template: c.confidence,
        stability: 0,
      },
  }
}

export interface AdvancedGestureChannelOptions {
  /** @deprecated temporal fusion uses gesture window; kept for API compatibility */
  readonly stabilityFrames?: number
}

export function createAdvancedGestureChannel(_options: AdvancedGestureChannelOptions = {}): {
  push: (hand: HandDetectionResult | null) => StableGestureResult | null
  reset: () => void
} {
  const smoother = createGestureSmoother()

  return {
    push(hand: HandDetectionResult | null): StableGestureResult | null {
      if (!hand || hand.landmarks.length < 21) {
        smoother.reset()
        return null
      }
      const frame = classifyGestureFrame(hand)
      const out = smoother.push(frame)
      if (!out) return null
      return {
        ...out,
        components: {
          ...out.components,
          stability: out.components.stability,
        },
      }
    },
    reset(): void {
      smoother.reset()
    },
  }
}

export function peekRawGesture(hand: HandDetectionResult | null): AdvancedGestureId | null {
  if (!hand) return null
  return classifyHandIntelligence(hand, createStaticMotion(), null)?.id ?? null
}

export type { AdvancedGestureId, StableGestureResult, ClassifiedGesture } from './gestureTypes'
