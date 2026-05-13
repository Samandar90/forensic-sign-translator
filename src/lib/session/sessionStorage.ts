import type { ForensicSession } from './sessionTypes'
import { getSettings, patchSettings } from '../settings/settingsManager'
import { STORAGE_KEYS } from '../persistence/keys'

export interface ForensicUserPrefs {
  readonly autoSaveSession: boolean
  readonly exportIncludeDeviceDetails: boolean
}

export interface StoredSessionSummary {
  readonly id: string
  readonly startedAt: number
  readonly endedAt: number | null
  readonly uiLang: ForensicSession['uiLang']
  readonly eventCount: number
  readonly gestureCount: number
}

function parseHistory(raw: string | null): ForensicSession[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw) as unknown
    if (!Array.isArray(v)) return []
    return v.filter((x): x is ForensicSession => x !== null && typeof x === 'object' && 'id' in x && 'events' in x)
  } catch {
    return []
  }
}

export function clearStoredSessionHistory(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEYS.FORENSIC_SESSION_HISTORY)
  } catch {
    /* noop */
  }
}

export function loadPrefs(): ForensicUserPrefs {
  return getSettings().forensic
}

export function savePrefs(next: Partial<ForensicUserPrefs>): ForensicUserPrefs {
  const cur = getSettings().forensic
  const merged: ForensicUserPrefs = { ...cur, ...next }
  patchSettings({ forensic: merged })
  return merged
}

function summarize(s: ForensicSession): StoredSessionSummary {
  const gestures = s.events.filter(e => e.kind === 'gesture_log').length
  return {
    id: s.id,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    uiLang: s.uiLang,
    eventCount: s.events.length,
    gestureCount: gestures,
  }
}

export function listStoredSessions(): readonly ForensicSession[] {
  if (typeof localStorage === 'undefined') return []
  return parseHistory(localStorage.getItem(STORAGE_KEYS.FORENSIC_SESSION_HISTORY)).slice(0, 10)
}

export function listStoredSessionSummaries(): readonly StoredSessionSummary[] {
  return listStoredSessions().map(summarize)
}

export function pushSessionToHistory(session: ForensicSession, maxItems = 10): void {
  if (typeof localStorage === 'undefined') return
  const prev = parseHistory(localStorage.getItem(STORAGE_KEYS.FORENSIC_SESSION_HISTORY))
  const next = [session, ...prev.filter(s => s.id !== session.id)].slice(0, maxItems)
  localStorage.setItem(STORAGE_KEYS.FORENSIC_SESSION_HISTORY, JSON.stringify(next))
}

export function getStoredSessionById(id: string): ForensicSession | null {
  return listStoredSessions().find(s => s.id === id) ?? null
}
