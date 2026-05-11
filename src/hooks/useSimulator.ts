import { useCallback, useState } from 'react'
import type { SystemStatus, TranscriptEntry } from '../types'
import { createSessionId } from '../utils/session'

const INITIAL_STATUS: SystemStatus = {
  isActive: false,
  isListening: false,
  isProcessing: false,
  confidence: 0,
  currentGesture: '',
  currentTranslation: '',
  voiceEnabled: true,
  voiceStatus: 'ready',
  language: 'UZB',
  aiState: 'idle',
  modelReady: false,
  sessionId: createSessionId(),
}

export function useSimulator() {
  const [status, setStatus] = useState<SystemStatus>(INITIAL_STATUS)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])

  const startSession = useCallback(() => {
    setStatus(prev => ({
      ...prev,
      isActive: true,
      isListening: true,
      aiState: 'listening',
      modelReady: true,
      sessionId: createSessionId(),
    }))
    setTranscript([])
  }, [])

  const stopSession = useCallback(() => {
    setStatus(prev => ({
      ...prev,
      isActive: false,
      isListening: false,
      isProcessing: false,
      confidence: 0,
      currentGesture: '',
      currentTranslation: '',
      aiState: 'idle',
    }))
  }, [])

  const toggleVoice = useCallback(() => {
    setStatus(prev => ({
      ...prev,
      voiceEnabled: !prev.voiceEnabled,
      voiceStatus: prev.voiceEnabled ? 'muted' : 'ready',
    }))
  }, [])

  const clearTranscript = useCallback(() => {
    setTranscript([])
  }, [])

  const demoReset = useCallback(() => {
    setTranscript([])
    setStatus({
      ...INITIAL_STATUS,
      sessionId: createSessionId(),
    })
  }, [])

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
