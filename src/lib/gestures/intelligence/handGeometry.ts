import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { distance, vector, len3, angle, getPalmCenter, getThumbDirection } from '../fingerGeometry'

const WRIST = 0
const THUMB_MCP = 2
const THUMB_TIP = 4
const INDEX_MCP = 5
const INDEX_TIP = 8
const MIDDLE_MCP = 9
const MIDDLE_TIP = 12
const RING_TIP = 16
const PINKY_TIP = 20

export function handScale(lm: readonly NormalizedLandmark[]): number {
  return Math.max(1e-4, distance(lm[WRIST], lm[MIDDLE_MCP]))
}

/** Palm width proxy: index MCP ↔ pinky MCP. */
export function palmWidthNorm(lm: readonly NormalizedLandmark[]): number {
  const s = handScale(lm)
  return distance(lm[5], lm[17]) / s
}

function cross2(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx
}

/** Open-palm spread metric (legacy heuristic, normalized). */
export function palmSpreadScore(lm: readonly NormalizedLandmark[]): number {
  const wrist = lm[0]
  const idx = lm[5]
  const pk = lm[17]
  const u = { x: idx.x - wrist.x, y: idx.y - wrist.y }
  const v = { x: pk.x - wrist.x, y: pk.y - wrist.y }
  const area = Math.abs(cross2(u.x, u.y, v.x, v.y))
  const ref = distance(idx, pk)
  return Math.min(1, (area / Math.max(1e-6, ref * ref + 1e-6)) * 3.0)
}

/** Thumb “up” geometry: angle wrist–MCP–tip should be opened for like, collapsed for fist. */
export function thumbChainAngleScore(lm: readonly NormalizedLandmark[]): number {
  const a = angle(lm[WRIST], lm[THUMB_MCP], lm[THUMB_TIP])
  const open = (a - 0.55) / (Math.PI - 0.55)
  return Math.max(0, Math.min(1, open))
}

/** Like: thumb tip clearly away from index column; fist: thumb tucked toward palm. */
export function thumbAbductionFromIndex(lm: readonly NormalizedLandmark[]): number {
  const scale = handScale(lm)
  const d = distance(lm[THUMB_TIP], lm[INDEX_MCP])
  return Math.max(0, Math.min(1, (d / scale - 0.18) / 0.55))
}

/** Fist: tips cluster toward wrist relative to open hand. */
export function fistCurlScore(lm: readonly NormalizedLandmark[]): number {
  const wrist = lm[WRIST]
  const tips = [INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP]
  let sum = 0
  for (const t of tips) {
    const dTip = distance(wrist, lm[t])
    const dMcp = distance(wrist, lm[t - 2])
    sum += dTip < dMcp * 1.02 ? 1 : 0
  }
  return sum / 4
}

/** Peace: separation index–middle tips vs scale. */
export function peaceTipSeparationNorm(lm: readonly NormalizedLandmark[]): number {
  const s = handScale(lm)
  return distance(lm[INDEX_TIP], lm[MIDDLE_TIP]) / s
}

/** Palm normal Z component magnitude ≈ facing camera. */
export function palmFacingCameraScore(nz: number): number {
  return Math.max(0, Math.min(1, Math.abs(nz)))
}

/** Vectors in palm plane for orientation stability (not full pose). */
export function palmBasisQuality(lm: readonly NormalizedLandmark[]): number {
  const wrist = lm[WRIST]
  const u = vector(wrist, lm[INDEX_MCP])
  const v = vector(wrist, lm[17])
  const lu = len3(u)
  const lv = len3(v)
  if (lu < 1e-5 || lv < 1e-5) return 0
  const cos = Math.max(-1, Math.min(1, (u.x * v.x + u.y * v.y + u.z * v.z) / (lu * lv)))
  const spread = Math.abs(Math.sin(Math.acos(cos)))
  return Math.max(0, Math.min(1, spread * 2.2))
}

export function thumbTipVsKnuckleVertical(lm: readonly NormalizedLandmark[]): number {
  const scale = handScale(lm)
  const tip = lm[THUMB_TIP]
  const mcp = lm[THUMB_MCP]
  return Math.max(0, Math.min(1, (mcp.y - tip.y) / (scale * 0.65)))
}

export { getPalmCenter, getThumbDirection }
