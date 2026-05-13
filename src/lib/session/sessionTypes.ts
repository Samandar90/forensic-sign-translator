import type { AdvancedGestureId } from '../gestures/gestureTypes'
import type { Lang } from '../../i18n'

export const FORENSIC_SESSION_SCHEMA_VERSION = 1 as const

export type ForensicHandLabel = 'Left' | 'Right' | 'Both' | 'Unknown'

/** Future replay: immutable event stream + layout hints (not implemented). */
export interface ForensicReplayStub {
  readonly supported: false
  readonly notes: 'Replay requires future media sync pipeline.'
}

export interface ForensicDeviceInfo {
  readonly userAgent: string
  readonly platform: string
  readonly language: string
  readonly hardwareConcurrency: number
}

export interface ForensicCameraSettings {
  readonly qualityPreset: string
}

export interface ForensicGestureLogEvent {
  readonly kind: 'gesture_log'
  readonly id: string
  readonly ts: number
  readonly tsLast: number
  readonly signature: string
  readonly gestureId: AdvancedGestureId
  readonly emoji: string
  readonly gestureLabel: string
  readonly translationPrimary: string
  readonly translationSecondary: string | null
  readonly confidencePct: number
  readonly handLabel: ForensicHandLabel
  readonly repeatCount: number
}

export interface TranslationEvent {
  readonly kind: 'translation'
  readonly id: string
  readonly ts: number
  readonly uiLang: Lang
  readonly text: string
  readonly companion: string | null
  readonly gestureId: AdvancedGestureId | null
}

export interface VoiceEvent {
  readonly kind: 'voice'
  readonly id: string
  readonly ts: number
  readonly phase: 'playback_start' | 'playback_end'
  readonly assistantMessageId: string | null
  readonly textSnippet: string | null
}

export interface SystemEvent {
  readonly kind: 'system'
  readonly id: string
  readonly ts: number
  readonly code: 'session_start' | 'session_end' | 'chat_cleared'
}

export type SessionEvent = ForensicGestureLogEvent | TranslationEvent | VoiceEvent | SystemEvent

export type GestureEvent = ForensicGestureLogEvent

export interface ForensicSession {
  readonly schemaVersion: typeof FORENSIC_SESSION_SCHEMA_VERSION
  readonly id: string
  readonly startedAt: number
  readonly endedAt: number | null
  readonly uiLang: Lang
  readonly camera: ForensicCameraSettings
  readonly device: ForensicDeviceInfo
  readonly events: SessionEvent[]
  readonly stats: {
    readonly detectionFpsAvg: number
    readonly detectionFpsSampleCount: number
  }
  readonly replay: ForensicReplayStub
}

export interface ForensicSessionStartParams {
  readonly id: string
  readonly uiLang: Lang
  readonly camera: ForensicCameraSettings
  readonly device: ForensicDeviceInfo
}

export interface ForensicGestureRecordInput {
  readonly ts: number
  readonly signature: string
  readonly gestureId: AdvancedGestureId
  readonly emoji: string
  readonly gestureLabel: string
  readonly translationPrimary: string
  readonly translationSecondary: string | null
  readonly confidencePct: number
  readonly handLabel: ForensicHandLabel
}
