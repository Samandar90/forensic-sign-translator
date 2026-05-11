const VOICE_PRIORITY = ['uz', 'ru', 'tr', 'en']
const SPEECH_RATE = 0.9
const SPEECH_PITCH = 0.95
const SPEECH_VOLUME = 1

let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null
let currentUtterance: SpeechSynthesisUtterance | null = null
let lastSpokenText = ''
let lastSpokenAt = 0

function getSpeechEngine() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return null
  }

  return window.speechSynthesis
}

function pickBestVoice(voices: SpeechSynthesisVoice[]) {
  for (const language of VOICE_PRIORITY) {
    const localVoice = voices.find(voice => (
      voice.lang.toLowerCase().includes(language) && voice.localService
    ))
    if (localVoice) {
      return localVoice
    }

    const fallbackVoice = voices.find(voice => voice.lang.toLowerCase().includes(language))
    if (fallbackVoice) {
      return fallbackVoice
    }
  }

  return voices[0] ?? null
}

async function loadVoices() {
  const engine = getSpeechEngine()
  if (!engine) {
    return []
  }

  const existingVoices = engine.getVoices()
  if (existingVoices.length > 0) {
    return existingVoices
  }

  if (!voicesPromise) {
    voicesPromise = new Promise(resolve => {
      const handleVoicesChanged = () => {
        engine.removeEventListener('voiceschanged', handleVoicesChanged)
        resolve(engine.getVoices())
      }

      engine.addEventListener('voiceschanged', handleVoicesChanged)
      window.setTimeout(() => {
        engine.removeEventListener('voiceschanged', handleVoicesChanged)
        resolve(engine.getVoices())
      }, 1200)
    })
  }

  return voicesPromise
}

export function speechSupported() {
  return getSpeechEngine() !== null
}

export function cancelSpeech() {
  const engine = getSpeechEngine()
  if (!engine) {
    return
  }

  currentUtterance = null
  engine.cancel()
}

interface SpeakTextOptions {
  text: string
  cooldownMs?: number
  onStart?: () => void
  onEnd?: () => void
  onError?: () => void
}

export async function speakText({
  text,
  cooldownMs = 0,
  onStart,
  onEnd,
  onError,
}: SpeakTextOptions) {
  const engine = getSpeechEngine()
  const normalizedText = text.trim()

  if (!engine || !normalizedText) {
    onError?.()
    return false
  }

  const now = Date.now()
  if (normalizedText === lastSpokenText && now - lastSpokenAt < cooldownMs) {
    return false
  }

  const voices = await loadVoices()
  const utterance = new SpeechSynthesisUtterance(normalizedText)
  const voice = pickBestVoice(voices)

  if (voice) {
    utterance.voice = voice
  }

  utterance.rate = SPEECH_RATE
  utterance.pitch = SPEECH_PITCH
  utterance.volume = SPEECH_VOLUME

  utterance.onstart = () => {
    onStart?.()
  }

  utterance.onend = () => {
    if (currentUtterance === utterance) {
      currentUtterance = null
    }
    onEnd?.()
  }

  utterance.onerror = () => {
    if (currentUtterance === utterance) {
      currentUtterance = null
    }
    onError?.()
  }

  cancelSpeech()
  currentUtterance = utterance
  lastSpokenText = normalizedText
  lastSpokenAt = now
  engine.speak(utterance)

  return true
}
