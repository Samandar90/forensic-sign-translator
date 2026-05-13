import type { Lang } from '../../i18n'
import type { ChatMessage } from '../../types'

export interface TranscriptExportMeta {
  readonly sessionId: string | null
  readonly uiLang: Lang
  readonly exportedAt: number
}

export interface TranscriptRow {
  readonly timestamp: number
  readonly iso: string
  readonly role: 'user' | 'assistant'
  readonly gesture: string | null
  readonly content: string
  readonly translation: string | null
  readonly language: Lang
}

function rowFromMessage(m: ChatMessage, uiLang: Lang): TranscriptRow {
  const gesture =
    m.role === 'assistant' && m.gestureBlock
      ? m.gestureBlock.headline.replace(/\s+/g, ' ').trim()
      : m.role === 'user'
        ? (m.emoji ?? m.content).trim() || null
        : null

  return {
    timestamp: m.ts,
    iso: new Date(m.ts).toISOString(),
    role: m.role,
    gesture,
    content: m.content,
    translation: m.translation ?? m.crossLang ?? null,
    language: uiLang,
  }
}

export function buildTranscriptRows(messages: readonly ChatMessage[], uiLang: Lang): TranscriptRow[] {
  return messages.map(m => rowFromMessage(m, uiLang))
}

export function transcriptToJson(
  messages: readonly ChatMessage[],
  meta: TranscriptExportMeta,
): string {
  const payload = {
    meta,
    messages: buildTranscriptRows(messages, meta.uiLang),
  }
  return `${JSON.stringify(payload, null, 2)}\n`
}

export function transcriptToTxt(messages: readonly ChatMessage[], meta: TranscriptExportMeta): string {
  const lines: string[] = [
    `Forensic Sign Translator — transcript`,
    `Exported: ${new Date(meta.exportedAt).toISOString()}`,
    `UI language: ${meta.uiLang}`,
    `Session: ${meta.sessionId ?? '—'}`,
    '',
    '---',
    '',
  ]

  for (const row of buildTranscriptRows(messages, meta.uiLang)) {
    lines.push(`[${row.iso}] ${row.role.toUpperCase()}`)
    if (row.gesture) lines.push(`  Gesture: ${row.gesture}`)
    lines.push(`  Content: ${row.content}`)
    if (row.translation) lines.push(`  Translation: ${row.translation}`)
    lines.push('')
  }

  return lines.join('\n')
}

function triggerDownload(filename: string, mime: string, body: string): void {
  const blob = new Blob([body], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadTranscriptTxt(messages: readonly ChatMessage[], meta: TranscriptExportMeta): void {
  const stamp = new Date(meta.exportedAt).toISOString().replace(/[:.]/g, '-')
  triggerDownload(`transcript-${stamp}.txt`, 'text/plain;charset=utf-8', transcriptToTxt(messages, meta))
}

export function downloadTranscriptJson(messages: readonly ChatMessage[], meta: TranscriptExportMeta): void {
  const stamp = new Date(meta.exportedAt).toISOString().replace(/[:.]/g, '-')
  triggerDownload(`transcript-${stamp}.json`, 'application/json;charset=utf-8', transcriptToJson(messages, meta))
}
