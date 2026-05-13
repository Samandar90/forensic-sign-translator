import type { ChatMessage } from '../../types'
import type { ForensicSession } from '../session/sessionTypes'
import { hydrateForensicSession } from '../session/sessionManager'
import { createSessionId } from '../../utils/session'
import type { WorkspaceEnvelopeV1 } from './appStorage'
import { readWorkspaceEnvelope } from './appStorage'
import { migratePersistenceIfNeeded } from './migration'
import { WORKSPACE_ENVELOPE_VERSION } from './keys'

export interface WorkspaceHydrationProps {
  readonly initialMessages: readonly ChatMessage[]
  readonly workspaceActive: boolean
  readonly workspaceSessionId: string
  readonly hadForensicSession: boolean
  /** True when non-default workspace data was applied from disk. */
  readonly restoredFromDisk: boolean
}

function isForensicSessionShape(v: unknown): v is ForensicSession {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.startedAt === 'number' &&
    Array.isArray(o.events) &&
    (o.endedAt === null || typeof o.endedAt === 'number')
  )
}

function sanitizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return []
  const out: ChatMessage[] = []
  for (const row of raw) {
    if (typeof row !== 'object' || row === null) continue
    const m = row as Record<string, unknown>
    if (m.role !== 'user' && m.role !== 'assistant') continue
    if (typeof m.id !== 'string' || typeof m.content !== 'string' || typeof m.ts !== 'number') continue
    out.push({
      id: m.id,
      role: m.role,
      content: m.content,
      emoji: typeof m.emoji === 'string' ? m.emoji : undefined,
      ts: m.ts,
      translation: typeof m.translation === 'string' ? m.translation : undefined,
      crossLang: typeof m.crossLang === 'string' ? m.crossLang : undefined,
      assistantTyping: typeof m.assistantTyping === 'boolean' ? m.assistantTyping : undefined,
      gestureBlock:
        m.gestureBlock !== null && typeof m.gestureBlock === 'object' && m.gestureBlock !== undefined
          ? (m.gestureBlock as ChatMessage['gestureBlock'])
          : undefined,
      recognitionConfidencePct:
        typeof m.recognitionConfidencePct === 'number' && m.recognitionConfidencePct >= 0 && m.recognitionConfidencePct <= 100
          ? Math.round(m.recognitionConfidencePct)
          : undefined,
    })
  }
  return out.slice(-40)
}

const EMPTY: WorkspaceHydrationProps = {
  initialMessages: [],
  workspaceActive: false,
  workspaceSessionId: '',
  hadForensicSession: false,
  restoredFromDisk: false,
}

/**
 * Synchronous bootstrap: run once before React mounts.
 * Applies forensic session into sessionManager and returns props for App/useSession.
 */
export function buildWorkspaceHydration(): WorkspaceHydrationProps {
  if (typeof window === 'undefined') return EMPTY

  migratePersistenceIfNeeded()
  const env = readWorkspaceEnvelope()
  if (!env) {
    hydrateForensicSession(null)
    return EMPTY
  }

  let forensic: ForensicSession | null = null
  if (env.forensicSession !== null && isForensicSessionShape(env.forensicSession)) {
    forensic = structuredClone(env.forensicSession) as ForensicSession
  }

  let messages = sanitizeMessages(env.chatMessages as unknown)
  if (messages.length > 0 && !forensic) {
    messages = []
  }

  hydrateForensicSession(forensic)

  const restoredFromDisk = forensic !== null || messages.length > 0 || env.workspaceActive

  return {
    initialMessages: messages,
    workspaceActive: env.workspaceActive,
    workspaceSessionId: env.workspaceSessionId.trim().length > 0 ? env.workspaceSessionId : createSessionId(),
    hadForensicSession: forensic !== null,
    restoredFromDisk,
  }
}

export function buildWorkspaceEnvelopeFromState(input: {
  readonly workspaceActive: boolean
  readonly workspaceSessionId: string
  readonly forensicSession: ForensicSession | null
  readonly chatMessages: readonly ChatMessage[]
}): WorkspaceEnvelopeV1 {
  return {
    v: WORKSPACE_ENVELOPE_VERSION,
    savedAt: Date.now(),
    workspaceActive: input.workspaceActive,
    workspaceSessionId: input.workspaceSessionId,
    forensicSession: input.forensicSession,
    chatMessages: input.chatMessages,
  }
}
