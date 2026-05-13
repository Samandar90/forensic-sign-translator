import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  appendGroupedGesture,
  appendVoiceEvent,
  clearRecognitionLog as clearSessionRecognitionLog,
  endForensicSession,
  getCurrentForensicSession,
  recordDetectionFpsSample,
  startForensicSession,
  subscribeSessionManager,
} from '../lib/session/sessionManager'
import type { ForensicGestureRecordInput, ForensicSession, ForensicSessionStartParams } from '../lib/session/sessionTypes'

export function useForensicSession() {
  const [session, setSession] = useState<ForensicSession | null>(() => getCurrentForensicSession())

  useEffect(() => subscribeSessionManager(() => setSession(getCurrentForensicSession())), [])

  const start = useCallback((params: ForensicSessionStartParams) => {
    startForensicSession(params)
  }, [])

  const end = useCallback(() => endForensicSession(), [])

  const clearRecognitionLog = useCallback(() => {
    clearSessionRecognitionLog()
  }, [])

  const appendGesture = useCallback((input: ForensicGestureRecordInput) => {
    appendGroupedGesture(input)
  }, [])

  const logVoice = useCallback((ev: Parameters<typeof appendVoiceEvent>[0]) => {
    appendVoiceEvent(ev)
  }, [])

  const sampleFps = useCallback((fps: number) => {
    recordDetectionFpsSample(fps)
  }, [])

  return useMemo(
    () => ({
      session,
      startForensicSession: start,
      endForensicSession: end,
      clearRecognitionLog,
      appendGesture,
      logVoice,
      sampleFps,
    }),
    [session, start, end, clearRecognitionLog, appendGesture, logVoice, sampleFps],
  )
}
