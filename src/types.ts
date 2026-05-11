export type AIState = 'idle' | 'listening' | 'thinking' | 'locked'

export type LanguageMode = 'UZB'

export type VoiceStatus = 'muted' | 'ready' | 'speaking' | 'unavailable'

export interface TranscriptEntry {
  id: string
  timestamp: string
  gesture: string
  translation: string
}

export interface SystemStatus {
  isActive: boolean
  isListening: boolean
  isProcessing: boolean
  confidence: number
  currentGesture: string
  currentTranslation: string
  voiceEnabled: boolean
  voiceStatus: VoiceStatus
  language: LanguageMode
  aiState: AIState
  modelReady: boolean
  sessionId: string
}
