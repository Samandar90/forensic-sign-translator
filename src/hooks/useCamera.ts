import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraState = 'idle' | 'requesting' | 'active' | 'denied' | 'unavailable' | 'error'

interface UseCameraReturn {
  cameraState: CameraState
  errorMessage: string
  startCamera: () => Promise<boolean>
  stopCamera: () => void
}

export function useCamera(
  videoRef: React.RefObject<HTMLVideoElement | null>,
): UseCameraReturn {
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraState, setCameraState] = useState<CameraState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

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
    setErrorMessage('')
  }, [videoRef])

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unavailable')
      setErrorMessage('Camera API is not supported in this browser.')
      return false
    }

    if (cameraState === 'active') {
      return true
    }

    setCameraState('requesting')
    setErrorMessage('')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920, min: 640 },
          height: { ideal: 1080, min: 480 },
          facingMode: 'user',
          frameRate: { ideal: 30 },
        },
        audio: false,
      })

      streamRef.current = stream

      const video = videoRef.current
      if (!video) {
        setCameraState('error')
        setErrorMessage('Camera stream started, but no video target is available.')
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
      streamRef.current = null
      const exception = error as DOMException

      if (exception.name === 'NotAllowedError' || exception.name === 'PermissionDeniedError') {
        setCameraState('denied')
        setErrorMessage('Camera permission was denied. Allow access and try again.')
      } else if (exception.name === 'NotFoundError' || exception.name === 'DevicesNotFoundError') {
        setCameraState('unavailable')
        setErrorMessage('No camera device was found on this system.')
      } else if (exception.name === 'NotReadableError') {
        setCameraState('error')
        setErrorMessage('The camera is busy in another application.')
      } else {
        setCameraState('error')
        setErrorMessage(`Camera error: ${exception.message || 'Unknown error'}`)
      }

      return false
    }
  }, [cameraState, videoRef])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  return { cameraState, errorMessage, startCamera, stopCamera }
}
