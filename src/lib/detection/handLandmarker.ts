import {
  HandLandmarker,
  type HandLandmarkerResult,
  type NormalizedLandmark,
  type PoseLandmarker,
} from '@mediapipe/tasks-vision'
import type { VisionFileset } from './constants'
import { HAND_LANDMARKER_MODEL } from './constants'
import { createPoseLandmarker } from './poseDetection'
import { displaySideFromMediaPipe } from './normalizeHandedness'
import {
  clearHandOverlay,
  readHandOverlayLayout,
  renderHandLandmarksOverlay,
  syncOverlayCanvasToLayout,
  type HandOverlayLayout,
} from './drawHandLandmarks'
import type { FingerStates } from '../gestures/fingerGeometry'
import { getFingerStates } from '../gestures/fingerGeometry'

export { clearHandOverlay } from './drawHandLandmarks'
export type { FingerStates, FingerName, FingerState } from '../gestures/fingerGeometry'
export { FINGER_ORDER, getFingerStates } from '../gestures/fingerGeometry'

/** One hand: 21 MediaPipe hand landmarks (normalized image space). */
export type HandLandmarks = readonly NormalizedLandmark[]

export interface HandDetectionResult {
  readonly landmarks: HandLandmarks
  /** User-facing side after mirror correction (matches mirrored preview). */
  readonly displaySide: 'Left' | 'Right' | 'Unknown'
  readonly fingerStates: FingerStates
}

function handednessFromCategories(result: HandLandmarkerResult, index: number): 'Left' | 'Right' | 'Unknown' {
  const rows = result.handedness ?? result.handednesses
  const row = rows?.[index]
  const first = row?.[0]
  const name = first?.categoryName ?? first?.displayName ?? ''
  if (name === 'Left' || name === 'Right') return name
  return 'Unknown'
}

export function buildHandDetectionResults(
  result: HandLandmarkerResult | null | undefined,
  opts: { mirrorForPreview: boolean },
): HandDetectionResult[] {
  if (!result?.landmarks?.length) return []
  const { landmarks } = result
  const out: HandDetectionResult[] = []
  for (let i = 0; i < landmarks.length; i += 1) {
    const lm = landmarks[i]
    if (!lm || lm.length < 21) continue
    const mp = handednessFromCategories(result, i)
    out.push({
      landmarks: lm,
      displaySide: displaySideFromMediaPipe(mp, opts.mirrorForPreview),
      fingerStates: getFingerStates(lm),
    })
  }
  return out
}

function handsFingerprint(hands: readonly HandDetectionResult[]): string {
  return [...hands]
    .map(
      h =>
        `${h.displaySide}:${h.fingerStates.thumb}${h.fingerStates.index}${h.fingerStates.middle}${h.fingerStates.ring}${h.fingerStates.pinky}`,
    )
    .sort()
    .join('|')
}

export async function createHandLandmarker(fileset: VisionFileset): Promise<HandLandmarker> {
  return HandLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: HAND_LANDMARKER_MODEL,
      delegate: 'CPU',
    },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  })
}

export interface StartHandTrackingConfig {
  readonly handLandmarker: HandLandmarker
  /** When omitted or null, pose is skipped (faster); `personPresent` is derived from hands. */
  readonly poseLandmarker?: PoseLandmarker | null
  readonly video: HTMLVideoElement
  readonly canvas: HTMLCanvasElement
  readonly getActive: () => boolean
  /** Throttle React / consumer updates (ms). */
  readonly uiFlushMs: number
  /** Wrist labels on overlay (localized). */
  readonly handOverlayLabels: () => { left: string; right: string; unknown: string }
  readonly onSample: (sample: {
    handCount: number
    personPresent: boolean
    hands: HandDetectionResult[]
  }) => void
  /** Called ~1 Hz with measured detection loop rate. */
  readonly onDetectionHz?: (hz: number) => void
  /** When true, draw a lighter skeleton with no wrist labels (read each frame). */
  readonly getCleanView?: () => boolean
  /** When false, skip drawing landmark overlay (detection still runs). */
  readonly getOverlayVisible?: () => boolean
  /** Dev-style dense landmark overlay. */
  readonly getLandmarkDebugOverlay?: () => boolean
  /** Mirror preview: flip handedness + overlay mapping (selfie-style). */
  readonly getMirrorForPreview?: () => boolean
}

export interface HandTrackingHandle {
  readonly stopHandTracking: () => void
  readonly cleanupHandTracking: () => void
}

/** ~14 FPS detection target; camera preview uses native rate. */
const DETECTION_INTERVAL_MS = 72

/**
 * Single rAF loop: throttled `detectForVideo`, optional pose, overlay draw only on new detection.
 */
export function startHandTracking(config: StartHandTrackingConfig): HandTrackingHandle {
  let rafId = 0
  let lastFlush = 0
  let lastCount = 0
  let lastPerson = false
  let lastHandPrint = ''
  let primed = false

  let lastHandDraw: HandLandmarkerResult | null = null
  let lastInferTs = 0
  let inferCountWindow = 0
  let lastHzReportTs = 0

  let layoutRedraw = true
  let ro: ResizeObserver | null = null
  const { video, canvas } = config
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => {
      layoutRedraw = true
    })
    ro.observe(video.parentElement ?? video)
  }

  const drawOverlay = (ctx: CanvasRenderingContext2D, layout: HandOverlayLayout): void => {
    if (!layout || !lastHandDraw?.landmarks?.length) return
    if (config.getOverlayVisible?.() === false) {
      clearHandOverlay(canvas)
      return
    }
    const labels = config.handOverlayLabels()
    const mirror = config.getMirrorForPreview?.() ?? true
    const hands = buildHandDetectionResults(lastHandDraw, { mirrorForPreview: mirror })
    const entries = hands.map(h => ({
      landmarks: h.landmarks,
      displaySide: h.displaySide,
      label:
        h.displaySide === 'Left'
          ? labels.left
          : h.displaySide === 'Right'
            ? labels.right
            : labels.unknown,
    }))
    const debugLm = config.getLandmarkDebugOverlay?.() ?? false
    const clean = config.getCleanView?.() ?? false
    renderHandLandmarksOverlay(ctx, layout, entries, {
      showFingerLabels: debugLm,
      minimal: clean && !debugLm,
    })
  }

  const tick = (ts: number) => {
    if (!config.getActive()) {
      window.cancelAnimationFrame(rafId)
      rafId = 0
      return
    }
    rafId = window.requestAnimationFrame(tick)

    const { handLandmarker, poseLandmarker, uiFlushMs, onSample, onDetectionHz } = config

    if (video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
      clearHandOverlay(canvas)
      return
    }

    const mirror = config.getMirrorForPreview?.() ?? true
    const layout = readHandOverlayLayout(video, { mirrorX: mirror })
    if (!layout) {
      clearHandOverlay(canvas)
      return
    }

    syncOverlayCanvasToLayout(canvas, layout)
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const canInfer = ts - lastInferTs >= DETECTION_INTERVAL_MS

    if (canInfer) {
      lastInferTs = ts
      inferCountWindow += 1
      lastHandDraw = handLandmarker.detectForVideo(video, ts)

      let personPresent = (lastHandDraw?.landmarks?.length ?? 0) > 0
      if (poseLandmarker) {
        const poseResult = poseLandmarker.detectForVideo(video, ts)
        personPresent = (poseResult.landmarks?.length ?? 0) > 0 || personPresent
        try {
          poseResult.close?.()
        } catch {
          /* noop */
        }
      }

      const hands = buildHandDetectionResults(lastHandDraw, { mirrorForPreview: mirror })
      const handCount = hands.length
      if (!poseLandmarker) {
        personPresent = handCount > 0
      }

      if (onDetectionHz) {
        if (lastHzReportTs === 0) lastHzReportTs = ts
        if (ts - lastHzReportTs >= 1000) {
          const elapsed = (ts - lastHzReportTs) / 1000
          const hz = elapsed > 0 ? inferCountWindow / elapsed : 0
          onDetectionHz(hz)
          inferCountWindow = 0
          lastHzReportTs = ts
        }
      }

      const shouldFlush = !primed || ts - lastFlush >= uiFlushMs
      if (shouldFlush) {
        primed = true
        lastFlush = ts
        const print = handsFingerprint(hands)
        const changed = handCount !== lastCount || personPresent !== lastPerson || print !== lastHandPrint
        if (changed) {
          lastCount = handCount
          lastPerson = personPresent
          lastHandPrint = print
          onSample({ handCount, personPresent, hands: [...hands] })
        }
      }

      if (lastHandDraw?.landmarks?.length) {
        if (config.getOverlayVisible?.() === false) {
          clearHandOverlay(canvas)
        } else {
          drawOverlay(ctx, layout)
        }
      } else {
        clearHandOverlay(canvas)
      }
      layoutRedraw = false
    } else if (layoutRedraw && lastHandDraw?.landmarks?.length && config.getOverlayVisible?.() !== false) {
      drawOverlay(ctx, layout)
      layoutRedraw = false
    }
  }

  const stopHandTracking = (): void => {
    window.cancelAnimationFrame(rafId)
    rafId = 0
  }

  const cleanupHandTracking = (): void => {
    stopHandTracking()
    ro?.disconnect()
    ro = null
    lastHandDraw = null
    clearHandOverlay(config.canvas)
  }

  rafId = window.requestAnimationFrame(tick)

  return { stopHandTracking, cleanupHandTracking }
}

/** Hand tracking only (no pose) — recommended for smooth preview + stable FPS. */
export async function createHandOnlyAndStart(
  fileset: VisionFileset,
  config: Omit<StartHandTrackingConfig, 'handLandmarker' | 'poseLandmarker'> &
    Pick<
      StartHandTrackingConfig,
      | 'video'
      | 'canvas'
      | 'getActive'
      | 'uiFlushMs'
      | 'handOverlayLabels'
      | 'onSample'
      | 'onDetectionHz'
      | 'getCleanView'
      | 'getOverlayVisible'
      | 'getLandmarkDebugOverlay'
      | 'getMirrorForPreview'
    >,
): Promise<{ handle: HandTrackingHandle; handLandmarker: HandLandmarker }> {
  const handLandmarker = await createHandLandmarker(fileset)
  const handle = startHandTracking({
    ...config,
    handLandmarker,
    poseLandmarker: null,
  })
  return { handle, handLandmarker }
}

/** Optional pose + hand (heavier). */
export async function createPoseAndHandAndStart(
  fileset: VisionFileset,
  config: Omit<StartHandTrackingConfig, 'handLandmarker' | 'poseLandmarker'> &
    Pick<
      StartHandTrackingConfig,
      | 'video'
      | 'canvas'
      | 'getActive'
      | 'uiFlushMs'
      | 'handOverlayLabels'
      | 'onSample'
      | 'onDetectionHz'
      | 'getCleanView'
      | 'getOverlayVisible'
      | 'getLandmarkDebugOverlay'
      | 'getMirrorForPreview'
    >,
): Promise<{ handle: HandTrackingHandle; handLandmarker: HandLandmarker; poseLandmarker: PoseLandmarker }> {
  const [handLandmarker, poseLandmarker] = await Promise.all([
    createHandLandmarker(fileset),
    createPoseLandmarker(fileset),
  ])
  const handle = startHandTracking({
    ...config,
    handLandmarker,
    poseLandmarker,
  })
  return { handle, handLandmarker, poseLandmarker }
}
