export interface TranscriptEntry {
  id: string
  timestamp: string
  gesture: string
  translation: string
  confidence: number
  language: string
}

export type LanguageMode = 'USL' | 'UZB' | 'RUS'

export type AIState = 'idle' | 'loading' | 'listening' | 'thinking' | 'locked'

export interface SystemStatus {
  isActive: boolean
  isListening: boolean
  isProcessing: boolean
  confidence: number
  currentGesture: string
  currentTranslation: string
  voiceEnabled: boolean
  language: LanguageMode
  aiState: AIState
  modelReady: boolean
}
