import type { ForensicSession } from '../session/sessionTypes'

export interface PdfExportPlaceholder {
  readonly format: 'application/pdf'
  readonly status: 'not_implemented'
  readonly message: string
  readonly sessionId: string
}

/** Placeholder for future PDF protocol renderer (wkhtmltopdf / print pipeline / server). */
export function buildPdfExportPlaceholder(session: ForensicSession): PdfExportPlaceholder {
  return {
    format: 'application/pdf',
    status: 'not_implemented',
    message: 'PDF export is planned; use TXT or JSON for full session data.',
    sessionId: session.id,
  }
}
