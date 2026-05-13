import { useCallback, useEffect, useState } from 'react'
import { cancelSpeech } from '../utils/speech'
import { createSessionId } from '../utils/session'

import { getSettings } from '../lib/settings/settingsManager'

export interface UseSessionOptions {
  readonly initialSessionId?: string
  readonly initialWorkspaceActive?: boolean
}

export function useSession(opts?: UseSessionOptions) {
  const [isActive, setIsActive] = useState(() => opts?.initialWorkspaceActive ?? false)
  const [voiceEnabled, setVoiceEnabled] = useState(() => getSettings().voice.voiceEnabledDefault)
  const [sessionId, setSessionId] = useState(() => {
    const s = opts?.initialSessionId
    return s && s.length > 0 ? s : createSessionId()
  })

  const startSession = useCallback((): string => {
    const id = createSessionId()
    setSessionId(id)
    setIsActive(true)
    return id
  }, [])

  const startSessionWithExistingId = useCallback((id: string) => {
    setSessionId(id)
    setIsActive(true)
    return id
  }, [])

  const stopSession = useCallback(() => {
    setIsActive(false)
    cancelSpeech()
  }, [])

  useEffect(() => () => cancelSpeech(), [])

  const toggleVoice = useCallback(() => {
    setVoiceEnabled(v => !v)
  }, [])

  const setVoiceEnabledExplicit = useCallback((next: boolean) => {
    setVoiceEnabled(next)
  }, [])

  const applySessionId = useCallback((id: string) => {
    setSessionId(id)
  }, [])

  return {
    isActive,
    voiceEnabled,
    sessionId,
    startSession,
    startSessionWithExistingId,
    stopSession,
    toggleVoice,
    setVoiceEnabled: setVoiceEnabledExplicit,
    applySessionId,
  }
}
