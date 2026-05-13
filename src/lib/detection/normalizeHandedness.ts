/** MediaPipe handedness in decoded frame space (before CSS mirror). */
export type MediaPipeHandSide = 'Left' | 'Right' | 'Unknown'

/**
 * When the preview is mirrored (`scaleX(-1)`), the viewer's physical left/right
 * are swapped relative to MediaPipe labels. Map MP → user-facing side.
 */
export function displaySideFromMediaPipe(
  mp: MediaPipeHandSide,
  mirrorPreview: boolean,
): 'Left' | 'Right' | 'Unknown' {
  if (mp === 'Unknown') return 'Unknown'
  if (!mirrorPreview) return mp
  return mp === 'Left' ? 'Right' : 'Left'
}
