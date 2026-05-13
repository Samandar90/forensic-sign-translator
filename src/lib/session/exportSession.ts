import type { ForensicSession } from './sessionTypes'
import { buildProtocolPlainText } from './transcriptBuilder'
import { buildPdfExportPlaceholder } from '../export/pdfExport'

export interface ForensicJsonExport {
  readonly schemaVersion: number
  readonly exportedAt: number
  readonly session: ForensicSession
  readonly pdf: ReturnType<typeof buildPdfExportPlaceholder>
}

export function exportSessionToTxt(
  session: ForensicSession,
  lang: ForensicSession['uiLang'],
  opts?: { readonly includeDeviceDetails?: boolean },
): string {
  const includeDevice = opts?.includeDeviceDetails !== false
  const metaLines = [
    'Forensic Sign Translator — session protocol',
    `Session ID: ${session.id}`,
    `Started: ${new Date(session.startedAt).toISOString()}`,
    `Ended: ${session.endedAt ? new Date(session.endedAt).toISOString() : '—'}`,
    `UI language: ${session.uiLang}`,
    `Camera preset: ${session.camera.qualityPreset}`,
    `Detection FPS (avg): ${session.stats.detectionFpsAvg || '—'} (n=${session.stats.detectionFpsSampleCount})`,
    ...(includeDevice
      ? [
          `Device: ${session.device.platform} · ${session.device.language}`,
          `User-Agent: ${session.device.userAgent}`,
        ]
      : ['Device: (redacted)']),
    '',
    '--- Events (chronological) ---',
    '',
  ]

  const eventLines: string[] = []
  for (const e of session.events) {
    const iso = new Date(e.ts).toISOString()
    if (e.kind === 'system') {
      eventLines.push(`[${iso}] SYSTEM ${e.code}`)
      eventLines.push('')
      continue
    }
    if (e.kind === 'gesture_log') {
      eventLines.push(`[${iso}] GESTURE ${e.signature}`)
      eventLines.push(`  label: ${e.gestureLabel}`)
      eventLines.push(`  id: ${e.gestureId}`)
      eventLines.push(`  primary: ${e.translationPrimary}`)
      if (e.translationSecondary) eventLines.push(`  secondary: ${e.translationSecondary}`)
      eventLines.push(`  confidence: ${e.confidencePct}%`)
      eventLines.push(`  hand: ${e.handLabel}`)
      eventLines.push(`  repeats: ${e.repeatCount}`)
      eventLines.push('')
      continue
    }
    if (e.kind === 'translation') {
      eventLines.push(`[${iso}] TRANSLATION`)
      eventLines.push(`  text: ${e.text}`)
      if (e.companion) eventLines.push(`  companion: ${e.companion}`)
      eventLines.push('')
      continue
    }
    if (e.kind === 'voice') {
      eventLines.push(`[${iso}] VOICE ${e.phase}`)
      if (e.textSnippet) eventLines.push(`  snippet: ${e.textSnippet}`)
      if (e.assistantMessageId) eventLines.push(`  message: ${e.assistantMessageId}`)
      eventLines.push('')
    }
  }

  const protocol = buildProtocolPlainText(session.events, lang)

  return [...metaLines, ...eventLines, '--- Gesture protocol (human-readable) ---', '', protocol].join('\n')
}

export function exportSessionToJson(session: ForensicSession): string {
  const payload: ForensicJsonExport = {
    schemaVersion: 1,
    exportedAt: Date.now(),
    session,
    pdf: buildPdfExportPlaceholder(session),
  }
  return `${JSON.stringify(payload, null, 2)}\n`
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

export function downloadSessionTxt(session: ForensicSession, opts?: { readonly includeDeviceDetails?: boolean }): void {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  triggerDownload(
    `session-${session.id}-${stamp}.txt`,
    'text/plain;charset=utf-8',
    exportSessionToTxt(session, session.uiLang, opts),
  )
}

export function downloadSessionJson(session: ForensicSession): void {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  triggerDownload(
    `session-${session.id}-${stamp}.json`,
    'application/json;charset=utf-8',
    exportSessionToJson(session),
  )
}
