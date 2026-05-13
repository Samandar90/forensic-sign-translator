import type { Lang, TranslationKey } from '../../i18n'
import { translations } from '../../i18n'
import type { AdvancedGestureId } from '../gestures/gestureTypes'
import type { ChatGestureBlock, MultiHandGestureSnapshot } from '../../types'

const TABLE: Record<AdvancedGestureId, { ru: string; uz: string }> = {
  LIKE: { ru: 'Нравится', uz: 'Yoqadi' },
  PEACE: { ru: 'Мир', uz: 'Tinchlik' },
  HELLO: { ru: 'Здравствуйте', uz: 'Assalomu alaykum' },
  STOP: { ru: 'Стоп', uz: 'To‘xtang' },
  FIST: { ru: 'Кулак', uz: 'Musht' },
}

/** Short phrase for TTS / chat — active UI language only. */
export function gestureSpeechShort(id: AdvancedGestureId, lang: Lang): string {
  const row = TABLE[id]
  return lang === 'uz' ? row.uz : row.ru
}

/** Companion line in the other language (for chat subtitles). */
export function gestureSpeechCross(id: AdvancedGestureId, lang: Lang): string {
  const row = TABLE[id]
  return lang === 'uz' ? row.ru : row.uz
}

/** Left then right; skips duplicate gesture id; only hands with stable ≥75% confidence. */
export function phraseFromMultiHand(multi: MultiHandGestureSnapshot, lang: Lang): string {
  const out: string[] = []
  if (multi.left.present && multi.left.stableGesture && multi.left.stableGesture.confidencePct >= 75) {
    out.push(gestureSpeechShort(multi.left.stableGesture.id, lang))
  }
  if (multi.right.present && multi.right.stableGesture && multi.right.stableGesture.confidencePct >= 75) {
    const id = multi.right.stableGesture.id
    if (!multi.left.stableGesture || multi.left.stableGesture.id !== id) {
      out.push(gestureSpeechShort(id, lang))
    }
  }
  return out.join('. ')
}

export function stableGestureSignature(multi: MultiHandGestureSnapshot): string | null {
  const p: string[] = []
  if (multi.left.present && multi.left.stableGesture) p.push(`L:${multi.left.stableGesture.id}`)
  if (multi.right.present && multi.right.stableGesture) p.push(`R:${multi.right.stableGesture.id}`)
  return p.length ? p.join('|') : null
}

/** Stricter than announce pipeline — reduces chat spam. */
export const CHAT_GESTURE_CONFIDENCE_MIN = 78

/** Minimum gap between chat turns for the same gesture signature. */
export const CHAT_COOLDOWN_MS = 2200

const GESTURE_NAME_KEY: Record<AdvancedGestureId, TranslationKey> = {
  LIKE: 'gesture_name_like',
  PEACE: 'gesture_name_peace',
  HELLO: 'gesture_name_hello',
  STOP: 'gesture_name_stop',
  FIST: 'gesture_name_fist',
}

export function gestureDisplayName(id: AdvancedGestureId, lang: Lang): string {
  const key = GESTURE_NAME_KEY[id]
  return translations[lang][key]
}

/** Each visible hand must have a stable gesture ≥78% confidence (chat / export). */
export function multiReadyForChat(multi: MultiHandGestureSnapshot): boolean {
  const min = CHAT_GESTURE_CONFIDENCE_MIN
  if (!multi.left.present && !multi.right.present) return false
  if (multi.left.present) {
    if (!multi.left.stableGesture || multi.left.stableGesture.confidencePct < min) return false
  }
  if (multi.right.present) {
    if (!multi.right.stableGesture || multi.right.stableGesture.confidencePct < min) return false
  }
  return true
}

export function stableGestureSignatureForChat(multi: MultiHandGestureSnapshot): string | null {
  const min = CHAT_GESTURE_CONFIDENCE_MIN
  const p: string[] = []
  if (multi.left.present && multi.left.stableGesture && multi.left.stableGesture.confidencePct >= min) {
    p.push(`L:${multi.left.stableGesture.id}`)
  }
  if (multi.right.present && multi.right.stableGesture && multi.right.stableGesture.confidencePct >= min) {
    p.push(`R:${multi.right.stableGesture.id}`)
  }
  return p.length ? p.join('|') : null
}

export function buildGestureChatBlock(
  multi: MultiHandGestureSnapshot,
  lang: Lang,
  emoji: string,
): ChatGestureBlock | null {
  if (!multiReadyForChat(multi)) return null
  const uz = phraseFromMultiHand(multi, 'uz')
  const ru = phraseFromMultiHand(multi, 'ru')
  const min = CHAT_GESTURE_CONFIDENCE_MIN
  const titles: string[] = []
  const seen = new Set<AdvancedGestureId>()
  if (multi.left.present && multi.left.stableGesture && multi.left.stableGesture.confidencePct >= min) {
    titles.push(gestureDisplayName(multi.left.stableGesture.id, lang))
    seen.add(multi.left.stableGesture.id)
  }
  if (multi.right.present && multi.right.stableGesture && multi.right.stableGesture.confidencePct >= min) {
    const id = multi.right.stableGesture.id
    if (!seen.has(id)) {
      titles.push(gestureDisplayName(id, lang))
      seen.add(id)
    }
  }
  const titleStr = titles.join(' · ')
  const headline = `${emoji} ${titleStr}`.trim()

  let primaryGestureId: AdvancedGestureId | undefined
  if (multi.primaryStable && multi.primaryStable.confidencePct >= min) {
    primaryGestureId = multi.primaryStable.id
  } else if (multi.left.stableGesture && multi.left.stableGesture.confidencePct >= min) {
    primaryGestureId = multi.left.stableGesture.id
  } else if (multi.right.stableGesture && multi.right.stableGesture.confidencePct >= min) {
    primaryGestureId = multi.right.stableGesture.id
  }

  return {
    headline,
    lineUz: uz,
    lineRu: ru,
    primaryGestureId,
  }
}

/** Each visible hand must have a stable gesture ≥75% confidence. */
export function multiReadyForAnnouncing(multi: MultiHandGestureSnapshot): boolean {
  if (!multi.left.present && !multi.right.present) return false
  if (multi.left.present) {
    if (!multi.left.stableGesture || multi.left.stableGesture.confidencePct < 75) return false
  }
  if (multi.right.present) {
    if (!multi.right.stableGesture || multi.right.stableGesture.confidencePct < 75) return false
  }
  return true
}
