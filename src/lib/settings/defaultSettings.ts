import type { AppSettings } from './settingsTypes'

export const DEFAULT_APP_SETTINGS: AppSettings = {
  version: 1,
  general: {
    uiLang: 'uz',
    rememberSettings: true,
    animationsEnabled: true,
  },
  forensic: {
    autoSaveSession: true,
    exportIncludeDeviceDetails: true,
  },
  camera: {
    preferredQuality: 'HD',
    autoQuality: true,
    mirrorCamera: true,
    fullscreenDefault: false,
    overlayVisible: true,
    cleanViewDefault: false,
  },
  voice: {
    voiceEnabledDefault: true,
    speechLang: 'auto',
    speechRate: 0.91,
    speechVolume: 0.88,
    preferredVoiceId: '',
    muteDuplicatePhrases: false,
  },
  recognition: {
    gestureSensitivity: 'medium',
    confidenceThreshold: 78,
    smoothingLevel: 'medium',
    motionSensitivity: 'medium',
  },
  interface: {
    compactMode: false,
    comfortableSpacing: true,
    reducedAnimations: false,
    panelDensity: 'comfortable',
    cleanMode: false,
    presentationMode: false,
  },
  accessibility: {
    keyboardNavigationHints: true,
    highContrast: false,
    largerControls: false,
    reducedMotion: false,
    screenReaderEnhancedLabels: true,
  },
  advanced: {
    debugGestures: false,
    fpsOverlay: false,
    landmarkDebugOverlay: false,
  },
}
