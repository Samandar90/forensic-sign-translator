import type { HandDetectionResult } from '../detection/handLandmarker'
import type { MultiHandGestureSnapshot, HandSlotAnalysis } from '../../types'
import type { StableGestureResult, ClassifiedGesture } from './gestureTypes'
import { classifyGestureFrame } from './advancedGestureMatcher'
import { createGestureSmoother } from './gestureSmoother'
import { FINGER_ORDER, type FingerStates } from './fingerGeometry'
import { createPalmMotionTracker, createStaticMotion } from './intelligence/motionAnalyzer'
import { createGestureHistoryBuffer } from './intelligence/gestureHistory'
import { fuseDualHandClassifications } from './intelligence/gestureFusion'
import { buildIntelligenceDebug } from './intelligence/gestureEngine'
import type { GestureIntelligenceDebugFrame } from './intelligence/types'
import type { GestureSmootherOptions } from './gestureSmoother'

function countOpenFingers(f: FingerStates): number {
  return FINGER_ORDER.filter(name => f[name] === 'open').length
}

function emptySlot(side: 'Left' | 'Right'): HandSlotAnalysis {
  return {
    side,
    present: false,
    fingerStates: null,
    stableGesture: null,
    openFingerCount: 0,
  }
}

function partitionTwoHands(hands: readonly HandDetectionResult[]): {
  left: HandDetectionResult | null
  right: HandDetectionResult | null
} {
  let left = hands.find(h => h.displaySide === 'Left') ?? null
  let right = hands.find(h => h.displaySide === 'Right') ?? null
  for (const h of hands) {
    if (h.displaySide !== 'Unknown') continue
    if (!left) left = h
    else if (!right) right = h
    else break
  }
  return { left, right }
}

export interface MultiHandGestureChannel {
  readonly push: (hands: readonly HandDetectionResult[]) => MultiHandGestureSnapshot
  readonly reset: () => void
}

const DEFAULT_SMOOTH: GestureSmootherOptions = { window: 14, minVotes: 8, minAvgConf: 0.76 }

export interface MultiHandGestureChannelOptions {
  readonly smoother?: Partial<GestureSmootherOptions>
  /** When true, include per-frame intelligence debug (heavy). */
  readonly showIntelligenceDebug?: () => boolean
}

export function createMultiHandGestureChannel(opts: MultiHandGestureChannelOptions = {}): MultiHandGestureChannel {
  const smooth: GestureSmootherOptions = { ...DEFAULT_SMOOTH, ...opts.smoother }
  const leftSmoother = createGestureSmoother(smooth)
  const rightSmoother = createGestureSmoother(smooth)
  const leftMotion = createPalmMotionTracker()
  const rightMotion = createPalmMotionTracker()
  const leftHist = createGestureHistoryBuffer()
  const rightHist = createGestureHistoryBuffer()

  let hadLeft = false
  let hadRight = false

  return {
    push(hands: readonly HandDetectionResult[]): MultiHandGestureSnapshot {
      const { left: leftHand, right: rightHand } = partitionTwoHands(hands)

      let motionL = createStaticMotion()
      let motionR = createStaticMotion()

      let stableL: StableGestureResult | null = null
      if (!leftHand) {
        if (hadLeft) {
          leftSmoother.reset()
          leftMotion.reset()
          leftHist.reset()
        }
        hadLeft = false
      } else {
        hadLeft = true
        motionL = leftMotion.push(leftHand.landmarks)
      }

      let stableR: StableGestureResult | null = null
      if (!rightHand) {
        if (hadRight) {
          rightSmoother.reset()
          rightMotion.reset()
          rightHist.reset()
        }
        hadRight = false
      } else {
        hadRight = true
        motionR = rightMotion.push(rightHand.landmarks)
      }

      let frL: ClassifiedGesture | null = null
      let frR: ClassifiedGesture | null = null
      if (leftHand) {
        frL = classifyGestureFrame(leftHand, motionL, leftHist)
      }
      if (rightHand) {
        frR = classifyGestureFrame(rightHand, motionR, rightHist)
      }
      if (frL && frR) {
        const fused = fuseDualHandClassifications(frL, frR)
        frL = fused.left
        frR = fused.right
      }

      if (leftHand) {
        stableL = leftSmoother.push(frL)
      }
      if (rightHand) {
        stableR = rightSmoother.push(frR)
      }

      const leftSlot: HandSlotAnalysis = leftHand
        ? {
            side: 'Left',
            present: true,
            fingerStates: leftHand.fingerStates,
            stableGesture: stableL,
            openFingerCount: countOpenFingers(leftHand.fingerStates),
          }
        : emptySlot('Left')

      const rightSlot: HandSlotAnalysis = rightHand
        ? {
            side: 'Right',
            present: true,
            fingerStates: rightHand.fingerStates,
            stableGesture: stableR,
            openFingerCount: countOpenFingers(rightHand.fingerStates),
          }
        : emptySlot('Right')

      const ranked: StableGestureResult[] = []
      if (stableL) ranked.push(stableL)
      if (stableR) ranked.push(stableR)
      ranked.sort((a, b) => b.confidencePct - a.confidencePct)

      const primaryStable = ranked[0] ?? null
      let secondaryStable: StableGestureResult | null = null
      if (ranked.length >= 2 && ranked[1].id !== ranked[0].id) {
        secondaryStable = ranked[1]
      }

      let intelligenceDebug: GestureIntelligenceDebugFrame | undefined
      const showDbg = Boolean(import.meta.env.DEV && opts.showIntelligenceDebug?.())
      if (showDbg && (leftHand || rightHand)) {
        intelligenceDebug = {
          left: leftHand ? buildIntelligenceDebug(leftHand, motionL) : null,
          right: rightHand ? buildIntelligenceDebug(rightHand, motionR) : null,
        }
      }

      return {
        left: leftSlot,
        right: rightSlot,
        primaryStable,
        secondaryStable,
        intelligenceDebug,
      }
    },
    reset(): void {
      leftSmoother.reset()
      rightSmoother.reset()
      leftMotion.reset()
      rightMotion.reset()
      leftHist.reset()
      rightHist.reset()
      hadLeft = false
      hadRight = false
    },
  }
}
