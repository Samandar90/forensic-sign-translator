import { memo, useMemo, useState, useEffect } from 'react'
import { Clock, Hand, Mic, Globe, Activity } from 'lucide-react'
import type { Lang } from '../i18n'
import { useT } from '../i18n'
import type { ForensicSession, ForensicGestureLogEvent } from '../lib/session/sessionTypes'
import { formatProtocolTimestamp } from '../lib/session/transcriptBuilder'
import styles from './SessionInfoPanel.module.css'

interface Props {
  lang: Lang
  session: ForensicSession | null
  sessionActive: boolean
  voiceEnabled: boolean
  liveDetectionFps: number
}

function formatDurationMs(ms: number, lang: Lang): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)
  if (lang === 'uz') return `${pad(m)}:${pad(r)}`
  return `${pad(m)}:${pad(r)}`
}

export default memo(function SessionInfoPanel({
  lang,
  session,
  sessionActive,
  voiceEnabled,
  liveDetectionFps,
}: Props) {
  const t = useT(lang)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!sessionActive || !session) return
    const id = window.setInterval(() => setTick(x => x + 1), 1000)
    return () => window.clearInterval(id)
  }, [sessionActive, session])

  const gestureCount = useMemo(() => {
    if (!session) return 0
    return session.events
      .filter((e): e is ForensicGestureLogEvent => e.kind === 'gesture_log')
      .reduce((acc, e) => acc + e.repeatCount, 0)
  }, [session])

  const durationMs = useMemo(() => {
    if (!session) return 0
    const end = sessionActive ? Date.now() : session.endedAt ?? Date.now()
    return Math.max(0, end - session.startedAt)
  }, [session, sessionActive, tick])

  const startedLabel = session ? formatProtocolTimestamp(session.startedAt, lang) : '—'

  const fpsShow =
    sessionActive && liveDetectionFps > 0
      ? `${liveDetectionFps} ${t('cam_fps')} (${t('session_fps_avg')}: ${session?.stats.detectionFpsAvg || '—'})`
      : session?.stats.detectionFpsAvg
        ? `${session.stats.detectionFpsAvg} ${t('cam_fps')} (${t('session_fps_samples')}: ${session.stats.detectionFpsSampleCount})`
        : '—'

  if (!session && !sessionActive) {
    return (
      <div className={styles.card} role="region" aria-label={t('session_info_region')}>
        <p className={styles.idle}>{t('session_info_idle')}</p>
      </div>
    )
  }

  return (
    <div className={styles.card} role="region" aria-label={t('session_info_region')}>
      <div className={styles.cardHead}>
        <span className={styles.protocolTag}>{t('session_protocol_label')}</span>
        <span className={styles.sessionId} title={session?.id}>
          {session?.id ?? '—'}
        </span>
      </div>
      <dl className={styles.grid}>
        <div className={styles.row}>
          <dt>
            <Clock size={14} strokeWidth={1.75} aria-hidden />
            {t('session_duration')}
          </dt>
          <dd>{formatDurationMs(durationMs, lang)}</dd>
        </div>
        <div className={styles.row}>
          <dt>
            <Hand size={14} strokeWidth={1.75} aria-hidden />
            {t('session_gestures_logged')}
          </dt>
          <dd>{gestureCount}</dd>
        </div>
        <div className={styles.row}>
          <dt>
            <Mic size={14} strokeWidth={1.75} aria-hidden />
            {t('session_voice')}
          </dt>
          <dd>{voiceEnabled ? t('session_voice_on') : t('session_voice_off')}</dd>
        </div>
        <div className={styles.row}>
          <dt>
            <Globe size={14} strokeWidth={1.75} aria-hidden />
            {t('session_ui_lang')}
          </dt>
          <dd>{lang === 'ru' ? t('lang_switch_ru') : t('lang_switch_uz')}</dd>
        </div>
        <div className={styles.row}>
          <dt>
            <Activity size={14} strokeWidth={1.75} aria-hidden />
            {t('session_fps_line')}
          </dt>
          <dd>{fpsShow}</dd>
        </div>
        <div className={styles.row}>
          <dt>{t('session_started')}</dt>
          <dd>{startedLabel}</dd>
        </div>
      </dl>
    </div>
  )
})
