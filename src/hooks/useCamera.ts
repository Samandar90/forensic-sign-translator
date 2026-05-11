import { useState, useRef, useCallback, useEffect } from 'react'

export type CameraState = 'idle' | 'requesting' | 'active' | 'denied' | 'unavailable' | 'error'

interface UseCameraReturn {
  cameraState: CameraState
  errorMessage: string
  startCamera: () => Promise<void>
  stopCamera: () => void
}

export function useCamera(
  videoRef: React.RefObject<HTMLVideoElement | null>,
): UseCameraReturn {
  const streamRef  = useRef<MediaStream | null>(null)
  const [cameraState,  setCameraState]  = useState<CameraState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraState('idle')
    setErrorMessage('')
  }, [videoRef])

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unavailable')
      setErrorMessage('Camera API not supported in this browser')
      return
    }

    setCameraState('requesting')
    setErrorMessage('')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width:       { ideal: 1920, min: 640 },
          height:      { ideal: 1080, min: 480 },
          facingMode:  'user',
          frameRate:   { ideal: 30 },
        },
        audio: false,
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject       = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play()
          setCameraState('active')
        }
      }
    } catch (err) {
      streamRef.current = null
      const e = err as DOMException
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        setCameraState('denied')
        setErrorMessage('Camera permission denied. Please allow camera access and try again.')
      } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
        setCameraState('unavailable')
        setErrorMessage('No camera device found on this system.')
      } else if (e.name === 'NotReadableError') {
        setCameraState('error')
        setErrorMessage('Camera is already in use by another application.')
      } else {
        setCameraState('error')
        setErrorMessage(`Camera error: ${e.message || 'Unknown error'}`)
      }
    }
  }, [videoRef])

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }
  }, [])

  return { cameraState, errorMessage, startCamera, stopCamera }
}
