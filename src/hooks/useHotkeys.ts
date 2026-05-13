import { useEffect, useRef } from 'react'

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  if (el.closest('[data-hotkeys-ignore="true"]')) return true
  return false
}

export interface HotkeyHandlers {
  readonly onToggleSession?: () => void
  readonly onToggleFullscreen?: () => void
  readonly onMuteVoice?: () => void
  readonly onClearTranscript?: () => void
}

export interface UseHotkeysOptions {
  readonly enabled: boolean
  readonly allowInEditableFields?: boolean
}

export function useHotkeys(handlers: HotkeyHandlers, options: UseHotkeysOptions): void {
  const { enabled, allowInEditableFields = false } = options
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.defaultPrevented) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (!allowInEditableFields && isEditableTarget(e.target)) return

      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      const h = handlersRef.current

      if (e.code === 'Space' || key === ' ') {
        e.preventDefault()
        h.onToggleSession?.()
        return
      }
      if (key === 'f') {
        e.preventDefault()
        h.onToggleFullscreen?.()
        return
      }
      if (key === 'm') {
        e.preventDefault()
        h.onMuteVoice?.()
        return
      }
      if (key === 'c') {
        e.preventDefault()
        h.onClearTranscript?.()
        return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled, allowInEditableFields])
}
