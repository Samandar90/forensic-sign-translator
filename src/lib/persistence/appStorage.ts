import type { ChatMessage } from '../../types'
import type { ForensicSession } from '../session/sessionTypes'
import { STORAGE_KEYS, WORKSPACE_ENVELOPE_VERSION } from './keys'

export interface WorkspaceEnvelopeV1 {
  readonly v: typeof WORKSPACE_ENVELOPE_VERSION
  readonly savedAt: number
  readonly workspaceActive: boolean
  readonly workspaceSessionId: string
  readonly forensicSession: ForensicSession | null
  readonly chatMessages: readonly ChatMessage[]
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function readWorkspaceEnvelope(): WorkspaceEnvelopeV1 | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FORENSIC_WORKSPACE)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) return null
    if (parsed.v !== WORKSPACE_ENVELOPE_VERSION) return null
    if (typeof parsed.savedAt !== 'number') return null
    if (typeof parsed.workspaceActive !== 'boolean') return null
    if (typeof parsed.workspaceSessionId !== 'string') return null
    if (parsed.forensicSession !== null && !isRecord(parsed.forensicSession)) return null
    if (!Array.isArray(parsed.chatMessages)) return null
    return parsed as unknown as WorkspaceEnvelopeV1
  } catch {
    return null
  }
}

export function writeWorkspaceEnvelope(env: WorkspaceEnvelopeV1): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEYS.FORENSIC_WORKSPACE, JSON.stringify(env))
  } catch {
    /* quota / private mode */
  }
}

export function removeWorkspaceEnvelope(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEYS.FORENSIC_WORKSPACE)
  } catch {
    /* noop */
  }
}

export function readSessionHistoryRaw(): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(STORAGE_KEYS.FORENSIC_SESSION_HISTORY)
}

export function clearSessionHistoryStorage(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEYS.FORENSIC_SESSION_HISTORY)
  } catch {
    /* noop */
  }
}
