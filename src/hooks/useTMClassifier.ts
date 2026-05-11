import { useEffect, useRef, useState } from 'react'

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface TMPrediction {
  label: string
  confidence: number
}

const MODEL_URL    = '/model/model.json'
const METADATA_URL = '/model/metadata.json'
const PREDICT_INTERVAL_MS = 200

export function useTMClassifier(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  isActive: boolean,
) {
  const modelRef    = useRef<tmImage.CustomMobileNet | null>(null)
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const loadingRef  = useRef(false)

  const [modelStatus,  setModelStatus]  = useState<ModelStatus>('idle')
  const [predictions,  setPredictions]  = useState<TMPrediction[]>([])

  // ── Load model once on mount ──────────────────────────────
  useEffect(() => {
    if (loadingRef.current || modelRef.current) return

    if (typeof tmImage === 'undefined') {
      console.error('[TM] tmImage global not found — CDN script may not have loaded')
      setModelStatus('error')
      return
    }

    loadingRef.current = true
    setModelStatus('loading')

    tmImage
      .load(MODEL_URL, METADATA_URL)
      .then(model => {
        modelRef.current  = model
        loadingRef.current = false
        setModelStatus('ready')
      })
      .catch(err => {
        console.error('[TM] Model load failed:', err)
        loadingRef.current = false
        setModelStatus('error')
      })
  }, [])

  // ── Prediction loop — runs only when session is active ────
  useEffect(() => {
    if (modelStatus !== 'ready' || !isActive) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      if (!isActive) setPredictions([])
      return
    }

    timerRef.current = setInterval(async () => {
      const video = videoRef.current
      if (
        !video ||
        !modelRef.current ||
        video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA ||
        video.paused
      ) return

      try {
        const raw = await modelRef.current.predict(video)
        setPredictions(raw.map(p => ({ label: p.className, confidence: p.probability })))
      } catch {
        // silently ignore transient prediction errors
      }
    }, PREDICT_INTERVAL_MS)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [modelStatus, isActive, videoRef])

  return { modelStatus, predictions }
}
