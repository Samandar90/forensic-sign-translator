import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { distance } from '../fingerGeometry'
import { handScale, palmWidthNorm } from './handGeometry'

const TIPS = [8, 12, 16, 20] as const
const MCPS = [5, 9, 13, 17] as const
const WRIST = 0

/**
 * Landmark quality 0–1: spread + depth consistency (cheap proxy for occlusion).
 */
export function estimateLandmarkQuality(lm: readonly NormalizedLandmark[]): number {
  if (lm.length < 21) return 0
  const scale = handScale(lm)
  let spread = 0
  for (let i = 0; i < TIPS.length; i++) {
    spread += distance(lm[WRIST], lm[TIPS[i]]) / scale
  }
  spread /= TIPS.length
  const spreadScore = Math.max(0, Math.min(1, (spread - 0.55) / 0.75))

  let zVar = 0
  let zMean = 0
  for (const idx of MCPS) {
    zMean += lm[idx].z ?? 0
  }
  zMean /= MCPS.length
  for (const idx of MCPS) {
    const dz = (lm[idx].z ?? 0) - zMean
    zVar += dz * dz
  }
  zVar = Math.sqrt(zVar / MCPS.length)
  const depthScore = Math.max(0, Math.min(1, 1 - zVar / 0.08))

  const width = palmWidthNorm(lm)
  const widthScore = Math.max(0, Math.min(1, (width - 0.55) / 0.55))

  return Math.max(0, Math.min(1, spreadScore * 0.45 + depthScore * 0.35 + widthScore * 0.2))
}

export interface ConfidenceFactors {
  readonly fingerTemplate: number
  readonly palmFacing: number
  readonly landmarkQuality: number
  readonly motionStability: number
  readonly temporalCoherence: number
}

export function combineGestureFactors(f: ConfidenceFactors): number {
  const wFinger = 0.28
  const wPalm = 0.14
  const wLm = 0.26
  const wMot = 0.18
  const wTemp = 0.14
  const p =
    f.fingerTemplate * wFinger +
    f.palmFacing * wPalm +
    f.landmarkQuality * wLm +
    f.motionStability * wMot +
    f.temporalCoherence * wTemp
  return Math.max(0.08, Math.min(1, p))
}
