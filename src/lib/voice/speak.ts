import type { Lang } from '../../i18n'
import type { SpeechLangMode } from '../settings/settingsTypes'
import { cancelSpeech } from '../../utils/speech'
import { selectBestVoice } from './selectBestVoice'

function getEngine() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  return window.speechSynthesis
}

function normalizeLang(lang: string) {
  return lang.toLowerCase().replace('_', '-')
}

/** Prefer Uzbek (uz, uzb), then Russian, then first available. */
export function pickVoiceForUzbekFirst(): SpeechSynthesisVoice | null {
  const engine = getEngine()
  if (!engine) return null
  const voices = engine.getVoices()
  if (!voices.length) return null

  const uz = voices.find(v => {
    const l = normalizeLang(v.lang)
    return l === 'uz-uz' || l === 'uz-latn-uz' || l === 'uz-cyrl-uz' || l.startsWith('uz') || l.includes('uzb')
  })
  if (uz) return uz

  const ru = voices.find(v => normalizeLang(v.lang).startsWith('ru'))
  if (ru) return ru

  return voices[0] ?? null
}

let voicesReady: Promise<void> | null = null

function ensureVoicesLoaded(): Promise<void> {
  const engine = getEngine()
  if (!engine) return Promise.resolve()

  if (engine.getVoices().length > 0) return Promise.resolve()

  if (!voicesReady) {
    voicesReady = new Promise(resolve => {
      const done = () => {
        engine.removeEventListener('voiceschanged', done)
        resolve()
      }
      engine.addEventListener('voiceschanged', done)
      window.setTimeout(() => {
        engine.removeEventListener('voiceschanged', done)
        resolve()
      }, 1500)
    })
  }
  return voicesReady
}

function voiceLangForMode(uiLang: Lang, mode: SpeechLangMode | undefined): Lang {
  if (mode === 'ru' || mode === 'uz') return mode
  return uiLang
}

export interface SpeakAssistantOptions {
  readonly onStart?: () => void
  readonly onEnd?: () => void
  readonly rate?: number
  readonly volume?: number
  readonly speechLang?: SpeechLangMode
  readonly preferredVoiceId?: string
}

/** Calm assistant-style speech with language-aware voice selection. */
export async function speakAssistant(
  text: string,
  lang: Lang,
  options?: SpeakAssistantOptions,
): Promise<boolean> {
  const engine = getEngine()
  const trimmed = text.trim()
  if (!engine || !trimmed) return false

  await ensureVoicesLoaded()

  const voices = engine.getVoices()
  const effectiveLang = voiceLangForMode(lang, options?.speechLang)
  const voice = selectBestVoice(effectiveLang, voices, options?.preferredVoiceId)

  const utterance = new SpeechSynthesisUtterance(trimmed)
  if (voice) {
    utterance.voice = voice
    utterance.lang = voice.lang
  } else {
    utterance.lang = effectiveLang === 'uz' ? 'uz-UZ' : 'ru-RU'
  }

  utterance.rate = options?.rate ?? 0.91
  utterance.pitch = 1
  utterance.volume = options?.volume ?? 0.88

  const onDone = (): void => {
    options?.onEnd?.()
  }

  utterance.onend = onDone
  utterance.onerror = onDone

  cancelSpeech()
  options?.onStart?.()
  engine.speak(utterance)
  return true
}

/**
 * Speaks text with Uzbek-first voice selection; falls back to Russian, then default.
 */
export async function speakUzbekFirst(text: string): Promise<boolean> {
  const engine = getEngine()
  const trimmed = text.trim()
  if (!engine || !trimmed) return false

  await ensureVoicesLoaded()

  const utterance = new SpeechSynthesisUtterance(trimmed)
  const voice = pickVoiceForUzbekFirst()
  if (voice) {
    utterance.voice = voice
    utterance.lang = voice.lang
  } else {
    utterance.lang = 'ru-RU'
  }

  utterance.rate = 0.95
  utterance.pitch = 1
  utterance.volume = 1

  cancelSpeech()
  engine.speak(utterance)
  return true
}

export function speechAvailable(): boolean {
  return getEngine() !== null
}

export { cancelSpeech }
