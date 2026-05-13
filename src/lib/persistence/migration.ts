import { STORAGE_KEYS, WORKSPACE_ENVELOPE_VERSION } from './keys'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Future migrations: bump envelope version and rewrite keys here.
 * Currently no legacy workspace format existed before v1.
 */
export function migratePersistenceIfNeeded(): void {
  if (typeof localStorage === 'undefined') return
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FORENSIC_WORKSPACE)
    if (!raw) return
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) {
      localStorage.removeItem(STORAGE_KEYS.FORENSIC_WORKSPACE)
      return
    }
    const v = parsed.v
    if (typeof v !== 'number' || v < 1 || v > WORKSPACE_ENVELOPE_VERSION) {
      localStorage.removeItem(STORAGE_KEYS.FORENSIC_WORKSPACE)
    }
  } catch {
    localStorage.removeItem(STORAGE_KEYS.FORENSIC_WORKSPACE)
  }
}
