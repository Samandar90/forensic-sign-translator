import type { ClassifiedGesture } from '../gestureTypes'

export function fuseDualHandClassifications(
  left: ClassifiedGesture | null,
  right: ClassifiedGesture | null,
): { readonly left: ClassifiedGesture | null; readonly right: ClassifiedGesture | null } {
  if (!left || !right || left.id !== right.id) {
    return { left, right }
  }
  const boost = 1.05
  const bump = (g: ClassifiedGesture): ClassifiedGesture => ({
    ...g,
    confidence: Math.min(1, g.confidence * boost),
    refinedConfidence:
      g.refinedConfidence !== undefined ? Math.min(1, g.refinedConfidence * boost) : Math.min(1, g.confidence * boost),
  })
  return { left: bump(left), right: bump(right) }
}
