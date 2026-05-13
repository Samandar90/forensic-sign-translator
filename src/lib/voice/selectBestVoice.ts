import type { Lang } from '../../i18n'

function lower(s: string): string {
  return s.toLowerCase()
}

function normLang(lang: string): string {
  return lower(lang).replace('_', '-')
}

const RU_FEMALE_RE =
  /female|жен|irina|milena|katya|dariya|elena|natalia|svetlana|zira|oksana|alena|yuliya|julia|marina|vera|anna|tatiana|polina/i

/**
 * Picks a natural voice for assistant speech.
 * RU: Microsoft Irina / Pavel → Google/Microsoft ru → natural female RU → any RU.
 * UZ: uz-UZ → uz* → name hints → calm RU female → best Russian → default.
 */
export function selectBestVoice(
  lang: Lang,
  voices: SpeechSynthesisVoice[],
  preferredVoiceId?: string,
): SpeechSynthesisVoice | null {
  if (!voices.length) return null

  const pref = preferredVoiceId?.trim()
  if (pref) {
    const byUri = voices.find(v => v.voiceURI === pref)
    if (byUri) return byUri
    const byName = voices.find(v => v.name === pref)
    if (byName) return byName
  }

  const ruFemale = (): SpeechSynthesisVoice | null =>
    voices.find(v => normLang(v.lang).startsWith('ru') && RU_FEMALE_RE.test(v.name + v.voiceURI)) ??
    voices.find(
      v => normLang(v.lang).startsWith('ru') && /microsoft|google|natural/i.test(v.voiceURI + v.name),
    ) ??
    voices.find(v => normLang(v.lang).startsWith('ru')) ??
    null

  if (lang === 'uz') {
    const uzExact = voices.find(v => {
      const l = normLang(v.lang)
      return l === 'uz-uz' || l === 'uz-latn-uz' || l === 'uz-cyrl-uz'
    })
    const uzAny =
      uzExact ??
      voices.find(v => {
        const l = normLang(v.lang)
        return l.startsWith('uz') || l.includes('uzb')
      }) ??
      voices.find(v => /uzbek|o‘zbek|ozbek/i.test(v.name + v.voiceURI))
    return uzAny ?? ruFemale() ?? voices[0] ?? null
  }

  const ruMatchers: ((v: SpeechSynthesisVoice) => boolean)[] = [
    v => /irina/i.test(v.name) && normLang(v.lang).startsWith('ru'),
    v => /pavel/i.test(v.name) && normLang(v.lang).startsWith('ru'),
    v => normLang(v.lang).startsWith('ru') && /google/.test(v.voiceURI + v.name),
    v => normLang(v.lang).startsWith('ru') && /microsoft/.test(v.voiceURI + v.name),
    v => normLang(v.lang).startsWith('ru') && RU_FEMALE_RE.test(v.name + v.voiceURI),
    v => normLang(v.lang).startsWith('ru'),
  ]

  for (const match of ruMatchers) {
    const hit = voices.find(match)
    if (hit) return hit
  }

  return voices[0] ?? null
}
