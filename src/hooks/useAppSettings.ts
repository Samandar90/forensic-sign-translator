import { useCallback, useSyncExternalStore } from 'react'
import { getSettings, patchSettings, subscribeSettings } from '../lib/settings/settingsManager'
import type { AppSettingsPatch } from '../lib/settings/settingsTypes'

export function useAppSettings() {
  const snapshot = useSyncExternalStore(subscribeSettings, getSettings, getSettings)
  const patch = useCallback((p: AppSettingsPatch) => {
    patchSettings(p)
  }, [])
  return { settings: snapshot, patch }
}
