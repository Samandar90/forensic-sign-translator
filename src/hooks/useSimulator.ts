import { useState, useEffect, useCallback, useRef } from 'react'
import type { TranscriptEntry, SystemStatus, LanguageMode } from '../types'

const GESTURE_LIBRARY: Record<LanguageMode, { gesture: string; translation: string }[]> = {
  USL: [
    { gesture: 'Open Palm → Closed Fist', translation: 'My name is...' },
    { gesture: 'Index Finger Up', translation: 'Yes, I understand' },
    { gesture: 'Cross Arms', translation: 'I do not agree' },
    { gesture: 'Hand Wave Horizontal', translation: 'No, that is incorrect' },
    { gesture: 'Touch Chin → Point Forward', translation: 'I want to say something' },
    { gesture: 'Both Hands Open', translation: 'Please repeat the question' },
    { gesture: 'Right Hand Sweep', translation: 'On that specific date' },
    { gesture: 'Tap Temple × 2', translation: 'I remember clearly' },
    { gesture: 'Flat Hand Push Forward', translation: 'Stop, I need time' },
    { gesture: 'Circle Motion Right Hand', translation: 'It happened repeatedly' },
  ],
  UZB: [
    { gesture: 'Ochiq Kaft → Mushtum', translation: 'Mening ismim...' },
    { gesture: 'Ko\'rsatkich Yuqoriga', translation: 'Ha, tushundim' },
    { gesture: 'Qo\'llarni Kesib O\'tkazish', translation: 'Men rozi emasman' },
    { gesture: 'Gorizontal To\'lqin', translation: 'Yo\'q, bu noto\'g\'ri' },
    { gesture: 'Iyakni Tegiz → Oldinga Ko\'rsat', translation: 'Men nimadir aytmoqchiman' },
    { gesture: 'Ikki Qo\'l Ochiq', translation: 'Iltimos savolni takrorlang' },
    { gesture: 'O\'ng Qo\'l Siljishi', translation: 'O\'sha aniq sanada' },
    { gesture: 'Chakka × 2 Tegizish', translation: 'Aniq eslayman' },
    { gesture: 'Yassi Qo\'l Oldinga', translation: 'To\'xta, vaqt kerak' },
    { gesture: 'Doira Harakat O\'ng Qo\'l', translation: 'Bu qayta-qayta bo\'ldi' },
  ],
  RUS: [
    { gesture: 'Открытая Ладонь → Кулак', translation: 'Моё имя...' },
    { gesture: 'Указательный Вверх', translation: 'Да, я понимаю' },
    { gesture: 'Скрещенные Руки', translation: 'Я не согласен' },
    { gesture: 'Горизонтальная Волна', translation: 'Нет, это неверно' },
    { gesture: 'Касание Подбородка', translation: 'Я хочу сказать кое-что' },
    { gesture: 'Обе Руки Открыты', translation: 'Повторите вопрос' },
    { gesture: 'Правая Рука Смещение', translation: 'В ту конкретную дату' },
    { gesture: 'Касание Виска × 2', translation: 'Я отчётливо помню' },
    { gesture: 'Плоская Рука Вперёд', translation: 'Стоп, мне нужно время' },
    { gesture: 'Круговое Движение Правой', translation: 'Это происходило неоднократно' },
  ],
}

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

function formatTimestamp() {
  const now = new Date()
  return now.toLocaleTimeString('en-GB', { hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0')
}

export function useSimulator() {
  const [status, setStatus] = useState<SystemStatus>({
    isActive: false,
    isListening: false,
    isProcessing: false,
    confidence: 0,
    currentGesture: '',
    currentTranslation: '',
    voiceEnabled: true,
    language: 'UZB',
  })
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const processingRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const simulateDetection = useCallback((lang: LanguageMode) => {
    const library = GESTURE_LIBRARY[lang]
    const item = library[Math.floor(Math.random() * library.length)]
    const confidence = 72 + Math.floor(Math.random() * 27)

    setStatus(prev => ({ ...prev, isProcessing: true, currentGesture: '', currentTranslation: '' }))

    processingRef.current = setTimeout(() => {
      setStatus(prev => ({
        ...prev,
        isProcessing: false,
        currentGesture: item.gesture,
        currentTranslation: item.translation,
        confidence,
      }))

      const entry: TranscriptEntry = {
        id: generateId(),
        timestamp: formatTimestamp(),
        gesture: item.gesture,
        translation: item.translation,
        confidence,
        language: lang,
      }
      setTranscript(prev => [entry, ...prev].slice(0, 50))
    }, 800 + Math.random() * 600)
  }, [])

  const startSession = useCallback(() => {
    setStatus(prev => ({ ...prev, isActive: true, isListening: true }))
    intervalRef.current = setInterval(() => {
      setStatus(prev => {
        if (prev.isActive) simulateDetection(prev.language)
        return prev
      })
    }, 3500)
  }, [simulateDetection])

  const stopSession = useCallback(() => {
    setStatus(prev => ({ ...prev, isActive: false, isListening: false, isProcessing: false }))
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (processingRef.current) clearTimeout(processingRef.current)
  }, [])

  const setLanguage = useCallback((lang: LanguageMode) => {
    setStatus(prev => ({ ...prev, language: lang }))
  }, [])

  const toggleVoice = useCallback(() => {
    setStatus(prev => ({ ...prev, voiceEnabled: !prev.voiceEnabled }))
  }, [])

  const clearTranscript = useCallback(() => {
    setTranscript([])
    setStatus(prev => ({ ...prev, currentGesture: '', currentTranslation: '', confidence: 0 }))
  }, [])

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (processingRef.current) clearTimeout(processingRef.current)
    }
  }, [])

  return { status, transcript, startSession, stopSession, setLanguage, toggleVoice, clearTranscript }
}
