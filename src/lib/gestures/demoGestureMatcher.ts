import type { FingerName, FingerStates } from '../detection/handLandmarker'

export type DemoGestureId = 'OPEN_PALM' | 'THUMBS_UP' | 'PEACE' | 'FIST'

export interface DemoGestureResult {
  readonly id: DemoGestureId
  /** 0..1 — fraction of finger constraints matched for the winning template. */
  readonly score: number
  readonly confidencePct: number
}

interface Template {
  readonly id: DemoGestureId
  readonly expected: Record<FingerName, 'open' | 'closed'>
}

const PREFERRED_ORDER: readonly DemoGestureId[] = ['OPEN_PALM', 'FIST', 'PEACE', 'THUMBS_UP']

const TEMPLATES: readonly Template[] = [
  {
    id: 'OPEN_PALM',
    expected: { thumb: 'open', index: 'open', middle: 'open', ring: 'open', pinky: 'open' },
  },
  {
    id: 'THUMBS_UP',
    expected: { thumb: 'open', index: 'closed', middle: 'closed', ring: 'closed', pinky: 'closed' },
  },
  {
    id: 'PEACE',
    expected: { thumb: 'closed', index: 'open', middle: 'open', ring: 'closed', pinky: 'closed' },
  },
  {
    id: 'FIST',
    expected: { thumb: 'closed', index: 'closed', middle: 'closed', ring: 'closed', pinky: 'closed' },
  },
] as const

const FINGER_NAMES: readonly FingerName[] = ['thumb', 'index', 'middle', 'ring', 'pinky']

/** Minimum fraction of finger checks that must match to report a demo gesture. */
const MIN_SCORE = 0.72

function scoreTemplate(fingers: FingerStates, expected: Template['expected']): number {
  let matched = 0
  for (const name of FINGER_NAMES) {
    if (fingers[name] === expected[name]) matched += 1
  }
  return matched / FINGER_NAMES.length
}

/**
 * Temporary demo classifier: picks one of four static poses from discrete finger states.
 * Confidence is the template match rate (deterministic, not random).
 */
export function matchDemoGesture(fingers: FingerStates): DemoGestureResult | null {
  const scored = TEMPLATES.map(t => ({
    id: t.id,
    score: scoreTemplate(fingers, t.expected),
  }))

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return PREFERRED_ORDER.indexOf(a.id) - PREFERRED_ORDER.indexOf(b.id)
  })

  const best = scored[0]
  if (!best || best.score < MIN_SCORE) return null

  return {
    id: best.id,
    score: best.score,
    confidencePct: Math.round(best.score * 100),
  }
}
