import type { AdvancedGestureId } from '../gestureTypes'

const MAX = 6

/**
 * Short-horizon vote buffer to gently boost confidence when the same raw gesture repeats.
 * (Sliding window in gestureSmoother remains the main temporal gate.)
 */
export function createGestureHistoryBuffer() {
  const buf: (AdvancedGestureId | null)[] = []

  function push(id: AdvancedGestureId | null): number {
    buf.push(id)
    while (buf.length > MAX) buf.shift()
    if (!id) return 0.35
    let n = 0
    for (const e of buf) {
      if (e === id) n += 1
    }
    return Math.max(0.35, Math.min(1, 0.45 + (n / buf.length) * 0.55))
  }

  function reset(): void {
    buf.length = 0
  }

  return { push, reset }
}

export type GestureHistoryBuffer = ReturnType<typeof createGestureHistoryBuffer>
