import { memo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, FileDown, FileJson, CornerUpLeft } from 'lucide-react'
import type { Lang } from '../i18n'
import { useT } from '../i18n'
import type { ForensicSession } from '../lib/session/sessionTypes'
import { formatProtocolTimestamp } from '../lib/session/transcriptBuilder'
import { downloadSessionJson, downloadSessionTxt } from '../lib/session/exportSession'
import { loadPrefs } from '../lib/session/sessionStorage'
import styles from './SessionHistoryModal.module.css'

interface Props {
  readonly lang: Lang
  readonly open: boolean
  readonly onClose: () => void
  readonly sessions: readonly ForensicSession[]
  readonly onRestoreSession: (session: ForensicSession) => void
}

function formatSessionDuration(s: ForensicSession, lang: Lang): string {
  const end = typeof s.endedAt === 'number' ? s.endedAt : Date.now()
  const ms = Math.max(0, end - s.startedAt)
  const totalSec = Math.floor(ms / 1000)
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  if (lang === 'ru') {
    if (hours > 0) return `${hours}\u00a0ч ${minutes}\u00a0мин`
    if (minutes > 0) return `${minutes}\u00a0мин ${seconds}\u00a0с`
    return `${seconds}\u00a0с`
  }
  if (hours > 0) return `${hours} soat ${minutes} daq`
  if (minutes > 0) return `${minutes} daq ${seconds} s`
  return `${seconds} s`
}

export default memo(function SessionHistoryModal({ lang, open, onClose, sessions, onRestoreSession }: Props) {
  const t = useT(lang)
  const prefs = loadPrefs()

  const handleRestore = useCallback(
    (s: ForensicSession) => {
      onRestoreSession(s)
    },
    [onRestoreSession],
  )

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.backdrop}
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="hist-title"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={e => e.stopPropagation()}
          >
            <div className={styles.head}>
              <h2 id="hist-title" className={styles.title}>
                {t('session_history_title')}
              </h2>
              <button type="button" className={styles.close} onClick={onClose} aria-label={t('session_modal_close')}>
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <p className={styles.lead}>{t('session_history_lead')}</p>
            <ul className={styles.list}>
              {sessions.length === 0 ? (
                <li className={styles.empty}>{t('session_history_empty')}</li>
              ) : (
                sessions.map(s => {
                  const stamp = formatProtocolTimestamp(s.startedAt, lang)
                  const gestures = s.events.filter(e => e.kind === 'gesture_log').length
                  const duration = formatSessionDuration(s, lang)
                  return (
                    <li key={s.id} className={styles.item}>
                      <div className={styles.itemMain}>
                        <span className={styles.itemId}>{s.id}</span>
                        <span className={styles.itemMeta}>
                          {stamp} · {gestures} {t('session_gesture_units')}
                        </span>
                        <span className={styles.itemDuration}>
                          {t('history_duration')}: {duration}
                        </span>
                      </div>
                      <div className={styles.itemActions}>
                        <button
                          type="button"
                          className={styles.miniBtn}
                          onClick={() => handleRestore(s)}
                          title={t('history_restore')}
                          aria-label={t('history_restore')}
                        >
                          <CornerUpLeft size={15} strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          className={styles.miniBtn}
                          onClick={() => downloadSessionTxt(s, { includeDeviceDetails: prefs.exportIncludeDeviceDetails })}
                          title={t('assist_action_export_txt')}
                        >
                          <FileDown size={15} strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          className={styles.miniBtn}
                          onClick={() => downloadSessionJson(s)}
                          title={t('assist_action_export_json')}
                        >
                          <FileJson size={15} strokeWidth={2} />
                        </button>
                      </div>
                    </li>
                  )
                })
              )}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
