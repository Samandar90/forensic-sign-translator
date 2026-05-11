import { useState, useRef, useCallback, useEffect } from 'react'
import type { TranscriptEntry, AIState, SystemStatus } from '../types'
import { useTMClassifier } from './useTMClassifier'

// ── Recognition constants (as specified) ─────────────────────────────────────
const CONFIDENCE_THRESHOLD    = 0.85   // below this → treat as NoGesture
const STABLE_LOCK_MS          = 900    // gesture must hold this long to lock
const CLEAR_WHEN_NO_HAND_MS   = 800    // delay before wiping subtitle on no-gesture
const SAME_GESTURE_COOLDOWN_MS = 5000  // min ms before same gesture re-adds
const NEUTRAL_REQUIRED_MS     = 700    // how long neutral must hold before reset
// PREDICTION_INTERVAL_MS is set in useTMClassifier (200ms)

// ── Phrase map ────────────────────────────────────────────────────────────────
const PHRASE_MAP: Record<string, string> = {
  Help: "Menga yordam kerak",
  Stop: "To'xtang",
  Yes:  "Ha",
  No:   "Yo'q",
}

// ── Gesture state phase ───────────────────────────────────────────────────────
type GesturePhase = 'SCANNING' | 'CANDIDATE' | 'LOCKED'

// ── Speech synthesis ──────────────────────────────────────────────────────────
function getBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const priority = ['uz', 'ru', 'tr', 'en']
  for (const lang of priority) {
    const local = voices.find(v => v.lang.toLowerCase().includes(lang) && v.localService)
    if (local) return local
    const any = voices.find(v => v.lang.toLowerCase().includes(lang))
    if (any) return any
  }
  return voices[0] ?? null
}

function speakText(text: string) {
  if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()

  const doSpeak = () => {
    const utt    = new SpeechSynthesisUtterance(text)
    const voices = window.speechSynthesis.getVoices()
    const voice  = getBestVoice(voices)
    if (voice) utt.voice = voice
    utt.rate   = 0.85
    utt.pitch  = 0.95
    utt.volume = 1
    window.speechSynthesis.speak(utt)
  }

  if (window.speechSynthesis.getVoices().length > 0) {
    doSpeak()
  } else {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null
      doSpeak()
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

function formatTimestamp() {
  const d = new Date()
  return d.toLocaleTimeString('en-GB', { hour12: false })
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useGestureEngine(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  handsDetected: number,
) {
  const [isActive,      setIsActive]      = useState(false)
  const [voiceEnabled,  setVoiceEnabled]  = useState(true)

  // Display state
  const [aiState,            setAiState]            = useState<AIState>('idle')
  const [currentGesture,     setCurrentGesture]     = useState('')
  const [currentTranslation, setCurrentTranslation] = useState('')
  const [confidence,         setConfidence]         = useState(0)
  const [transcript,         setTranscript]         = useState<TranscriptEntry[]>([])

  // Phase machine refs (no re-render needed)
  const phaseRef              = useRef<GesturePhase>('SCANNING')
  const candidateGestureRef   = useRef('')
  const candidateStartRef     = useRef(0)
  const hasReturnedToNeutral  = useRef(true)    // must go neutral before re-locking same gesture
  const lastAddedGestureRef   = useRef('')
  const lastAddedTimeRef      = useRef(0)
  const lastSpokenPhraseRef   = useRef('')
  const lastSpokenTimeRef     = useRef(0)

  // Timers
  const clearTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const neutralTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { modelStatus, predictions } = useTMClassifier(videoRef, isActive)

  // ── Map model loading state → aiState ──────────────────────────────────────
  useEffect(() => {
    if (!isActive)                setAiState('idle')
    else if (modelStatus === 'loading') setAiState('loading')
    else if (modelStatus === 'error')   setAiState('idle')
  }, [isActive, modelStatus])

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const cancelClearTimer = () => {
    if (clearTimerRef.current) { clearTimeout(clearTimerRef.current); clearTimerRef.current = null }
  }
  const cancelNeutralTimer = () => {
    if (neutralTimerRef.current) { clearTimeout(neutralTimerRef.current); neutralTimerRef.current = null }
  }

  const enterScanning = useCallback(() => {
    phaseRef.current         = 'SCANNING'
    candidateGestureRef.current = ''
    candidateStartRef.current   = 0
    setAiState('listening')

    // Schedule display clear after CLEAR_WHEN_NO_HAND_MS
    cancelClearTimer()
    clearTimerRef.current = setTimeout(() => {
      setCurrentGesture('')
      setCurrentTranslation('')
      setConfidence(0)
      clearTimerRef.current = null
    }, CLEAR_WHEN_NO_HAND_MS)

    // Mark as returned to neutral after NEUTRAL_REQUIRED_MS
    cancelNeutralTimer()
    if (!hasReturnedToNeutral.current) {
      neutralTimerRef.current = setTimeout(() => {
        hasReturnedToNeutral.current = true
        neutralTimerRef.current = null
      }, NEUTRAL_REQUIRED_MS)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Main prediction effect ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive || modelStatus !== 'ready' || predictions.length === 0) return

    const top = predictions.reduce((best, p) =>
      p.confidence > best.confidence ? p : best,
    )

    const isNoGesture = (
      top.label === 'NoGesture' ||
      top.confidence < CONFIDENCE_THRESHOLD ||
      handsDetected === 0
    )

    // ── NO GESTURE / NO HANDS ─────────────────────────────────────────
    if (isNoGesture) {
      if (phaseRef.current !== 'SCANNING') {
        enterScanning()
      }
      return
    }

    // ── REAL GESTURE DETECTED ─────────────────────────────────────────
    cancelClearTimer()
    cancelNeutralTimer()

    const label       = top.label
    const translation = PHRASE_MAP[label] ?? label
    const pct         = Math.round(top.confidence * 100)

    // If the gesture changed, reset candidate tracking
    if (candidateGestureRef.current !== label) {
      candidateGestureRef.current = label
      candidateStartRef.current   = Date.now()
      phaseRef.current = 'CANDIDATE'
      setAiState('thinking')
    }

    // Always update live display
    setCurrentGesture(label)
    setCurrentTranslation(translation)
    setConfidence(pct)

    // Check stability duration
    const elapsed = Date.now() - candidateStartRef.current

    if (elapsed < STABLE_LOCK_MS) {
      // Still building stability
      setAiState('thinking')
      return
    }

    // ── STABLE — try to lock ──────────────────────────────────────────
    phaseRef.current = 'LOCKED'
    setAiState('locked')

    // Only add to transcript if user has returned to neutral since last entry
    if (!hasReturnedToNeutral.current) return

    const now             = Date.now()
    const isNewGesture    = label !== lastAddedGestureRef.current
    const cooldownExpired = now - lastAddedTimeRef.current > SAME_GESTURE_COOLDOWN_MS

    if (!isNewGesture && !cooldownExpired) return

    // ── COMMIT entry ──────────────────────────────────────────────────
    hasReturnedToNeutral.current = false
    lastAddedGestureRef.current  = label
    lastAddedTimeRef.current     = now

    const entry: TranscriptEntry = {
      id:          generateId(),
      timestamp:   formatTimestamp(),
      gesture:     label,
      translation,
      confidence:  pct,
      language:    'UZB',
    }
    setTranscript(prev => [entry, ...prev].slice(0, 60))

    // ── SPEECH ────────────────────────────────────────────────────────
    const speechCooldownOk = now - lastSpokenTimeRef.current > SAME_GESTURE_COOLDOWN_MS
    if (voiceEnabled && (translation !== lastSpokenPhraseRef.current || speechCooldownOk)) {
      lastSpokenPhraseRef.current = translation
      lastSpokenTimeRef.current   = now
      speakText(translation)
    }
  }, [predictions, isActive, modelStatus, handsDetected, voiceEnabled, enterScanning])

  // ── Session controls ────────────────────────────────────────────────────────
  const startSession = useCallback(() => {
    phaseRef.current             = 'SCANNING'
    candidateGestureRef.current  = ''
    candidateStartRef.current    = 0
    hasReturnedToNeutral.current = true
    lastAddedGestureRef.current  = ''
    lastAddedTimeRef.current     = 0
    lastSpokenPhraseRef.current  = ''
    lastSpokenTimeRef.current    = 0
    setCurrentGesture('')
    setCurrentTranslation('')
    setConfidence(0)
    setIsActive(true)
  }, [])

  const stopSession = useCallback(() => {
    setIsActive(false)
    setAiState('idle')
    setCurrentGesture('')
    setCurrentTranslation('')
    setConfidence(0)
    cancelClearTimer()
    cancelNeutralTimer()
    window.speechSynthesis?.cancel()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const demoReset = useCallback(() => {
    stopSession()
    setTranscript([])
    lastAddedGestureRef.current  = ''
    lastSpokenPhraseRef.current  = ''
    hasReturnedToNeutral.current = true
  }, [stopSession])

  const toggleVoice    = useCallback(() => setVoiceEnabled(v => !v), [])

  const clearTranscript = useCallback(() => {
    setTranscript([])
    lastAddedGestureRef.current  = ''
    lastSpokenPhraseRef.current  = ''
    hasReturnedToNeutral.current = true
    setCurrentGesture('')
    setCurrentTranslation('')
    setConfidence(0)
  }, [])

  useEffect(() => () => {
    cancelClearTimer()
    cancelNeutralTimer()
    window.speechSynthesis?.cancel()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── SystemStatus ────────────────────────────────────────────────────────────
  const status: SystemStatus = {
    isActive,
    isListening:  isActive && aiState !== 'idle' && aiState !== 'loading',
    isProcessing: aiState === 'thinking',
    confidence,
    currentGesture,
    currentTranslation,
    voiceEnabled,
    language:   'UZB',
    aiState,
    modelReady: modelStatus === 'ready',
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
