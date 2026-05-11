import { useEffect, useRef, useState } from 'react'

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface TMPrediction {
  label: string
  confidence: number
}

const PREDICT_INTERVAL_MS = 200

function resolveModelAsset(path: string) {
  const base = import.meta.env.BASE_URL || '/'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path
  return `${normalizedBase}${normalizedPath}`
}

export function useTMClassifier(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  isActive: boolean,
) {
  const modelRef = useRef<tmImage.CustomMobileNet | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const loadingRef = useRef(false)
  const mountedRef = useRef(true)

  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle')
  const [predictions, setPredictions] = useState<TMPrediction[]>([])

  useEffect(() => {
    mountedRef.current = true

    if (loadingRef.current || modelRef.current) {
      return () => {
        mountedRef.current = false
      }
    }

    if (typeof tmImage === 'undefined') {
      console.error('[TM] tmImage global not found')
      setModelStatus('error')
      return () => {
        mountedRef.current = false
      }
    }

    loadingRef.current = true
    setModelStatus('loading')

    void tmImage
      .load(resolveModelAsset('model/model.json'), resolveModelAsset('model/metadata.json'))
      .then(model => {
        if (!mountedRef.current) {
          return
        }

        modelRef.current = model
        loadingRef.current = false
        setModelStatus('ready')
      })
      .catch(error => {
        console.error('[TM] Model load failed:', error)
        if (!mountedRef.current) {
          return
        }

        loadingRef.current = false
        setModelStatus('error')
      })

    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (modelStatus !== 'ready' || !isActive) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }

      if (!isActive) {
        setPredictions([])
      }

      return
    }

    timerRef.current = setInterval(() => {
      const video = videoRef.current
      if (
        !video ||
        !modelRef.current ||
        video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA ||
        video.paused
      ) {
        return
      }

      void modelRef.current.predict(video)
        .then(rawPredictions => {
          setPredictions(
            rawPredictions.map(prediction => ({
              label: prediction.className,
              confidence: prediction.probability,
            })),
          )
        })
        .catch(() => {})
    }, PREDICT_INTERVAL_MS)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isActive, modelStatus, videoRef])

  return { modelStatus, predictions }
}
