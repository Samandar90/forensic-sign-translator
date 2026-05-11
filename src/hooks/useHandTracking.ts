import { useEffect, useRef, useState } from 'react'
import type { HandsResults, NormalizedLandmarkList } from '../mediapipe-globals'

export type TrackingStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface HandInfo {
  label: string
  confidence: number
}

interface UseHandTrackingReturn {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  trackingStatus: TrackingStatus
  handsDetected: number
  handInfos: HandInfo[]
}

// Full 21-point skeleton connections
const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],          // thumb
  [0, 5], [5, 6], [6, 7], [7, 8],          // index
  [0, 9], [9, 10], [10, 11], [11, 12],     // middle
  [0, 13], [13, 14], [14, 15], [15, 16],   // ring
  [0, 17], [17, 18], [18, 19], [19, 20],   // pinky
  [5, 9], [9, 13], [13, 17],               // palm arch
]

const FINGERTIPS = new Set([4, 8, 12, 16, 20])
const KNUCKLES   = new Set([1, 5, 9, 13, 17])

// Per-landmark glow color
const LM_COLOR: Record<number, string> = {
  0: '#00d4ff',
  1: '#00d4ff', 2: '#00d4ff', 3: '#22e8ff', 4: '#00ff88', // thumb
  5: '#00d4ff', 6: '#22e8ff', 7: '#44f0ff', 8: '#00ff88', // index
  9: '#00d4ff', 10: '#22e8ff', 11: '#44f0ff', 12: '#00ff88', // middle
  13: '#00d4ff', 14: '#22e8ff', 15: '#44f0ff', 16: '#00ff88', // ring
  17: '#00d4ff', 18: '#22e8ff', 19: '#44f0ff', 20: '#00ff88', // pinky
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawHand(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmarkList,
  w: number,
  h: number,
  label: string,
  confidence: number,
) {
  // Flip x to match CSS mirrored video (transform: scaleX(-1))
  const lx = (lm: { x: number }) => (1 - lm.x) * w
  const ly = (lm: { y: number }) => lm.y * h

  // ── Connection lines ──────────────────────────────────────
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineWidth = 1.8

  for (const [a, b] of CONNECTIONS) {
    const p1 = landmarks[a]
    const p2 = landmarks[b]
    const x1 = lx(p1), y1 = ly(p1)
    const x2 = lx(p2), y2 = ly(p2)

    const grad = ctx.createLinearGradient(x1, y1, x2, y2)
    grad.addColorStop(0, 'rgba(0,212,255,0.7)')
    grad.addColorStop(1, 'rgba(0,212,255,0.3)')

    ctx.shadowColor = '#00d4ff'
    ctx.shadowBlur = 7
    ctx.strokeStyle = grad
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
  ctx.restore()

  // ── Landmark dots ─────────────────────────────────────────
  ctx.save()
  for (let i = 0; i < landmarks.length; i++) {
    const lm  = landmarks[i]
    const x   = lx(lm)
    const y   = ly(lm)
    const isTip    = FINGERTIPS.has(i)
    const isKnuckle = KNUCKLES.has(i)
    const color = LM_COLOR[i] ?? '#00d4ff'
    const r = isTip ? 5.5 : isKnuckle ? 4 : 2.8

    // Glow halo
    ctx.beginPath()
    ctx.arc(x, y, r + 4, 0, Math.PI * 2)
    ctx.fillStyle = isTip ? 'rgba(0,255,136,0.1)' : 'rgba(0,212,255,0.07)'
    ctx.fill()

    // Main dot
    ctx.shadowColor = color
    ctx.shadowBlur  = isTip ? 16 : 9
    ctx.fillStyle   = color
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()

    // White specular on fingertips
    if (isTip) {
      ctx.shadowBlur  = 0
      ctx.fillStyle   = 'rgba(255,255,255,0.75)'
      ctx.beginPath()
      ctx.arc(x - r * 0.28, y - r * 0.28, r * 0.36, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()

  // ── Label pill near wrist ─────────────────────────────────
  ctx.save()
  const wx  = lx(landmarks[0])
  const wy  = ly(landmarks[0])
  const pct = Math.round(confidence * 100)
  const txt = `${label.toUpperCase()}  ${pct}%`

  ctx.font = '700 10px Inter, -apple-system, sans-serif'
  const tw = ctx.measureText(txt).width
  const bx = wx - tw / 2 - 9
  const by = wy + 14
  const bw = tw + 18
  const bh = 19

  // Background pill
  roundRect(ctx, bx, by, bw, bh, 4)
  ctx.fillStyle   = 'rgba(0,0,0,0.6)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,212,255,0.45)'
  ctx.lineWidth   = 1
  roundRect(ctx, bx, by, bw, bh, 4)
  ctx.stroke()

  // Text
  ctx.fillStyle   = '#00d4ff'
  ctx.shadowColor = '#00d4ff'
  ctx.shadowBlur  = 8
  ctx.fillText(txt, wx - tw / 2, by + 13.5)
  ctx.restore()
}

export function useHandTracking(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  isActive: boolean,
): UseHandTrackingReturn {
  const canvasRef     = useRef<HTMLCanvasElement | null>(null)
  const handsRef      = useRef<InstanceType<typeof Hands> | null>(null)
  const rafRef        = useRef<number>(0)
  const processingRef = useRef(false)
  const resultsRef    = useRef<HandsResults | null>(null)

  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>('idle')
  const [handsDetected, setHandsDetected]   = useState(0)
  const [handInfos, setHandInfos]           = useState<HandInfo[]>([])

  // ── Initialize ────────────────────────────────────────────
  useEffect(() => {
    if (!isActive) {
      cancelAnimationFrame(rafRef.current)
      handsRef.current = null
      resultsRef.current = null
      setTrackingStatus('idle')
      setHandsDetected(0)
      setHandInfos([])
      // Clear canvas
      const cvs = canvasRef.current
      if (cvs) cvs.getContext('2d')?.clearRect(0, 0, cvs.width, cvs.height)
      return
    }

    // MediaPipe is loaded from CDN — confirm it's available
    if (typeof Hands === 'undefined') {
      console.error('[HandTracking] MediaPipe Hands not found on global scope')
      setTrackingStatus('error')
      return
    }

    setTrackingStatus('loading')

    const hands = new Hands({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`,
    })

    hands.setOptions({
      selfieMode: false,
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.65,
      minTrackingConfidence: 0.5,
    })

    hands.onResults((results: HandsResults) => {
      resultsRef.current = results
      const count = results.multiHandLandmarks?.length ?? 0
      setHandsDetected(count)
      setHandInfos(
        results.multiHandedness?.map(h => ({
          label: h.label,
          confidence: h.score,
        })) ?? [],
      )
    })

    hands
      .initialize()
      .then(() => {
        handsRef.current = hands
        setTrackingStatus('ready')
      })
      .catch((err: unknown) => {
        console.error('[HandTracking] init error', err)
        setTrackingStatus('error')
      })

    return () => {
      cancelAnimationFrame(rafRef.current)
      handsRef.current = null
      hands.close().catch(() => {})
    }
  }, [isActive])

  // ── RAF draw + send loop ──────────────────────────────────
  useEffect(() => {
    if (trackingStatus !== 'ready') return

    function loop() {
      rafRef.current = requestAnimationFrame(loop)

      const video  = videoRef.current
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Keep canvas dimensions matched to video source
      const vw = video?.videoWidth  || canvas.offsetWidth
      const vh = video?.videoHeight || canvas.offsetHeight
      if (canvas.width !== vw || canvas.height !== vh) {
        canvas.width  = vw
        canvas.height = vh
      }

      const w = canvas.width
      const h = canvas.height

      ctx.clearRect(0, 0, w, h)

      // Feed new frame to MediaPipe (non-blocking — skip if already processing)
      if (
        handsRef.current &&
        video &&
        !processingRef.current &&
        video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA
      ) {
        processingRef.current = true
        handsRef.current
          .send({ image: video })
          .catch(() => {})
          .finally(() => { processingRef.current = false })
      }

      // Render latest results on canvas
      const res = resultsRef.current
      if (res?.multiHandLandmarks?.length) {
        for (let i = 0; i < res.multiHandLandmarks.length; i++) {
          drawHand(
            ctx,
            res.multiHandLandmarks[i],
            w,
            h,
            res.multiHandedness?.[i]?.label ?? 'Hand',
            res.multiHandedness?.[i]?.score  ?? 1,
          )
        }
      }
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [trackingStatus, videoRef])

  return { canvasRef, trackingStatus, handsDetected, handInfos }
}
