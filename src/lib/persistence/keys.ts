/**
 * Central localStorage keys for Forensic workspace persistence.
 * Values match legacy keys where applicable so existing users keep data.
 */
export const STORAGE_KEYS = {
  /** App settings envelope (synced with settingsManager). */
  FORENSIC_APP_SETTINGS: 'fst.app.settings.v1',
  /** Debounced live workspace: chat + open forensic session + session flags. */
  FORENSIC_WORKSPACE: 'forensic.workspace.v1',
  /** Saved ended sessions carousel (max 10). */
  FORENSIC_SESSION_HISTORY: 'fst.forensic.history.v1',
  /** Legacy prefs mirror; kept for compatibility with older builds. */
  FORENSIC_PREFS_LEGACY: 'fst.forensic.prefs.v1',
} as const

export const WORKSPACE_ENVELOPE_VERSION = 1 as const
