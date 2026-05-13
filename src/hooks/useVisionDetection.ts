import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { loadVisionTasksFileset } from '../lib/detection/constants'
import { createHandOnlyAndStart, clearHandOverlay } from '../lib/detection/handLandmarker'
import type { HandDetectionResult, HandTrackingHandle } from '../lib/detection/handLandmarker'
import { createMultiHandGestureChannel } from '../lib/gestures/multiHandGestureMatcher'
import type { HandLandmarker } from '@mediapipe/tasks-vision'
import type { VisionDetectionState, MultiHandGestureSnapshot } from '../types'
import type { StableGestureResult } from '../lib/gestures/gestureTypes'
import type { Lang } from '../i18n'
import { translations } from '../i18n'
import type { RecognitionSettings } from '../lib/settings/settingsTypes'
import { buildSmootherOptionsFromRecognition, recognitionChannelSignature } from '../lib/settings/recognitionParams'

/** ~4–6 UI updates per second from vision pipeline. */
const UI_FLUSH_MS = 167

const MAX_INIT_ATTEMPTS = 4
const RETRY_BASE_MS = 420
const REF_WAIT_MS = 8000
const VIDEO_LAYOUT_WAIT_MS = 6500
const REF_POLL_MS = 40

export interface VisionUiSnapshot {
  overlayVisible: boolean
  landmarkDebug: boolean
  intelligenceDebug: boolean
  mirrorForPreview: boolean
}

function waitNextPaint(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    window.setTimeout(resolve, ms)
  })
}

async function waitForVideoAndCanvasLayout(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  maxMs: number,
  getCancelled: () => boolean,
): Promise<boolean> {
  const t0 = performance.now()
  while (performance.now() - t0 < maxMs) {
    if (getCancelled()) return false
    const vOk =
      video.videoWidth > 0 &&
      video.videoHeight > 0 &&
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    const rect = canvas.getBoundingClientRect()
    const cOk = rect.width >= 2 && rect.height >= 2
    if (vOk && cOk) return true
    await sleep(REF_POLL_MS)
  }
  return false
}

async function waitForVideoCanvasRefs(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  maxMs: number,
  getCancelled: () => boolean,
): Promise<{ video: HTMLVideoElement; canvas: HTMLCanvasElement } | null> {
  const t0 = performance.now()
  while (performance.now() - t0 < maxMs) {
    if (getCancelled()) return null
    const video = videoRef.current
    const canvas = canvasRef.current
    if (video && canvas) return { video, canvas }
    await sleep(REF_POLL_MS)
  }
  return null
}

export function useVisionDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  enabled: boolean,
  lang: Lang,
  cleanView: boolean,
  recognition: RecognitionSettings,
  visionUiRef: React.MutableRefObject<VisionUiSnapshot>,
) {
  const cleanViewRef = useRef(cleanView)
  cleanViewRef.current = cleanView

  const recSig = useMemo(() => recognitionChannelSignature(recognition), [recognition])

  const [handCount, setHandCount] = useState(0)
  const [personPresent, setPersonPresent] = useState(false)
  const [primaryHand, setPrimaryHand] = useState<HandDetectionResult | null>(null)
  const [multiSnapshot, setMultiSnapshot] = useState<MultiHandGestureSnapshot | null>(null)
  const [stableGesture, setStableGesture] = useState<StableGestureResult | null>(null)
  const [state, setState] = useState<VisionDetectionState>('idle')
  const [detectionFps, setDetectionFps] = useState(0)

  const handleRef = useRef<HandTrackingHandle | null>(null)
  const landmarkerRef = useRef<HandLandmarker | null>(null)
  const gestureChannelRef = useRef<ReturnType<typeof createMultiHandGestureChannel> | null>(null)
  const labelRef = useRef({ left: '', right: '', unknown: '' })

  useEffect(() => {
    const d = translations[lang]
    labelRef.current = {
      left: d.res_hand_left,
      right: d.res_hand_right,
      unknown: d.res_hand_unknown,
    }
  }, [lang])

  useEffect(() => {
    const canvasEl = canvasRef.current

    if (!enabled) {
      gestureChannelRef.current?.reset()
      gestureChannelRef.current = null
      handleRef.current?.cleanupHandTracking()
      handleRef.current = null
      landmarkerRef.current?.close()
      landmarkerRef.current = null
      if (canvasEl) clearHandOverlay(canvasEl)
      startTransition(() => {
        setHandCount(0)
        setPersonPresent(false)
        setPrimaryHand(null)
        setMultiSnapshot(null)
        setStableGesture(null)
        setDetectionFps(0)
        setState('idle')
      })
      return
    }

    const smootherOpts = buildSmootherOptionsFromRecognition(recognition)
    gestureChannelRef.current = createMultiHandGestureChannel({
      smoother: smootherOpts,
      showIntelligenceDebug: () => visionUiRef.current.intelligenceDebug,
    })

    let cancelled = false
    const getCancelled = (): boolean => cancelled

    void (async () => {
      for (let attempt = 0; attempt < MAX_INIT_ATTEMPTS && !cancelled; attempt += 1) {
        if (attempt > 0) {
          const backoff = RETRY_BASE_MS * Math.min(attempt, 3)
          startTransition(() => setState('initializing'))
          await sleep(backoff)
        } else {
          startTransition(() => setState('loading_models'))
        }

        await waitNextPaint()

        const refs = await waitForVideoCanvasRefs(videoRef, canvasRef, REF_WAIT_MS, getCancelled)
        if (!refs || cancelled) continue

        const layoutOk = await waitForVideoAndCanvasLayout(refs.video, refs.canvas, VIDEO_LAYOUT_WAIT_MS, getCancelled)
        if (!layoutOk || cancelled) continue

        const video = videoRef.current
        const canvas = canvasRef.current
        if (!video || !canvas || cancelled) continue

        try {
          startTransition(() => setState('loading_models'))
          const wasm = await loadVisionTasksFileset()
          if (cancelled) return

          startTransition(() => setState('initializing'))
          const { handle, handLandmarker } = await createHandOnlyAndStart(wasm, {
            video,
            canvas,
            getActive: () => !cancelled,
            getCleanView: () => cleanViewRef.current,
            getOverlayVisible: () => visionUiRef.current.overlayVisible,
            getLandmarkDebugOverlay: () => visionUiRef.current.landmarkDebug,
            getMirrorForPreview: () => visionUiRef.current.mirrorForPreview,
            uiFlushMs: UI_FLUSH_MS,
            handOverlayLabels: () => labelRef.current,
            onDetectionHz: hz => {
              if (cancelled) return
              const rounded = Math.round(hz)
              startTransition(() => setDetectionFps(rounded))
            },
            onSample: ({ handCount: hc, personPresent: pp, hands }) => {
              if (cancelled) return
              const ch = gestureChannelRef.current
              const multi = ch?.push(hands) ?? null

              const primary =
                hands.find(h => h.displaySide === 'Left') ?? hands.find(h => h.displaySide === 'Right') ?? hands[0] ?? null

              if (hc === 0) {
                ch?.reset()
                startTransition(() => {
                  setHandCount(0)
                  setPersonPresent(pp)
                  setPrimaryHand(null)
                  setMultiSnapshot(null)
                  setStableGesture(null)
                })
                return
              }

              const prim = multi?.primaryStable ?? null
              startTransition(() => {
                setHandCount(hc)
                setPersonPresent(pp)
                setPrimaryHand(primary)
                setMultiSnapshot(multi)
                setStableGesture(prev => {
                  if (prim) {
                    if (
                      prev &&
                      prev.id === prim.id &&
                      prev.confidencePct === prim.confidencePct &&
                      prev.components.stability === prim.components.stability
                    ) {
                      return prev
                    }
                    return prim
                  }
                  return prev
                })
              })
            },
          })

          if (cancelled) {
            handle.cleanupHandTracking()
            handLandmarker.close()
            return
          }

          handleRef.current = handle
          landmarkerRef.current = handLandmarker
          startTransition(() => setState('ready'))
          return
        } catch {
          /* try next attempt */
        }
      }

      if (!cancelled) startTransition(() => setState('error'))
    })()

    return () => {
      cancelled = true
      gestureChannelRef.current?.reset()
      gestureChannelRef.current = null
      handleRef.current?.cleanupHandTracking()
      handleRef.current = null
      landmarkerRef.current?.close()
      landmarkerRef.current = null
      if (canvasEl) clearHandOverlay(canvasEl)
    }
  }, [enabled, videoRef, canvasRef, recSig, recognition, visionUiRef])

  return {
    handCount,
    personPresent,
    primaryHand,
    multiSnapshot,
    stableGesture,
    state,
    detectionFps,
  }
}
