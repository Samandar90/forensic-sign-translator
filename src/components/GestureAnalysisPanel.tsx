import { memo, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Activity, Hand, Scan, Loader } from 'lucide-react'
import type { Lang, TranslationKey } from '../i18n'
import { useT } from '../i18n'
import type { VisionDetectionState, MultiHandGestureSnapshot, HandSlotAnalysis } from '../types'
import type { StableGestureResult } from '../lib/gestures/gestureTypes'
import { FINGER_ORDER } from '../lib/detection/handLandmarker'
import styles from './GestureAnalysisPanel.module.css'

const GESTURE_NAME_KEY: Record<NonNullable<StableGestureResult['id']>, TranslationKey> = {
  LIKE: 'gesture_name_like',
  PEACE: 'gesture_name_peace',
  HELLO: 'gesture_name_hello',
  STOP: 'gesture_name_stop',
  FIST: 'gesture_name_fist',
}

const GESTURE_EMOJI: Record<NonNullable<StableGestureResult['id']>, string> = {
  LIKE: '👍',
  PEACE: '✌️',
  HELLO: '👋',
  STOP: '✋',
  FIST: '👊',
}

interface Props {
  lang: Lang
  sessionActive: boolean
  cameraOn: boolean
  visionState: VisionDetectionState
  handCount: number
  personPresent: boolean
  multiSnapshot: MultiHandGestureSnapshot | null
  showIntelligenceDebug?: boolean
}

function handsSummaryKey(n: number): TranslationKey {
  if (n <= 0) return 'analysis_hands_0'
  if (n === 1) return 'analysis_hands_1'
  return 'analysis_hands_2'
}

function HandCard({
  slot,
  t,
  uncertain,
}: {
  slot: HandSlotAnalysis
  t: (k: TranslationKey) => string
  uncertain?: boolean
}) {
  const title = slot.side === 'Left' ? t('analysis_hand_card_left') : t('analysis_hand_card_right')

  const gesture = slot.stableGesture
  const gestureLabel = gesture ? t(GESTURE_NAME_KEY[gesture.id]) : t('analysis_no_gesture')

  return (
    <article className={styles.handCard} data-side={slot.side}>
      <div className={styles.handCardHead}>
        <span className={styles.handCardTitle}>{title}</span>
        <span className={styles.handCardBadge}>{slot.present ? t('analysis_detected') : t('analysis_not_detected')}</span>
      </div>
      {slot.present ? (
        <>
          <div className={styles.gestureRow}>
            {gesture && <span className={styles.gestureIcon}>{GESTURE_EMOJI[gesture.id]}</span>}
            <div>
              <p className={styles.gestureName}>{gestureLabel}</p>
              {gesture && (
                <div className={styles.confBarWrap}>
                  <div className={styles.confBar} style={{ width: `${gesture.confidencePct}%` }} />
                  <span className={styles.confText}>
                    {t('analysis_confidence')} {gesture.confidencePct}%
                  </span>
                </div>
              )}
              {!gesture && uncertain && (
                <p className={styles.uncertainHint}>{t('analysis_gesture_uncertain')}</p>
              )}
            </div>
          </div>
          <p className={styles.fingerSummary}>
            {t('analysis_fingers_open_count')}: {slot.openFingerCount}
          </p>
          <div className={styles.chips}>
            {FINGER_ORDER.map(name => {
              const open = slot.fingerStates?.[name] === 'open'
              return (
                <span key={name} className={`${styles.chip} ${open ? styles.chipOpen : styles.chipClosed}`}>
                  <span className={styles.chipLabel}>{t(`res_finger_${name}` as TranslationKey)}</span>
                  <span className={styles.chipVal}>{t(open ? 'res_finger_open' : 'res_finger_closed')}</span>
                </span>
              )
            })}
          </div>
        </>
      ) : (
        <p className={styles.absent}>{t('analysis_not_detected')}</p>
      )}
    </article>
  )
}

export default memo(function GestureAnalysisPanel({
  lang,
  sessionActive,
  cameraOn,
  visionState,
  handCount,
  personPresent,
  multiSnapshot,
  showIntelligenceDebug = false,
}: Props) {
  const t = useT(lang)

  const statusKey = useMemo(() => {
    if (!sessionActive) return 'analysis_idle' as const
    if (!cameraOn) return 'analysis_idle' as const
    if (visionState === 'loading_models') return 'analysis_loading_models' as const
    if (visionState === 'initializing') return 'analysis_initializing' as const
    if (visionState === 'error') return 'analysis_error' as const
    if (visionState !== 'ready') return 'analysis_idle' as const
    return null
  }, [sessionActive, cameraOn, visionState])

  const activeStatus = useMemo(() => {
    if (statusKey) return t(statusKey)
    return sessionActive && cameraOn && visionState === 'ready' ? t('analysis_status_active') : t('analysis_status_wait')
  }, [statusKey, sessionActive, cameraOn, visionState, t])

  const mainGesture = useMemo(() => {
    if (multiSnapshot?.primaryStable) return t(GESTURE_NAME_KEY[multiSnapshot.primaryStable.id])
    if (handCount > 0 && sessionActive && cameraOn && visionState === 'ready') {
      return t('analysis_gesture_uncertain')
    }
    return t('analysis_no_gesture')
  }, [multiSnapshot, t, handCount, sessionActive, cameraOn, visionState])

  const secondaryLine = useMemo(() => {
    if (!multiSnapshot?.secondaryStable) return null
    return `${t('analysis_secondary')}: ${t(GESTURE_NAME_KEY[multiSnapshot.secondaryStable.id])}`
  }, [multiSnapshot, t])

  const slots = multiSnapshot ?? null
  const liveVision =
    !statusKey && sessionActive && cameraOn && visionState === 'ready'
  const uncertainLeft = Boolean(liveVision && slots?.left.present && !slots.left.stableGesture)
  const uncertainRight = Boolean(liveVision && slots?.right.present && !slots.right.stableGesture)

  return (
    <motion.section
      className={styles.shell}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      aria-label={t('analysis_title')}
    >
      <header className={styles.panelHeader}>
        <div className={styles.headIcon} aria-hidden>
          <Scan size={18} strokeWidth={1.65} />
        </div>
        <div>
          <h2 className={styles.title}>{t('analysis_title')}</h2>
          <p className={styles.sub}>{activeStatus}</p>
        </div>
      </header>

      {statusKey ? (
        <div className={`${styles.bodyScroll} scroll-y-auto`}>
          <div className={styles.waitEmpty}>
            <div
              className={styles.waitIcon}
              data-tone={
                statusKey === 'analysis_error'
                  ? 'error'
                  : statusKey === 'analysis_loading_models' || statusKey === 'analysis_initializing'
                    ? 'loading'
                    : 'muted'
              }
            >
              {statusKey === 'analysis_loading_models' || statusKey === 'analysis_initializing' ? (
                <Loader size={28} strokeWidth={1.5} className={styles.waitSpinner} aria-hidden />
              ) : (
                <Scan size={28} strokeWidth={1.5} aria-hidden />
              )}
            </div>
            <p className={styles.waitTitle}>{t(statusKey)}</p>
            {statusKey === 'analysis_idle' && <p className={styles.waitHint}>{t('analysis_empty_hint')}</p>}
          </div>
        </div>
      ) : (
        <div className={`${styles.bodyScroll} scroll-y-auto`}>
          <div className={styles.summary}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>
                <Activity size={14} strokeWidth={1.75} aria-hidden />
                {t('analysis_summary_hands')}
              </div>
              <p className={styles.summaryValue}>{t(handsSummaryKey(handCount))}</p>
              <p className={styles.summaryMeta}>
                {t('analysis_active_label')}: <strong>{mainGesture}</strong>
              </p>
              {secondaryLine && <p className={styles.summarySub}>{secondaryLine}</p>}
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>
                <Hand size={14} strokeWidth={1.75} aria-hidden />
                {t('analysis_person')}
              </div>
              <p className={styles.summaryValue}>{personPresent ? t('res_person_yes') : t('res_person_no')}</p>
            </div>
          </div>

          <div className={styles.handGrid}>
            <HandCard
              slot={
                slots?.left ?? {
                  side: 'Left',
                  present: false,
                  fingerStates: null,
                  stableGesture: null,
                  openFingerCount: 0,
                }
              }
              t={t}
              uncertain={uncertainLeft}
            />
            <HandCard
              slot={
                slots?.right ?? {
                  side: 'Right',
                  present: false,
                  fingerStates: null,
                  stableGesture: null,
                  openFingerCount: 0,
                }
              }
              t={t}
              uncertain={uncertainRight}
            />
          </div>
          {(import.meta.env.DEV && showIntelligenceDebug && multiSnapshot?.intelligenceDebug) ? (
            <div className={styles.devIntel} aria-label={t('analysis_dev_intel')}>
              <p className={styles.devIntelTitle}>{t('analysis_dev_intel')}</p>
              <pre className={styles.devIntelPre}>
                {JSON.stringify(multiSnapshot.intelligenceDebug, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
      )}
    </motion.section>
  )
})
