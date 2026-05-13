import type { PalmMotionSnapshot } from './types'

/** Motion stability: low speed + moderate excursion = stable open palm (STOP-friendly). */
export function motionStabilityForOpenPalm(m: PalmMotionSnapshot): number {
  const jitter = m.speed
  const calm = Math.max(0, 1 - jitter * 1.15)
  return Math.max(0, Math.min(1, calm))
}

/** Motion energy suited for HELLO wave: visible lateral movement or oscillation. */
export function motionEnergyForHello(m: PalmMotionSnapshot): number {
  const wave = m.oscillationScore * 0.55 + Math.min(1, m.lateralExcursion * 0.45) * 0.45
  const move = Math.min(1, m.speed * 0.85)
  return Math.max(0, Math.min(1, wave * 0.72 + move * 0.28))
}
