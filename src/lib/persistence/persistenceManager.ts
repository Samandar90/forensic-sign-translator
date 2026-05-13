import type { ChatMessage } from '../../types'
import type { ForensicSession } from '../session/sessionTypes'
import { getCurrentForensicSession } from '../session/sessionManager'
import { buildWorkspaceEnvelopeFromState } from './hydration'
import { removeWorkspaceEnvelope, writeWorkspaceEnvelope } from './appStorage'

const DEBOUNCE_MS = 420

let debounceTimer: number | null = null

export function scheduleWorkspacePersistDebounced(): void {
  if (typeof window === 'undefined') return
  if (debounceTimer !== null) {
    window.clearTimeout(debounceTimer)
  }
  debounceTimer = window.setTimeout(() => {
    debounceTimer = null
    flushWorkspacePersistFromCurrent()
  }, DEBOUNCE_MS)
}

export function flushWorkspacePersistFromCurrent(): void {
  const forensicSession = getCurrentForensicSession()
  const env = buildWorkspaceEnvelopeFromState({
    workspaceActive: readWorkspaceActive(),
    workspaceSessionId: readWorkspaceSessionId(),
    forensicSession,
    chatMessages: readChatMessages(),
  })
  writeWorkspaceEnvelope(env)
}

let readWorkspaceActive: () => boolean = () => false
let readWorkspaceSessionId: () => string = () => ''
let readChatMessages: () => readonly ChatMessage[] = () => []

export function registerWorkspacePersistReaders(readers: {
  readonly readWorkspaceActive: () => boolean
  readonly readWorkspaceSessionId: () => string
  readonly readChatMessages: () => readonly ChatMessage[]
}): () => void {
  readWorkspaceActive = readers.readWorkspaceActive
  readWorkspaceSessionId = readers.readWorkspaceSessionId
  readChatMessages = readers.readChatMessages
  return () => {
    readWorkspaceActive = () => false
    readWorkspaceSessionId = () => ''
    readChatMessages = () => []
  }
}

export function flushWorkspacePersistExplicit(input: {
  readonly workspaceActive: boolean
  readonly workspaceSessionId: string
  readonly forensicSession: ForensicSession | null
  readonly chatMessages: readonly ChatMessage[]
}): void {
  writeWorkspaceEnvelope(buildWorkspaceEnvelopeFromState(input))
}

export function clearWorkspaceSnapshot(): void {
  removeWorkspaceEnvelope()
}

export function installWorkspaceBeforeUnload(flush: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (): void => {
    flush()
  }
  window.addEventListener('pagehide', handler)
  window.addEventListener('beforeunload', handler)
  return () => {
    window.removeEventListener('pagehide', handler)
    window.removeEventListener('beforeunload', handler)
  }
}
