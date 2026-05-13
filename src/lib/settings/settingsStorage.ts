import { DEFAULT_APP_SETTINGS } from './defaultSettings'
import type { AppSettings } from './settingsTypes'
import { STORAGE_KEYS } from '../persistence/keys'

export const APP_SETTINGS_STORAGE_KEY = STORAGE_KEYS.FORENSIC_APP_SETTINGS

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function mergeDeep<T extends Record<string, unknown>>(base: T, patch: unknown): T {
  if (!isRecord(patch)) return base
  const out: Record<string, unknown> = { ...base }
  for (const k of Object.keys(patch)) {
    const pv = patch[k]
    const bv = base[k as keyof T]
    if (isRecord(pv) && isRecord(bv as unknown)) {
      out[k] = mergeDeep(bv as Record<string, unknown>, pv)
    } else {
      out[k] = pv
    }
  }
  return out as T
}

function readLegacyForensic(): Partial<AppSettings['forensic']> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FORENSIC_PREFS_LEGACY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) return null
    return {
      autoSaveSession: typeof parsed.autoSaveSession === 'boolean' ? parsed.autoSaveSession : undefined,
      exportIncludeDeviceDetails:
        typeof parsed.exportIncludeDeviceDetails === 'boolean' ? parsed.exportIncludeDeviceDetails : undefined,
    }
  } catch {
    return null
  }
}

export function loadPersistedSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(APP_SETTINGS_STORAGE_KEY)
    let merged: AppSettings = structuredClone(DEFAULT_APP_SETTINGS)
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (isRecord(parsed)) {
        merged = mergeDeep(merged as unknown as Record<string, unknown>, parsed) as unknown as AppSettings
      }
    } else {
      const legacy = readLegacyForensic()
      if (legacy) {
        merged = {
          ...merged,
          forensic: { ...merged.forensic, ...legacy },
        }
      }
    }
    return merged
  } catch {
    return structuredClone(DEFAULT_APP_SETTINGS)
  }
}

export function savePersistedSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
    localStorage.setItem(
      STORAGE_KEYS.FORENSIC_PREFS_LEGACY,
      JSON.stringify({
        autoSaveSession: settings.forensic.autoSaveSession,
        exportIncludeDeviceDetails: settings.forensic.exportIncludeDeviceDetails,
      }),
    )
  } catch {
    // ignore quota / private mode
  }
}
