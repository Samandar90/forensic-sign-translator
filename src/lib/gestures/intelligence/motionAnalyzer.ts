import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { getPalmCenter } from '../fingerGeometry'
import type { PalmMotionSnapshot } from './types'
import { handScale } from './handGeometry'

const STATIC: PalmMotionSnapshot = {
  speed: 0,
  lateralExcursion: 0,
  oscillationScore: 0,
}

interface Sample {
  readonly x: number
  readonly y: number
}

export function createStaticMotion(): PalmMotionSnapshot {
  return STATIC
}

/**
 * Cheap palm motion tracker (fixed small buffer). Call once per frame per hand.
 */
export function createPalmMotionTracker(capacity = 10) {
  const buf: Sample[] = []

  function reset(): void {
    buf.length = 0
  }

  function push(lm: readonly NormalizedLandmark[]): PalmMotionSnapshot {
    if (lm.length < 21) {
      reset()
      return STATIC
    }
    const c = getPalmCenter(lm)
    buf.push({ x: c.x, y: c.y })
    while (buf.length > capacity) buf.shift()
    const scale = handScale(lm)
    if (buf.length < 3) {
      return { speed: 0, lateralExcursion: 0, oscillationScore: 0 }
    }

    let speed = 0
    for (let i = 1; i < buf.length; i++) {
      const dx = buf[i].x - buf[i - 1].x
      const dy = buf[i].y - buf[i - 1].y
      speed += Math.hypot(dx, dy)
    }
    speed /= Math.max(1, buf.length - 1)
    speed /= Math.max(1e-4, scale)

    let minX = buf[0].x
    let maxX = buf[0].x
    for (const p of buf) {
      minX = Math.min(minX, p.x)
      maxX = Math.max(maxX, p.x)
    }
    const lateralExcursion = (maxX - minX) / Math.max(1e-4, scale)

    let flips = 0
    let prevSign = 0
    for (let i = 2; i < buf.length; i++) {
      const vx = buf[i].x - buf[i - 1].x
      const s = vx > 1e-5 ? 1 : vx < -1e-5 ? -1 : 0
      if (s !== 0 && prevSign !== 0 && s !== prevSign) flips += 1
      if (s !== 0) prevSign = s
    }
    const oscillationScore = Math.max(0, Math.min(1, flips / 3 + lateralExcursion * 0.35))

    return {
      speed: Math.max(0, Math.min(2.5, speed * 6)),
      lateralExcursion: Math.max(0, Math.min(1.8, lateralExcursion)),
      oscillationScore,
    }
  }

  return { push, reset }
}

export type PalmMotionTracker = ReturnType<typeof createPalmMotionTracker>
