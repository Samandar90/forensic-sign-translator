import type { Lang } from '../i18n'
import { translations, type TranslationKey } from '../i18n'
import type { VisionDetectionState } from '../types'
import { visionIsBootstrapping } from '../types'
import type { HandDetectionResult } from '../lib/detection/handLandmarker'
import { FINGER_ORDER } from '../lib/detection/handLandmarker'

function t(lang: Lang, key: TranslationKey): string {
  const d = translations[lang]
  return d[key] ?? translations.ru[key] ?? key
}

export function buildSpeakSummary(
  lang: Lang,
  opts: {
    sessionActive: boolean
    cameraOn: boolean
    visionState: VisionDetectionState
    handCount: number
    personPresent: boolean
    primaryHand: HandDetectionResult | null
  },
): string {
  const { sessionActive, cameraOn, visionState, handCount, personPresent, primaryHand } = opts

  const overall = (() => {
    if (!sessionActive) return t(lang, 'res_overall_off')
    if (!cameraOn) return t(lang, 'res_overall_session')
    if (visionIsBootstrapping(visionState)) return t(lang, 'res_overall_loading')
    if (visionState === 'error') return t(lang, 'res_overall_error')
    if (visionState === 'ready') return t(lang, 'res_overall_live')
    return t(lang, 'res_overall_session')
  })()

  const person = (() => {
    if (!sessionActive || !cameraOn) return t(lang, 'res_person_na')
    if (visionIsBootstrapping(visionState)) return t(lang, 'res_person_pending')
    if (visionState === 'error') return t(lang, 'res_person_na')
    if (!personPresent) return t(lang, 'res_person_no')
    return t(lang, 'res_person_yes')
  })()

  const hands = (() => {
    if (!sessionActive || !cameraOn || visionState !== 'ready') return t(lang, 'res_hands_na')
    if (handCount > 0) return t(lang, 'res_hands_yes')
    return t(lang, 'res_hands_wait')
  })()

  const fingers =
    primaryHand &&
    sessionActive &&
    cameraOn &&
    visionState === 'ready' &&
    handCount > 0
      ? FINGER_ORDER.map(name => {
          const open = primaryHand.fingerStates[name] === 'open'
          return `${t(lang, `res_finger_${name}` as TranslationKey)}: ${t(lang, open ? 'res_finger_open' : 'res_finger_closed')}`
        }).join(', ')
      : ''

  const parts = [overall, person, hands]
  if (fingers) parts.push(fingers)
  return parts.join('. ')
}
