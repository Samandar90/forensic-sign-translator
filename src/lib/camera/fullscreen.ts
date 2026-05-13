/** Fullscreen API helpers (video / panel shell). */

export function getFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null
  return (
    document.fullscreenElement ??
    (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement ??
    null
  )
}

export async function enterFullscreen(element: HTMLElement): Promise<void> {
  if (element.requestFullscreen) {
    await element.requestFullscreen()
    return
  }
  const legacy = element as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void
  }
  if (legacy.webkitRequestFullscreen) {
    await Promise.resolve(legacy.webkitRequestFullscreen())
  }
}

export async function exitFullscreen(): Promise<void> {
  if (!getFullscreenElement()) return
  if (document.exitFullscreen) {
    await document.exitFullscreen()
    return
  }
  const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> | void }
  if (doc.webkitExitFullscreen) {
    await Promise.resolve(doc.webkitExitFullscreen())
  }
}

export async function toggleFullscreen(element: HTMLElement): Promise<void> {
  if (getFullscreenElement() === element) {
    await exitFullscreen()
  } else {
    await enterFullscreen(element)
  }
}
