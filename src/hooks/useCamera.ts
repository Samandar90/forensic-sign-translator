import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { CameraErrorCode } from '../types'
import { QUALITY_PRESETS, type VideoQualityPreset } from '../lib/camera/adaptiveQuality'

export type CameraState = 'idle' | 'requesting' | 'active' | 'denied' | 'unavailable' | 'error'

interface UseCameraReturn {
  cameraState: CameraState
  errorCode: CameraErrorCode
  qualityPreset: VideoQualityPreset
  startCamera: (forcedPreset?: VideoQualityPreset) => Promise<boolean>
  stopCamera: () => void
  setQualityPresetAndRestart: (preset: VideoQualityPreset) => Promise<boolean>
  applyQualityWhenIdle: (preset: VideoQualityPreset) => void
}

function fallbackChain(start: VideoQualityPreset): readonly VideoQualityPreset[] {
  if (start === 'FHD') return ['FHD', 'HD', 'SD'] as const
  if (start === 'HD') return ['HD', 'SD'] as const
  return ['SD'] as const
}

async function openStreamWithFallback(startPreset: VideoQualityPreset): Promise<MediaStream | null> {
  if (!navigator.mediaDevices?.getUserMedia) return null
  for (const p of fallbackChain(startPreset)) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: QUALITY_PRESETS[p],
        audio: false,
      })
    } catch {
      /* try next */
    }
  }
  return null
}

export function useCamera(
  videoRef: RefObject<HTMLVideoElement | null>,
  initialPreset: VideoQualityPreset = 'HD',
): UseCameraReturn {
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraState, setCameraState] = useState<CameraState>('idle')
  const [errorCode, setErrorCode] = useState<CameraErrorCode>(null)
  const [qualityPreset, setQualityPreset] = useState<VideoQualityPreset>(initialPreset)
  const qualityRef = useRef<VideoQualityPreset>(initialPreset)
  qualityRef.current = qualityPreset

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
      videoRef.current.onloadedmetadata = null
    }

    setCameraState('idle')
    setErrorCode(null)
  }, [videoRef])

  const startCamera = useCallback(
    async (forcedPreset?: VideoQualityPreset): Promise<boolean> => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState('unavailable')
        setErrorCode('api_unsupported')
        return false
      }

      if (streamRef.current) {
        return true
      }

      const preset = forcedPreset ?? qualityRef.current
      setQualityPreset(preset)
      qualityRef.current = preset

      setCameraState('requesting')
      setErrorCode(null)

      try {
        const stream = await openStreamWithFallback(preset)
        if (!stream) {
          throw new DOMException('getUserMedia failed', 'NotReadableError')
        }

        streamRef.current = stream

        const video = videoRef.current
        if (!video) {
          stream.getTracks().forEach(track => track.stop())
          streamRef.current = null
          setCameraState('error')
          setErrorCode('no_video_target')
          return false
        }

        video.srcObject = stream

        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => {
            void video.play().then(resolve).catch(reject)
          }
        })

        setCameraState('active')
        return true
      } catch (error) {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
          streamRef.current = null
        }

        const exception = error as DOMException

        if (exception.name === 'NotAllowedError' || exception.name === 'PermissionDeniedError') {
          setCameraState('denied')
          setErrorCode('permission_denied')
        } else if (exception.name === 'NotFoundError' || exception.name === 'DevicesNotFoundError') {
          setCameraState('unavailable')
          setErrorCode('no_device')
        } else if (exception.name === 'NotReadableError') {
          setCameraState('error')
          setErrorCode('busy')
        } else {
          setCameraState('error')
          setErrorCode('unknown')
        }

        return false
      }
    },
    [videoRef],
  )

  const setQualityPresetAndRestart = useCallback(
    async (preset: VideoQualityPreset): Promise<boolean> => {
      const hadStream = Boolean(streamRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
        if (videoRef.current) {
          videoRef.current.srcObject = null
          videoRef.current.onloadedmetadata = null
        }
        setErrorCode(null)
        if (hadStream) {
          setCameraState('requesting')
        }
      }
      setQualityPreset(preset)
      qualityRef.current = preset
      return startCamera(preset)
    },
    [startCamera, videoRef],
  )

  const applyQualityWhenIdle = useCallback((preset: VideoQualityPreset) => {
    if (!streamRef.current) {
      setQualityPreset(preset)
      qualityRef.current = preset
    }
  }, [])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  return {
    cameraState,
    errorCode,
    qualityPreset,
    startCamera,
    stopCamera,
    setQualityPresetAndRestart,
    applyQualityWhenIdle,
  }
}
