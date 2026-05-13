import type { AdvancedGestureId, ClassifiedGesture, StableGestureResult } from './gestureTypes'

export interface GestureSmootherOptions {
  readonly window: number
  readonly minVotes: number
  readonly minAvgConf: number
}

const DEFAULT_OPTS: GestureSmootherOptions = {
  window: 12,
  minVotes: 6,
  minAvgConf: 0.65,
}

export interface GestureSmoother {
  readonly push: (frame: ClassifiedGesture | null) => StableGestureResult | null
  readonly reset: () => void
}

/**
 * Sliding window: same gesture must appear minVotes times in the last window frames.
 * Average confidence of matching frames must be ≥ minAvgConf.
 */
export function createGestureSmoother(partial: Partial<GestureSmootherOptions> = {}): GestureSmoother {
  const opts: GestureSmootherOptions = { ...DEFAULT_OPTS, ...partial }
  const { window: WINDOW, minVotes: MIN_VOTES, minAvgConf: MIN_AVG_CONF } = opts
  const buf: (ClassifiedGesture | null)[] = []

  return {
    push(frame: ClassifiedGesture | null): StableGestureResult | null {
      buf.push(frame)
      while (buf.length > WINDOW) buf.shift()

      if (buf.length < WINDOW) return null

      const counts = new Map<AdvancedGestureId, { n: number; sum: number }>()
      for (const e of buf) {
        if (!e) continue
        const w = e.refinedConfidence ?? e.confidence
        const cur = counts.get(e.id) ?? { n: 0, sum: 0 }
        cur.n += 1
        cur.sum += w
        counts.set(e.id, cur)
      }

      let bestId: AdvancedGestureId | null = null
      let bestN = 0
      for (const [id, { n }] of counts) {
        if (n > bestN) {
          bestN = n
          bestId = id
        }
      }

      if (!bestId || bestN < MIN_VOTES) return null

      const agg = counts.get(bestId)
      if (!agg) return null
      const avgConf = agg.sum / agg.n
      if (avgConf < MIN_AVG_CONF) return null

      const secondN = [...counts.entries()]
        .filter(([id]) => id !== bestId)
        .reduce((m, [, v]) => Math.max(m, v.n), 0)
      if (secondN >= MIN_VOTES && secondN === bestN) return null

      const confidencePct = Math.max(0, Math.min(100, Math.round(avgConf * 100)))

      return {
        id: bestId,
        confidencePct,
        components: {
          finger: avgConf,
          thumb: avgConf,
          palm: avgConf,
          template: avgConf,
          stability: Math.min(1, bestN / WINDOW),
        },
      }
    },
    reset(): void {
      buf.length = 0
    },
  }
}
