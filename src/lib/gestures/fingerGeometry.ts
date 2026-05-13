import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

export type FingerName = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky'
export type FingerState = 'open' | 'closed'
export type FingerStates = Record<FingerName, FingerState>

export const FINGER_ORDER: readonly FingerName[] = ['thumb', 'index', 'middle', 'ring', 'pinky']

const WRIST = 0
const THUMB_MCP = 2
const THUMB_IP = 3
const THUMB_TIP = 4
const INDEX_MCP = 5
const INDEX_PIP = 6
const INDEX_TIP = 8
const MIDDLE_MCP = 9
const MIDDLE_PIP = 10
const MIDDLE_TIP = 12
const RING_MCP = 13
const RING_PIP = 14
const RING_TIP = 16
const PINKY_MCP = 17
const PINKY_PIP = 18
const PINKY_TIP = 20

export function distance(a: NormalizedLandmark, b: NormalizedLandmark): number {
  const dz = (a.z ?? 0) - (b.z ?? 0)
  return Math.hypot(a.x - b.x, a.y - b.y, dz)
}

export function vector(a: NormalizedLandmark, b: NormalizedLandmark): { x: number; y: number; z: number } {
  return { x: b.x - a.x, y: b.y - a.y, z: (b.z ?? 0) - (a.z ?? 0) }
}

export function len3(v: { x: number; y: number; z: number }): number {
  return Math.hypot(v.x, v.y, v.z)
}

export function angle(
  a: NormalizedLandmark,
  b: NormalizedLandmark,
  c: NormalizedLandmark,
): number {
  const u = vector(b, a)
  const v = vector(b, c)
  const lu = len3(u)
  const lv = len3(v)
  if (lu < 1e-8 || lv < 1e-8) return Math.PI
  const cos = Math.max(-1, Math.min(1, (u.x * v.x + u.y * v.y + u.z * v.z) / (lu * lv)))
  return Math.acos(cos)
}

/** Palm plane normal (rough), pointing out of palm in image space. */
export function getPalmOrientation(lm: readonly NormalizedLandmark[]): { nx: number; ny: number; nz: number } {
  const wrist = lm[WRIST]
  const idx = lm[INDEX_MCP]
  const pk = lm[PINKY_MCP]
  const u = vector(wrist, idx)
  const v = vector(wrist, pk)
  const nx = u.y * v.z - u.z * v.y
  const ny = u.z * v.x - u.x * v.z
  const nz = u.x * v.y - u.y * v.x
  const l = Math.hypot(nx, ny, nz)
  if (l < 1e-8) return { nx: 0, ny: 0, nz: 1 }
  return { nx: nx / l, ny: ny / l, nz: nz / l }
}

export function getPalmCenter(lm: readonly NormalizedLandmark[]): NormalizedLandmark {
  const pts = [lm[INDEX_MCP], lm[MIDDLE_MCP], lm[RING_MCP], lm[PINKY_MCP]]
  let x = 0
  let y = 0
  let z = 0
  for (const p of pts) {
    x += p.x
    y += p.y
    z += p.z ?? 0
  }
  return { x: x / 4, y: y / 4, z: z / 4, visibility: 1 }
}

/** Unit direction wrist → thumb tip in image space. */
export function getThumbDirection(lm: readonly NormalizedLandmark[]): { x: number; y: number; z: number } {
  const v = vector(lm[WRIST], lm[THUMB_TIP])
  const l = len3(v)
  if (l < 1e-8) return { x: 0, y: -1, z: 0 }
  return { x: v.x / l, y: v.y / l, z: v.z / l }
}

function handScale(lm: readonly NormalizedLandmark[]): number {
  return Math.max(1e-4, distance(lm[WRIST], lm[MIDDLE_MCP]))
}

/** Index/middle/ring/pinky: open if tip is farther from wrist than PIP and MCP (normalized). */
function fingerExtended(
  lm: readonly NormalizedLandmark[],
  tip: number,
  pip: number,
  mcp: number,
): boolean {
  const wrist = lm[WRIST]
  const dTip = distance(wrist, lm[tip])
  const dPip = distance(wrist, lm[pip])
  const dMcp = distance(wrist, lm[mcp])
  return dTip > dPip * 1.035 && dTip > dMcp * 0.96
}

/**
 * Thumb: open if extended chain AND tip is away from palm / index MCP (not folded fist thumb).
 */
function thumbExtendedOpen(lm: readonly NormalizedLandmark[]): boolean {
  const scale = handScale(lm)
  const tip = lm[THUMB_TIP]
  const ip = lm[THUMB_IP]
  const mcp = lm[THUMB_MCP]
  const idxMcp = lm[INDEX_MCP]
  const dTipIp = distance(tip, ip)
  const dIpMcp = distance(ip, mcp)
  const dTipIdx = distance(tip, idxMcp)
  const chain = dTipIp > dIpMcp * 0.82
  const awayFromPalm = dTipIdx > scale * 0.2
  return chain && awayFromPalm
}

/** Strong thumbs-up: tip above MCP in image space (y up) + abduction from index column. */
export function getThumbUpLikeScore(lm: readonly NormalizedLandmark[]): number {
  const scale = handScale(lm)
  const tip = lm[THUMB_TIP]
  const mcp = lm[THUMB_MCP]
  const idxMcp = lm[INDEX_MCP]
  const vertical = (mcp.y - tip.y) / scale
  const upness = Math.max(0, Math.min(1, (vertical - 0.05) / 0.55))
  const spread = Math.min(1, distance(tip, idxMcp) / Math.max(1e-4, distance(mcp, idxMcp) * 1.05))
  return upness * 0.55 + spread * 0.45
}

export function getFingerStates(landmarks: readonly NormalizedLandmark[]): FingerStates {
  if (landmarks.length < 21) {
    return { thumb: 'closed', index: 'closed', middle: 'closed', ring: 'closed', pinky: 'closed' }
  }
  const lm = landmarks
  return {
    thumb: thumbExtendedOpen(lm) ? 'open' : 'closed',
    index: fingerExtended(lm, INDEX_TIP, INDEX_PIP, INDEX_MCP) ? 'open' : 'closed',
    middle: fingerExtended(lm, MIDDLE_TIP, MIDDLE_PIP, MIDDLE_MCP) ? 'open' : 'closed',
    ring: fingerExtended(lm, RING_TIP, RING_PIP, RING_MCP) ? 'open' : 'closed',
    pinky: fingerExtended(lm, PINKY_TIP, PINKY_PIP, PINKY_MCP) ? 'open' : 'closed',
  }
}
