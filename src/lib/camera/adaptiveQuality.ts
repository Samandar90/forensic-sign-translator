/** Preset order: highest → lowest resolution class. */
export type VideoQualityPreset = 'FHD' | 'HD' | 'SD'

/** UI tier for status bar (mapped from preset / measured resolution). */
export type VideoQualityTier = 'high' | 'medium' | 'low'

export function presetToTier(preset: VideoQualityPreset): VideoQualityTier {
  if (preset === 'FHD') return 'high'
  if (preset === 'HD') return 'medium'
  return 'low'
}

export const QUALITY_PRESETS: Record<VideoQualityPreset, MediaTrackConstraints> = {
  FHD: {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 30, max: 30 },
    facingMode: 'user',
  },
  HD: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 },
    facingMode: 'user',
  },
  SD: {
    width: { ideal: 640 },
    height: { ideal: 480 },
    frameRate: { ideal: 30, max: 30 },
    facingMode: 'user',
  },
}

const ORDER: readonly VideoQualityPreset[] = ['FHD', 'HD', 'SD']

function indexOf(preset: VideoQualityPreset): number {
  return ORDER.indexOf(preset)
}

function clampDown(preset: VideoQualityPreset): VideoQualityPreset {
  const i = indexOf(preset)
  if (i < 0 || i >= ORDER.length - 1) return 'SD'
  return ORDER[i + 1] as VideoQualityPreset
}

function clampUp(preset: VideoQualityPreset): VideoQualityPreset {
  const i = indexOf(preset)
  if (i <= 0) return 'FHD'
  return ORDER[i - 1] as VideoQualityPreset
}

export interface AdaptiveStepResult {
  readonly nextPreset: VideoQualityPreset
  readonly didDowngrade: boolean
  readonly didUpgrade: boolean
}

/**
 * Hysteresis on measured **camera preview** FPS (not detection FPS).
 * - Below 18 FPS: step one tier down (1080→720, 720→480).
 * - Below 12 FPS: force at least one step down when already applied once in same window — handled by caller calling repeatedly; we step one level per decision until stable.
 * - Above 26 FPS sustained: step one tier up (max FHD).
 */
export function createAdaptiveQualityController(initial: VideoQualityPreset = 'HD') {
  let preset: VideoQualityPreset = initial
  let below18Streak = 0
  let below12Streak = 0
  let above26Streak = 0

  return {
    getPreset(): VideoQualityPreset {
      return preset
    },
    setPreset(p: VideoQualityPreset): void {
      preset = p
      below18Streak = 0
      below12Streak = 0
      above26Streak = 0
    },
    /** Call ~1 Hz with smoothed camera FPS. */
    evaluate(cameraFps: number): AdaptiveStepResult {
      if (!Number.isFinite(cameraFps) || cameraFps <= 0) {
        return { nextPreset: preset, didDowngrade: false, didUpgrade: false }
      }

      let next = preset
      let didDowngrade = false
      let didUpgrade = false

      if (cameraFps < 12) {
        below12Streak += 1
        below18Streak = 0
        above26Streak = 0
        if (below12Streak >= 2 && preset !== 'SD') {
          next = clampDown(preset)
          if (next !== preset) {
            preset = next
            didDowngrade = true
          }
          below12Streak = 0
        }
      } else if (cameraFps < 18) {
        below18Streak += 1
        below12Streak = 0
        above26Streak = 0
        if (below18Streak >= 2 && preset !== 'SD') {
          next = clampDown(preset)
          if (next !== preset) {
            preset = next
            didDowngrade = true
          }
          below18Streak = 0
        }
      } else {
        below12Streak = 0
        below18Streak = 0
      }

      if (cameraFps >= 26 && preset !== 'FHD') {
        above26Streak += 1
        if (above26Streak >= 5) {
          next = clampUp(preset)
          if (next !== preset) {
            preset = next
            didUpgrade = true
          }
          above26Streak = 0
        }
      } else {
        above26Streak = 0
      }

      return { nextPreset: preset, didDowngrade, didUpgrade }
    },
  }
}
