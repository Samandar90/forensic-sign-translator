import type { Lang } from '../../i18n'
import { translations } from '../../i18n'
import type { ForensicGestureLogEvent, ForensicHandLabel, SessionEvent } from './sessionTypes'

export interface ProtocolBlock {
  readonly label: string
  readonly value: string
}

export interface ProtocolTranscriptEntry {
  readonly id: string
  readonly ts: number
  readonly tsDisplay: string
  readonly headline: string
  readonly blocks: readonly ProtocolBlock[]
  readonly repeatCount: number
}

const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`)

/** Compact wall-clock, locale-aware (24h). */
export function formatProtocolTimestamp(ts: number, lang: Lang): string {
  try {
    const d = new Date(ts)
    const loc = lang === 'uz' ? 'uz-UZ' : 'ru-RU'
    const t = new Intl.DateTimeFormat(loc, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d)
    return t
  } catch {
    const d = new Date(ts)
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
  }
}

function handLabelText(label: ForensicHandLabel, lang: Lang): string {
  const dict = translations[lang]
  if (label === 'Left') return dict.res_hand_left
  if (label === 'Right') return dict.res_hand_right
  if (label === 'Both') return dict.session_hand_both
  return '—'
}

function gestureHeadline(ev: ForensicGestureLogEvent): string {
  return `${ev.emoji} ${ev.gestureLabel}`.trim()
}

export function buildProtocolTranscriptEntries(
  events: readonly SessionEvent[],
  lang: Lang,
): readonly ProtocolTranscriptEntry[] {
  const out: ProtocolTranscriptEntry[] = []
  for (const e of events) {
    if (e.kind !== 'gesture_log') continue
    const tsShow = formatProtocolTimestamp(e.ts, lang)
    const blocks: ProtocolBlock[] = [
      { label: lang === 'ru' ? 'Жест' : 'Ishora', value: gestureHeadline(e) },
      {
        label: lang === 'ru' ? 'Перевод' : 'Tarjima',
        value: e.translationPrimary,
      },
    ]
    if (e.translationSecondary) {
      blocks.push({
        label: lang === 'ru' ? 'Параллель' : 'Parallel',
        value: e.translationSecondary,
      })
    }
    blocks.push({
      label: lang === 'ru' ? 'Уверенность' : 'Ishonch',
      value: `${e.confidencePct}%`,
    })
    blocks.push({
      label: lang === 'ru' ? 'Кисть' : 'Kaft',
      value: handLabelText(e.handLabel, lang),
    })
    if (e.repeatCount > 1) {
      blocks.push({
        label: lang === 'ru' ? 'Повторы' : 'Takror',
        value: `×${e.repeatCount}`,
      })
    }
    out.push({
      id: e.id,
      ts: e.ts,
      tsDisplay: tsShow,
      headline: gestureHeadline(e),
      blocks,
      repeatCount: e.repeatCount,
    })
  }
  return out
}

export function buildProtocolPlainText(events: readonly SessionEvent[], lang: Lang): string {
  const lines: string[] = []
  for (const e of events) {
    if (e.kind !== 'gesture_log') continue
    const time = formatProtocolTimestamp(e.ts, lang)
    lines.push(`[${time}]`)
    lines.push(`${lang === 'ru' ? 'Жест' : 'Ishora'}:`)
    lines.push(gestureHeadline(e))
    lines.push('')
    lines.push(`${lang === 'ru' ? 'Перевод' : 'Tarjima'}:`)
    lines.push(e.translationPrimary)
    if (e.translationSecondary) {
      lines.push('')
      lines.push(`${lang === 'ru' ? 'Параллель' : 'Parallel'}:`)
      lines.push(e.translationSecondary)
    }
    lines.push('')
    lines.push(`${lang === 'ru' ? 'Уверенность' : 'Ishonch'}:`)
    lines.push(`${e.confidencePct}%`)
    lines.push('')
    lines.push(`${lang === 'ru' ? 'Кисть' : 'Kaft'}:`)
    lines.push(handLabelText(e.handLabel, lang))
    if (e.repeatCount > 1) {
      lines.push('')
      lines.push(`${lang === 'ru' ? 'Повторы' : 'Takror'}: ×${e.repeatCount}`)
    }
    lines.push('')
    lines.push('---')
    lines.push('')
  }
  return lines.join('\n')
}
