/**
 * Composites the current video frame with the hand overlay canvas (same aspect as video).
 * Returns a PNG data URL suitable for download.
 */
export function captureVideoWithOverlayDataUrl(
  video: HTMLVideoElement,
  overlay: HTMLCanvasElement,
): string | null {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (vw <= 0 || vh <= 0) return null

  const out = document.createElement('canvas')
  out.width = vw
  out.height = vh
  const ctx = out.getContext('2d')
  if (!ctx) return null

  ctx.drawImage(video, 0, 0, vw, vh)
  if (overlay.width > 0 && overlay.height > 0) {
    ctx.drawImage(overlay, 0, 0, vw, vh)
  }

  try {
    return out.toDataURL('image/png')
  } catch {
    return null
  }
}
