import { memo, useEffect, useMemo, useState } from 'react'
import { Video, Mic, MicOff, Circle, Activity, Clock, Hash, Globe, Hand } from 'lucide-react'
import type { Lang } from '../i18n'
import { useT } from '../i18n'
import type { VisionDetectionState } from '../types'
import type { ForensicSession, ForensicGestureLogEvent } from '../lib/session/sessionTypes'
import styles from './SystemStatusStrip.module.css'

interface Props {
  readonly lang: Lang
  readonly cameraOn: boolean
  readonly voiceEnabled: boolean
  readonly sessionActive: boolean
  readonly visionState: VisionDetectionState
  readonly detectionFps: number
  readonly forensicSession: ForensicSession | null
  readonly workspaceSessionId: string
}

function formatDurationMs(ms: number, lang: Lang): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)
  if (lang === 'uz') return `${pad(m)}:${pad(r)}`
  return `${pad(m)}:${pad(r)}`
}

function truncateSessionId(id: string): string {
  const t = id.trim()
  if (t.length <= 14) return t
  return `${t.slice(0, 10)}…`
}

export default memo(function SystemStatusStrip({
  lang,
  cameraOn,
  voiceEnabled,
  sessionActive,
  visionState,
  detectionFps,
  forensicSession,
  workspaceSessionId,
}: Props) {
  const t = useT(lang)
  const recStable = sessionActive && cameraOn && visionState === 'ready' && detectionFps >= 4
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!sessionActive || !forensicSession) return
    const id = window.setInterval(() => setTick(x => x + 1), 1000)
    return () => window.clearInterval(id)
  }, [sessionActive, forensicSession])

  const gestureCount = useMemo(() => {
    if (!forensicSession) return 0
    return forensicSession.events
      .filter((e): e is ForensicGestureLogEvent => e.kind === 'gesture_log')
      .reduce((acc, e) => acc + e.repeatCount, 0)
  }, [forensicSession])

  const durationMs = useMemo(() => {
    if (!forensicSession) return 0
    const end = sessionActive ? Date.now() : forensicSession.endedAt ?? Date.now()
    return Math.max(0, end - forensicSession.startedAt)
  }, [forensicSession, sessionActive, tick])

  const fpsLabel =
    sessionActive && cameraOn && visionState === 'ready' && detectionFps > 0
      ? `${detectionFps}`
      : forensicSession?.stats.detectionFpsSampleCount
        ? `${forensicSession.stats.detectionFpsAvg}`
        : '—'

  const sessionIdShow = forensicSession?.id ?? workspaceSessionId
  const idCompact = truncateSessionId(sessionIdShow)

  return (
    <div className={styles.strip} role="region" aria-label={t('status_strip_region')}>
      <div className={`${styles.pill} ${cameraOn ? styles.pillOn : ''}`}>
        <Video size={14} strokeWidth={2} aria-hidden />
        <span>{cameraOn ? t('status_cam_on') : t('status_cam_off')}</span>
      </div>
      <div className={`${styles.pill} ${voiceEnabled ? styles.pillOn : ''}`}>
        {voiceEnabled ? <Mic size={14} strokeWidth={2} aria-hidden /> : <MicOff size={14} strokeWidth={2} aria-hidden />}
        <span>{voiceEnabled ? t('status_voice_on') : t('status_voice_off')}</span>
      </div>
      <div className={`${styles.pill} ${sessionActive ? styles.pillAccent : ''}`}>
        <Circle size={14} strokeWidth={2} aria-hidden />
        <span>{sessionActive ? t('status_session_on') : t('status_session_off')}</span>
      </div>
      <div className={`${styles.pill} ${recStable ? styles.pillOn : ''}`}>
        <Activity size={14} strokeWidth={2} aria-hidden />
        <span>{recStable ? t('status_rec_stable') : t('status_rec_idle')}</span>
      </div>

      {sessionActive && forensicSession ? (
        <>
          <div className={`${styles.pill} ${styles.pillMeta}`} title={sessionIdShow}>
            <Clock size={13} strokeWidth={2} aria-hidden />
            <span className={styles.pillMetaText}>
              {formatDurationMs(durationMs, lang)}
              <span className={styles.pillMetaSep} aria-hidden>
                ·
              </span>
              <Hand size={13} strokeWidth={2} aria-hidden />
              <span>{gestureCount}</span>
            </span>
          </div>
          <div className={`${styles.pill} ${styles.pillMeta}`} title={t('session_fps_line')}>
            <Activity size={13} strokeWidth={2} aria-hidden />
            <span className={styles.pillMetaMono}>
              {fpsLabel}
              {fpsLabel !== '—' ? ` ${t('cam_fps')}` : ''}
            </span>
          </div>
          <div className={`${styles.pill} ${styles.pillMeta}`} title={sessionIdShow}>
            <Hash size={13} strokeWidth={2} aria-hidden />
            <span className={styles.pillMetaMono}>{idCompact}</span>
          </div>
          <div className={`${styles.pill} ${styles.pillMeta}`}>
            <Globe size={13} strokeWidth={2} aria-hidden />
            <span>{lang === 'ru' ? t('lang_switch_ru') : t('lang_switch_uz')}</span>
          </div>
        </>
      ) : null}
    </div>
  )
})
