import type { Lang } from '../../i18n'
import type { VideoQualityPreset } from '../camera/adaptiveQuality'

export type SettingsSectionId =
  | 'general'
  | 'data'
  | 'camera'
  | 'voice'
  | 'recognition'
  | 'interface'
  | 'accessibility'
  | 'advanced'

export type TriLevel = 'low' | 'medium' | 'high'

export type PanelDensity = 'comfortable' | 'compact'

export type SpeechLangMode = 'auto' | 'ru' | 'uz'

/** Forensic / export preferences (also exposed via sessionStorage helpers). */
export interface ForensicSettingsSlice {
  readonly autoSaveSession: boolean
  readonly exportIncludeDeviceDetails: boolean
}

export interface GeneralSettings {
  readonly uiLang: Lang
  readonly rememberSettings: boolean
  readonly animationsEnabled: boolean
}

export interface CameraSettings {
  readonly preferredQuality: VideoQualityPreset
  readonly autoQuality: boolean
  readonly mirrorCamera: boolean
  readonly fullscreenDefault: boolean
  readonly overlayVisible: boolean
  readonly cleanViewDefault: boolean
}

export interface VoiceSettings {
  readonly voiceEnabledDefault: boolean
  readonly speechLang: SpeechLangMode
  readonly speechRate: number
  readonly speechVolume: number
  /** Optional engine voice URI/name; empty = auto */
  readonly preferredVoiceId: string
  readonly muteDuplicatePhrases: boolean
}

export interface RecognitionSettings {
  readonly gestureSensitivity: TriLevel
  /** 0–100 UI scale; mapped to internal thresholds */
  readonly confidenceThreshold: number
  readonly smoothingLevel: TriLevel
  readonly motionSensitivity: TriLevel
}

export interface InterfaceSettings {
  readonly compactMode: boolean
  readonly comfortableSpacing: boolean
  readonly reducedAnimations: boolean
  readonly panelDensity: PanelDensity
  readonly cleanMode: boolean
  readonly presentationMode: boolean
}

export interface AccessibilitySettings {
  readonly keyboardNavigationHints: boolean
  readonly highContrast: boolean
  readonly largerControls: boolean
  readonly reducedMotion: boolean
  readonly screenReaderEnhancedLabels: boolean
}

export interface AdvancedDevSettings {
  readonly debugGestures: boolean
  readonly fpsOverlay: boolean
  readonly landmarkDebugOverlay: boolean
}

export interface AppSettings {
  readonly version: 1
  readonly general: GeneralSettings
  readonly forensic: ForensicSettingsSlice
  readonly camera: CameraSettings
  readonly voice: VoiceSettings
  readonly recognition: RecognitionSettings
  readonly interface: InterfaceSettings
  readonly accessibility: AccessibilitySettings
  readonly advanced: AdvancedDevSettings
}

export type AppSettingsPatch = {
  readonly general?: Partial<GeneralSettings>
  readonly forensic?: Partial<ForensicSettingsSlice>
  readonly camera?: Partial<CameraSettings>
  readonly voice?: Partial<VoiceSettings>
  readonly recognition?: Partial<RecognitionSettings>
  readonly interface?: Partial<InterfaceSettings>
  readonly accessibility?: Partial<AccessibilitySettings>
  readonly advanced?: Partial<AdvancedDevSettings>
}
