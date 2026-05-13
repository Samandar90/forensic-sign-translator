import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { HandDetectionResult } from '../../detection/handLandmarker'
import type { FingerStates } from '../fingerGeometry'
import {
  getFingerStates,
  getPalmOrientation,
  getThumbUpLikeScore,
} from '../fingerGeometry'
import type { AdvancedGestureId, ClassifiedGesture, StableGestureResult } from '../gestureTypes'
import {
  combineGestureFactors,
  estimateLandmarkQuality,
} from './gestureConfidence'
import type { GestureHistoryBuffer } from './gestureHistory'
import {
  fistCurlScore,
  palmFacingCameraScore,
  palmSpreadScore,
  peaceTipSeparationNorm,
  thumbAbductionFromIndex,
  thumbChainAngleScore,
  thumbTipVsKnuckleVertical,
} from './handGeometry'
import { motionEnergyForHello, motionStabilityForOpenPalm } from './temporalAnalyzer'
import type { PalmMotionSnapshot } from './types'

const ORDER: AdvancedGestureId[] = ['LIKE', 'FIST', 'PEACE', 'STOP', 'HELLO']

function fourFingersClosed(f: FingerStates): boolean {
  return f.index === 'closed' && f.middle === 'closed' && f.ring === 'closed' && f.pinky === 'closed'
}

function fourFingersExtendedCount(f: FingerStates): number {
  return [f.index, f.middle, f.ring, f.pinky].filter(x => x === 'open').length
}

function emptyScores(): Record<AdvancedGestureId, number> {
  return { LIKE: 0, FIST: 0, PEACE: 0, STOP: 0, HELLO: 0 }
}

export function computeGestureScores(
  hand: HandDetectionResult,
  motion: PalmMotionSnapshot,
): Record<AdvancedGestureId, number> {
  const scores = emptyScores()
  if (hand.landmarks.length < 21) return scores
  const lm = hand.landmarks as readonly NormalizedLandmark[]
  const f = hand.fingerStates ?? getFingerStates(hand.landmarks)
  const palmN = getPalmOrientation(lm)
  const palmFace = palmFacingCameraScore(palmN.nz)
  const spread = palmSpreadScore(lm)
  const thumbUp = getThumbUpLikeScore(lm)
  const abduction = thumbAbductionFromIndex(lm)
  const chain = thumbChainAngleScore(lm)
  const verticalThumb = thumbTipVsKnuckleVertical(lm)
  const curl = fistCurlScore(lm)

  let like = 0
  if (f.thumb === 'open' && fourFingersClosed(f)) {
    like = thumbUp * 0.38 + abduction * 0.28 + chain * 0.14 + verticalThumb * 0.12
    like += palmFace * 0.08
    like = Math.min(1, like)
  }
  if (curl > 0.72 && thumbUp < 0.62) like *= 0.45
  if (thumbUp > 0.58 && fourFingersClosed(f) && abduction > 0.42) like = Math.max(like, thumbUp * 0.92)

  let fist = 0
  if (fourFingersClosed(f) && thumbUp < 0.52) {
    fist = curl * 0.42 + (f.thumb === 'closed' ? 0.28 : 0.12) + (1 - thumbUp) * 0.32
    fist = Math.min(1, fist)
  }
  if (thumbUp > 0.55 && abduction > 0.38 && fourFingersClosed(f)) {
    fist *= 0.22
  }

  const imDist = peaceTipSeparationNorm(lm)
  let peace = 0
  if (f.index === 'open' && f.middle === 'open' && f.ring === 'closed' && f.pinky === 'closed') {
    peace = 0.32
    peace += f.thumb === 'closed' ? 0.22 : 0.08
    peace += Math.min(0.38, (imDist - 0.16) / 0.5)
    peace += (1 - thumbUp) * 0.12
    peace = Math.min(1, peace)
  }

  let stop = 0
  if (
    f.index === 'open' &&
    f.middle === 'open' &&
    f.ring === 'open' &&
    f.pinky === 'open' &&
    f.thumb === 'open'
  ) {
    stop = spread * 0.42 + palmFace * 0.28 + 0.18
    const calm = motionStabilityForOpenPalm(motion)
    const antiHello = 1 - motionEnergyForHello(motion) * 0.85
    stop *= 0.55 + 0.45 * calm
    stop *= 0.35 + 0.65 * antiHello
    stop = Math.min(1, stop)
  }

  let hello = 0
  const nOpen4 = fourFingersExtendedCount(f)
  if (nOpen4 >= 4 && spread > 0.2) {
    hello = spread * 0.32 + nOpen4 * 0.1 + (f.thumb === 'closed' ? 0.14 : 0.05)
    const move = motionEnergyForHello(motion)
    hello *= 0.18 + 0.82 * move
    if (f.thumb === 'open' && f.ring === 'open' && f.pinky === 'open' && f.index === 'open' && f.middle === 'open') {
      hello *= 0.42 + 0.58 * move
    }
    hello = Math.min(1, hello)
  }

  scores.LIKE = like
  scores.FIST = fist
  scores.PEACE = peace
  scores.STOP = stop
  scores.HELLO = hello
  return scores
}

function secondBestScore(scores: Record<AdvancedGestureId, number>, best: AdvancedGestureId): number {
  let m = 0
  for (const id of ORDER) {
    if (id === best) continue
    m = Math.max(m, scores[id])
  }
  return m
}

function pickTopTwo(scores: Record<AdvancedGestureId, number>): {
  readonly best: AdvancedGestureId
  readonly second: AdvancedGestureId
  readonly bestV: number
  readonly secondV: number
} {
  let best: AdvancedGestureId = 'FIST'
  let second: AdvancedGestureId = 'LIKE'
  let bestV = -1
  let secondV = -1
  for (const id of ORDER) {
    const v = scores[id]
    if (v > bestV) {
      secondV = bestV
      second = best
      bestV = v
      best = id
    } else if (v > secondV) {
      secondV = v
      second = id
    }
  }
  return { best, second, bestV, secondV }
}

function resolveHelloStopMargin(
  best: AdvancedGestureId,
  second: AdvancedGestureId,
  bestV: number,
  secondV: number,
  motion: PalmMotionSnapshot,
): { readonly id: AdvancedGestureId; readonly v: number; readonly second: AdvancedGestureId; readonly secondV: number } {
  let id = best
  let v1 = bestV
  let sId = second
  let sV = secondV
  const helloE = motionEnergyForHello(motion)
  const calm = motionStabilityForOpenPalm(motion)

  if (best === 'HELLO' && second === 'STOP' && bestV - secondV < 0.12) {
    if (helloE < 0.22) {
      id = 'STOP'
      v1 = bestV * 0.55 + secondV * 0.45
      sId = 'HELLO'
      sV = bestV * 0.4
    }
  } else if (best === 'STOP' && second === 'HELLO' && bestV - secondV < 0.12) {
    if (helloE > 0.38 && calm < 0.92) {
      id = 'HELLO'
      v1 = bestV * 0.45 + secondV * 0.55
      sId = 'STOP'
      sV = bestV * 0.42
    }
  }
  return { id, v: v1, second: sId, secondV: sV }
}

function resolveLikeFistMargin(
  best: AdvancedGestureId,
  second: AdvancedGestureId,
  bestV: number,
  secondV: number,
  lm: readonly NormalizedLandmark[],
  f: FingerStates,
): { readonly id: AdvancedGestureId; readonly v: number } {
  if (!(best === 'LIKE' && second === 'FIST') && !(best === 'FIST' && second === 'LIKE')) {
    return { id: best, v: bestV }
  }
  const margin = Math.abs(bestV - secondV)
  if (margin >= 0.1) return { id: best, v: bestV }
  const thumbUp = getThumbUpLikeScore(lm)
  const abduction = thumbAbductionFromIndex(lm)
  const curl = fistCurlScore(lm)
  if (thumbUp > 0.52 && abduction > 0.35 && fourFingersClosed(f)) {
    return { id: 'LIKE', v: Math.max(bestV, secondV, thumbUp * 0.95) }
  }
  if (curl > 0.7 && thumbUp < 0.48) {
    return { id: 'FIST', v: Math.max(bestV, secondV, curl * 0.95) }
  }
  return bestV >= secondV ? { id: best, v: bestV } : { id: second, v: secondV }
}

export function classifyHandIntelligence(
  hand: HandDetectionResult,
  motion: PalmMotionSnapshot,
  history: GestureHistoryBuffer | null,
): ClassifiedGesture | null {
  if (!hand || hand.landmarks.length < 21) return null
  const lm = hand.landmarks as readonly NormalizedLandmark[]
  const f = hand.fingerStates ?? getFingerStates(hand.landmarks)
  const scores = computeGestureScores(hand, motion)
  let { best, second, bestV, secondV } = pickTopTwo(scores)

  const hs = resolveHelloStopMargin(best, second, bestV, secondV, motion)
  best = hs.id
  bestV = hs.v
  second = hs.second
  secondV = hs.secondV

  const lf = resolveLikeFistMargin(best, second, bestV, secondV, lm, f)
  best = lf.id
  bestV = Math.max(scores[best], lf.v)

  const margin = bestV - secondBestScore(scores, best)

  const lmQuality = estimateLandmarkQuality(lm)
  const palmN = getPalmOrientation(lm)
  const palmFace = palmFacingCameraScore(palmN.nz)
  const motionStab =
    best === 'HELLO' ? motionEnergyForHello(motion) : motionStabilityForOpenPalm(motion)

  const minConf = 0.42 + (1 - lmQuality) * 0.14
  const minMargin = 0.038 + (1 - lmQuality) * 0.04
  if (bestV < minConf) {
    history?.push(null)
    return null
  }
  if (margin < minMargin) {
    history?.push(null)
    return null
  }

  const temporal = history ? history.push(best) : 0.72

  const factors = combineGestureFactors({
    fingerTemplate: bestV,
    palmFacing: palmFace,
    landmarkQuality: lmQuality,
    motionStability: motionStab,
    temporalCoherence: temporal,
  })

  const refined = Math.max(0, Math.min(1, bestV * factors))

  const components: StableGestureResult['components'] = {
    finger: bestV,
    thumb: getThumbUpLikeScore(lm),
    palm: palmSpreadScore(lm),
    template: margin,
    stability: temporal,
  }

  return {
    id: best,
    confidence: bestV,
    refinedConfidence: refined,
    components,
  }
}

import type { SingleHandIntelligenceDebug } from './types'

export function buildIntelligenceDebug(
  hand: HandDetectionResult,
  motion: PalmMotionSnapshot,
): SingleHandIntelligenceDebug | null {
  if (!hand || hand.landmarks.length < 21) return null
  const lm = hand.landmarks as readonly NormalizedLandmark[]
  const scores = computeGestureScores(hand, motion)
  const { best, second, bestV, secondV } = pickTopTwo(scores)
  const lmQuality = estimateLandmarkQuality(lm)
  const palmN = getPalmOrientation(lm)
  const palmFace = palmFacingCameraScore(palmN.nz)
  const factors = combineGestureFactors({
    fingerTemplate: bestV,
    palmFacing: palmFace,
    landmarkQuality: lmQuality,
    motionStability: motionStabilityForOpenPalm(motion),
    temporalCoherence: 0.7,
  })
  return {
    scores,
    motion,
    landmarkQuality: lmQuality,
    factorProduct: factors,
    winner: bestV > 0.35 ? best : null,
    second: secondV > 0.28 ? second : null,
    margin: bestV - secondV,
  }
}
