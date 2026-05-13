import { DEFAULT_APP_SETTINGS } from './defaultSettings'
import { loadPersistedSettings, savePersistedSettings } from './settingsStorage'
import type { AppSettings, AppSettingsPatch } from './settingsTypes'

type Listener = () => void

const listeners = new Set<Listener>()

let state: AppSettings = loadPersistedSettings()

function notify(): void {
  for (const l of listeners) l()
}

function applyPatch(patch: AppSettingsPatch): AppSettings {
  const next: AppSettings = {
    ...state,
    general: patch.general ? { ...state.general, ...patch.general } : state.general,
    forensic: patch.forensic ? { ...state.forensic, ...patch.forensic } : state.forensic,
    camera: patch.camera ? { ...state.camera, ...patch.camera } : state.camera,
    voice: patch.voice ? { ...state.voice, ...patch.voice } : state.voice,
    recognition: patch.recognition ? { ...state.recognition, ...patch.recognition } : state.recognition,
    interface: patch.interface ? { ...state.interface, ...patch.interface } : state.interface,
    accessibility: patch.accessibility ? { ...state.accessibility, ...patch.accessibility } : state.accessibility,
    advanced: patch.advanced ? { ...state.advanced, ...patch.advanced } : state.advanced,
  }
  return next
}

export function getSettings(): AppSettings {
  return state
}

export function subscribeSettings(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function patchSettings(patch: AppSettingsPatch): AppSettings {
  state = applyPatch(patch)
  savePersistedSettings(state)
  notify()
  return state
}

export function resetSettings(): AppSettings {
  state = structuredClone(DEFAULT_APP_SETTINGS)
  savePersistedSettings(state)
  notify()
  return state
}

export function hydrateSettingsFromStorage(): AppSettings {
  state = loadPersistedSettings()
  notify()
  return state
}
