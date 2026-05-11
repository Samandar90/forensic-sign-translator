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

const HANDS_CDN_VERSION = '0.4.1675469240'

const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
]

const FINGERTIPS = new Set([4, 8, 12, 16, 20])
const KNUCKLES = new Set([1, 5, 9, 13, 17])

const LANDMARK_COLORS: Record<number, string> = {
  0: '#3ad7ff',
  1: '#3ad7ff', 2: '#65e0ff', 3: '#65e0ff', 4: '#5cf2b4',
  5: '#3ad7ff', 6: '#65e0ff', 7: '#65e0ff', 8: '#5cf2b4',
  9: '#3ad7ff', 10: '#65e0ff', 11: '#65e0ff', 12: '#5cf2b4',
  13: '#3ad7ff', 14: '#65e0ff', 15: '#65e0ff', 16: '#5cf2b4',
  17: '#3ad7ff', 18: '#65e0ff', 19: '#65e0ff', 20: '#5cf2b4',
}

function drawHand(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmarkList,
  width: number,
  height: number,
) {
  const resolveX = (landmark: { x: number }) => (1 - landmark.x) * width
  const resolveY = (landmark: { y: number }) => landmark.y * height

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineWidth = 1.8

  for (const [from, to] of CONNECTIONS) {
    const start = landmarks[from]
    const end = landmarks[to]
    const gradient = ctx.createLinearGradient(
      resolveX(start),
      resolveY(start),
      resolveX(end),
      resolveY(end),
    )

    gradient.addColorStop(0, 'rgba(58, 215, 255, 0.72)')
    gradient.addColorStop(1, 'rgba(58, 215, 255, 0.28)')

    ctx.strokeStyle = gradient
    ctx.shadowColor = '#3ad7ff'
    ctx.shadowBlur = 7
    ctx.beginPath()
    ctx.moveTo(resolveX(start), resolveY(start))
    ctx.lineTo(resolveX(end), resolveY(end))
    ctx.stroke()
  }

  ctx.restore()
  ctx.save()

  for (let index = 0; index < landmarks.length; index += 1) {
    const landmark = landmarks[index]
    const x = resolveX(landmark)
    const y = resolveY(landmark)
    const isFingertip = FINGERTIPS.has(index)
    const isKnuckle = KNUCKLES.has(index)
    const radius = isFingertip ? 5.4 : isKnuckle ? 4 : 2.8
    const color = LANDMARK_COLORS[index] ?? '#3ad7ff'

    ctx.beginPath()
    ctx.arc(x, y, radius + 4, 0, Math.PI * 2)
    ctx.fillStyle = isFingertip ? 'rgba(92, 242, 180, 0.1)' : 'rgba(58, 215, 255, 0.08)'
    ctx.fill()

    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = isFingertip ? 18 : 10
    ctx.fill()
  }

  ctx.restore()
}

export function useHandTracking(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  isActive: boolean,
): UseHandTrackingReturn {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const handsRef = useRef<InstanceType<typeof Hands> | null>(null)
  const rafRef = useRef<number>(0)
  const processingRef = useRef(false)
  const resultsRef = useRef<HandsResults | null>(null)

  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>('idle')
  const [handsDetected, setHandsDetected] = useState(0)
  const [handInfos, setHandInfos] = useState<HandInfo[]>([])

  useEffect(() => {
    if (!isActive) {
      cancelAnimationFrame(rafRef.current)
      handsRef.current = null
      resultsRef.current = null
      setTrackingStatus('idle')
      setHandsDetected(0)
      setHandInfos([])

      const canvas = canvasRef.current
      if (canvas) {
        canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
      }

      return
    }

    if (typeof Hands === 'undefined') {
      console.error('[HandTracking] MediaPipe Hands not found on the global scope')
      setTrackingStatus('error')
      return
    }

    setTrackingStatus('loading')

    const hands = new Hands({
      locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${HANDS_CDN_VERSION}/${file}`,
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
        results.multiHandedness?.map(handedness => ({
          label: handedness.label,
          confidence: handedness.score,
        })) ?? [],
      )
    })

    void hands.initialize()
      .then(() => {
        handsRef.current = hands
        setTrackingStatus('ready')
      })
      .catch(error => {
        console.error('[HandTracking] init error', error)
        setTrackingStatus('error')
      })

    return () => {
      cancelAnimationFrame(rafRef.current)
      handsRef.current = null
      void hands.close().catch(() => {})
    }
  }, [isActive])

  useEffect(() => {
    if (trackingStatus !== 'ready') {
      return
    }

    function loop() {
      rafRef.current = requestAnimationFrame(loop)

      const video = videoRef.current
      const canvas = canvasRef.current
      if (!canvas) {
        return
      }

      const context = canvas.getContext('2d')
      if (!context) {
        return
      }

      const videoWidth = video?.videoWidth || canvas.offsetWidth
      const videoHeight = video?.videoHeight || canvas.offsetHeight
      if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
        canvas.width = videoWidth
        canvas.height = videoHeight
      }

      context.clearRect(0, 0, canvas.width, canvas.height)

      if (
        handsRef.current &&
        video &&
        !processingRef.current &&
        video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA
      ) {
        processingRef.current = true
        void handsRef.current.send({ image: video })
          .catch(() => {})
          .finally(() => {
            processingRef.current = false
          })
      }

      const results = resultsRef.current
      if (!results?.multiHandLandmarks?.length) {
        return
      }

      for (const landmarks of results.multiHandLandmarks) {
        drawHand(context, landmarks, canvas.width, canvas.height)
      }
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [trackingStatus, videoRef])

  return { canvasRef, trackingStatus, handsDetected, handInfos }
}
