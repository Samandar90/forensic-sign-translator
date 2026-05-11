import { useCallback, useEffect, useRef, useState } from 'react'
import type { SystemStatus, TranscriptEntry, VoiceStatus } from '../types'
import { useTMClassifier } from './useTMClassifier'
import { createSessionId, formatClockTimestamp } from '../utils/session'
import { cancelSpeech, speakText, speechSupported } from '../utils/speech'

const CONFIDENCE_THRESHOLD = 0.85
const GESTURE_LOCK_MS = 900
const NO_HAND_CLEAR_MS = 700
const SAME_GESTURE_COOLDOWN_MS = 5000

const PHRASE_MAP: Record<string, string> = {
  Help: 'Menga yordam kerak',
  Stop: 'To‘xtang',
  Yes: 'Ha',
  No: 'Yo‘q',
}

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

export function useGestureEngine(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  handsDetected: number,
) {
  const [isActive, setIsActive] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>(
    speechSupported() ? 'ready' : 'unavailable',
  )
  const [aiState, setAiState] = useState<SystemStatus['aiState']>('idle')
  const [currentGesture, setCurrentGesture] = useState('')
  const [currentTranslation, setCurrentTranslation] = useState('')
  const [confidence, setConfidence] = useState(0)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])

  const sessionIdRef = useRef(createSessionId())
  const candidateGestureRef = useRef('')
  const candidateStartedAtRef = useRef(0)
  const lockedGestureRef = useRef('')
  const lastCommittedGestureRef = useRef('')
  const lastCommittedAtRef = useRef(0)
  const neutralReadyRef = useRef(true)
  const clearSubtitleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const neutralTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { modelStatus, predictions } = useTMClassifier(videoRef, isActive)

  const cancelClearTimer = useCallback(() => {
    if (clearSubtitleTimerRef.current) {
      clearTimeout(clearSubtitleTimerRef.current)
      clearSubtitleTimerRef.current = null
    }
  }, [])

  const cancelNeutralTimer = useCallback(() => {
    if (neutralTimerRef.current) {
      clearTimeout(neutralTimerRef.current)
      neutralTimerRef.current = null
    }
  }, [])

  const clearLiveGesture = useCallback((clearSubtitleNow = false) => {
    setCurrentGesture('')
    setConfidence(0)

    if (clearSubtitleNow) {
      cancelClearTimer()
      setCurrentTranslation('')
      return
    }

    if (!clearSubtitleTimerRef.current) {
      clearSubtitleTimerRef.current = setTimeout(() => {
        setCurrentTranslation('')
        clearSubtitleTimerRef.current = null
      }, NO_HAND_CLEAR_MS)
    }
  }, [cancelClearTimer])

  const enterNeutralState = useCallback((clearSubtitleNow = false) => {
    candidateGestureRef.current = ''
    candidateStartedAtRef.current = 0
    lockedGestureRef.current = ''

    if (isActive && modelStatus === 'ready') {
      setAiState('listening')
    } else if (!isActive) {
      setAiState('idle')
    }

    clearLiveGesture(clearSubtitleNow)

    if (!neutralTimerRef.current) {
      neutralTimerRef.current = setTimeout(() => {
        neutralReadyRef.current = true
        neutralTimerRef.current = null
      }, NO_HAND_CLEAR_MS)
    }
  }, [cancelNeutralTimer, clearLiveGesture, isActive, modelStatus])

  const resetDetectionState = useCallback(() => {
    candidateGestureRef.current = ''
    candidateStartedAtRef.current = 0
    lockedGestureRef.current = ''
    lastCommittedGestureRef.current = ''
    lastCommittedAtRef.current = 0
    neutralReadyRef.current = true
    cancelClearTimer()
    cancelNeutralTimer()
  }, [cancelClearTimer, cancelNeutralTimer])

  useEffect(() => {
    if (!isActive) {
      setAiState('idle')
      clearLiveGesture(true)
      return
    }

    if (modelStatus === 'ready') {
      setAiState(prev => (prev === 'idle' ? 'listening' : prev))
      return
    }

    setAiState('idle')
  }, [clearLiveGesture, isActive, modelStatus])

  useEffect(() => {
    if (!voiceEnabled) {
      setVoiceStatus('muted')
      cancelSpeech()
      return
    }

    setVoiceStatus(speechSupported() ? 'ready' : 'unavailable')
  }, [voiceEnabled])

  useEffect(() => {
    if (!isActive || modelStatus !== 'ready') {
      return
    }

    const bestPrediction = predictions.reduce<{ label: string; confidence: number } | null>(
      (best, prediction) => {
        if (!best || prediction.confidence > best.confidence) {
          return prediction
        }
        return best
      },
      null,
    )

    const noHandsVisible = handsDetected === 0
    const belowThreshold = !bestPrediction || bestPrediction.confidence < CONFIDENCE_THRESHOLD
    const noGestureDetected = bestPrediction?.label === 'NoGesture'

    if (noHandsVisible || belowThreshold || noGestureDetected) {
      enterNeutralState(false)
      return
    }

    cancelClearTimer()
    cancelNeutralTimer()

    const label = bestPrediction.label
    const translation = PHRASE_MAP[label] ?? label
    const nextConfidence = Math.round(bestPrediction.confidence * 100)
    const now = Date.now()

    setCurrentGesture(label)
    setCurrentTranslation(translation)
    setConfidence(nextConfidence)

    if (candidateGestureRef.current !== label) {
      candidateGestureRef.current = label
      candidateStartedAtRef.current = now
      lockedGestureRef.current = ''
      setAiState('thinking')
      return
    }

    if (now - candidateStartedAtRef.current < GESTURE_LOCK_MS) {
      setAiState('thinking')
      return
    }

    setAiState('locked')

    if (lockedGestureRef.current === label) {
      return
    }

    lockedGestureRef.current = label

    if (!neutralReadyRef.current) {
      return
    }

    const isSameGestureAsLastCommit = lastCommittedGestureRef.current === label
    const cooldownActive = now - lastCommittedAtRef.current < SAME_GESTURE_COOLDOWN_MS
    if (isSameGestureAsLastCommit && cooldownActive) {
      neutralReadyRef.current = false
      return
    }

    neutralReadyRef.current = false
    lastCommittedGestureRef.current = label
    lastCommittedAtRef.current = now

    const entry: TranscriptEntry = {
      id: generateId(),
      timestamp: formatClockTimestamp(),
      gesture: label,
      translation,
    }

    setTranscript(prev => [...prev, entry].slice(-60))

    if (!voiceEnabled || voiceStatus === 'unavailable') {
      return
    }

    void speakText({
      text: translation,
      cooldownMs: SAME_GESTURE_COOLDOWN_MS,
      onStart: () => setVoiceStatus('speaking'),
      onEnd: () => setVoiceStatus('ready'),
      onError: () => setVoiceStatus(speechSupported() ? 'ready' : 'unavailable'),
    })
  }, [
    cancelClearTimer,
    cancelNeutralTimer,
    enterNeutralState,
    handsDetected,
    isActive,
    modelStatus,
    predictions,
    voiceEnabled,
    voiceStatus,
  ])

  const startSession = useCallback(() => {
    resetDetectionState()
    sessionIdRef.current = createSessionId()
    setCurrentGesture('')
    setCurrentTranslation('')
    setConfidence(0)
    setTranscript([])
    setIsActive(true)
    setAiState('idle')
  }, [resetDetectionState])

  const stopSession = useCallback(() => {
    setIsActive(false)
    setAiState('idle')
    clearLiveGesture(true)
    resetDetectionState()
    cancelSpeech()
  }, [clearLiveGesture, resetDetectionState])

  const demoReset = useCallback(() => {
    stopSession()
    sessionIdRef.current = createSessionId()
    setTranscript([])
  }, [stopSession])

  const toggleVoice = useCallback(() => {
    setVoiceEnabled(prev => !prev)
  }, [])

  const clearTranscript = useCallback(() => {
    setTranscript([])
  }, [])

  useEffect(() => () => {
    resetDetectionState()
    cancelSpeech()
  }, [resetDetectionState])

  const status: SystemStatus = {
    isActive,
    isListening: isActive && aiState === 'listening',
    isProcessing: aiState === 'thinking',
    confidence,
    currentGesture,
    currentTranslation,
    voiceEnabled,
    voiceStatus,
    language: 'UZB',
    aiState,
    modelReady: modelStatus === 'ready',
    sessionId: sessionIdRef.current,
  }

  return {
    status,
    transcript,
    startSession,
    stopSession,
    demoReset,
    toggleVoice,
    clearTranscript,
  }
}
