import { motion, AnimatePresence } from 'framer-motion'
import { Volume2, VolumeX, Mic } from 'lucide-react'
import type { Lang, TranslationKey } from '../i18n'
import { useT } from '../i18n'
import type { VisionDetectionState } from '../types'
import { visionIsBootstrapping } from '../types'
import type { HandDetectionResult } from '../lib/detection/handLandmarker'
import { FINGER_ORDER } from '../lib/detection/handLandmarker'
import type { DemoGestureId, DemoGestureResult } from '../lib/gestures/demoGestureMatcher'
import styles from './ResultPanel.module.css'

const GESTURE_TITLE_KEY: Record<DemoGestureId, TranslationKey> = {
  OPEN_PALM: 'res_gesture_open_palm',
  THUMBS_UP: 'res_gesture_thumbs_up',
  PEACE: 'res_gesture_peace',
  FIST: 'res_gesture_fist',
}

const GESTURE_EMOJI: Record<DemoGestureId, string> = {
  OPEN_PALM: '✋',
  THUMBS_UP: '👍',
  PEACE: '✌️',
  FIST: '👊',
}

interface Props {
  lang: Lang
  sessionActive: boolean
  cameraOn: boolean
  visionState: VisionDetectionState
  handCount: number
  personPresent: boolean
  primaryHand: HandDetectionResult | null
  demoGesture: DemoGestureResult | null
  voiceEnabled: boolean
  speechOk: boolean
  onToggleVoice: () => void
  onSpeak: () => void
}

export default function ResultPanel({
  lang,
  sessionActive,
  cameraOn,
  visionState,
  handCount,
  personPresent,
  primaryHand,
  demoGesture,
  voiceEnabled,
  speechOk,
  onToggleVoice,
  onSpeak,
}: Props) {
  const t = useT(lang)

  const overallLine = (() => {
    if (!sessionActive) return t('res_overall_off')
    if (!cameraOn) return t('res_overall_session')
    if (visionIsBootstrapping(visionState)) return t('res_overall_loading')
    if (visionState === 'error') return t('res_overall_error')
    if (visionState === 'ready') return t('res_overall_live')
    return t('res_overall_session')
  })()

  const personLine = (() => {
    if (!sessionActive || !cameraOn) return t('res_person_na')
    if (visionIsBootstrapping(visionState)) return t('res_person_pending')
    if (visionState === 'error') return t('res_person_na')
    if (!personPresent) return t('res_person_no')
    return t('res_person_yes')
  })()

  const handsLine =
    !sessionActive || !cameraOn || visionState !== 'ready'
      ? t('res_hands_na')
      : handCount > 0
        ? t('res_hands_yes')
        : t('res_hands_wait')

  const showFingers =
    sessionActive && cameraOn && visionState === 'ready' && handCount > 0 && primaryHand !== null

  const handSideLine = (() => {
    if (!showFingers || !primaryHand) return t('res_fingers_na')
    if (primaryHand.displaySide === 'Left') return t('res_hand_left')
    if (primaryHand.displaySide === 'Right') return t('res_hand_right')
    return t('res_hand_unknown')
  })()

  const fingerLine = (name: (typeof FINGER_ORDER)[number]): string => {
    if (!primaryHand) return ''
    const open = primaryHand.fingerStates[name] === 'open'
    const label = t(`res_finger_${name}` as TranslationKey)
    const state = t(open ? 'res_finger_open' : 'res_finger_closed')
    return `${label}: ${state}`
  }

  const showGestureCard =
    sessionActive && cameraOn && visionState === 'ready' && handCount > 0

  const speakDisabled = !voiceEnabled || !speechOk

  return (
    <aside className={styles.panel} aria-labelledby="result-title">
      <h2 id="result-title" className={styles.title}>
        {t('result_title')}
      </h2>

      {showGestureCard && (
        <section className={styles.gestureHero} aria-label={t('res_gesture_recognized_title')}>
          <div className={styles.gestureHeroHeader}>
            <span className={styles.gestureHeroRule} aria-hidden />
            <span className={styles.gestureHeroTitle}>{t('res_gesture_recognized_title')}</span>
            <span className={styles.gestureHeroRule} aria-hidden />
          </div>
          <p className={styles.gestureHeroHint}>{t('res_gesture_demo_block_hint')}</p>
          <AnimatePresence mode="wait">
            <motion.div
              key={demoGesture?.id ?? 'none'}
              className={`${styles.gestureCard} ${demoGesture ? styles.gestureCardActive : ''}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {demoGesture ? (
                <>
                  <div className={styles.gestureRow}>
                    <span className={styles.gestureEmoji} aria-hidden>
                      {GESTURE_EMOJI[demoGesture.id]}
                    </span>
                    <div className={styles.gestureTextCol}>
                      <p className={styles.gestureName}>{t(GESTURE_TITLE_KEY[demoGesture.id])}</p>
                      <p className={styles.gestureConfidence}>
                        {t('res_confidence_label')}: {demoGesture.confidencePct}%
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <p className={styles.gestureEmpty}>{t('res_gesture_none')}</p>
              )}
            </motion.div>
          </AnimatePresence>
        </section>
      )}

      <dl className={styles.list}>
        <div className={styles.row}>
          <dt>{t('res_label_status')}</dt>
          <dd>{overallLine}</dd>
        </div>
        <div className={styles.row}>
          <dt>{t('res_label_person')}</dt>
          <dd>{personLine}</dd>
        </div>
        <div className={styles.row}>
          <dt>{t('res_label_hands')}</dt>
          <dd>{handsLine}</dd>
        </div>
        <div className={styles.row}>
          <dt>{t('res_label_hand')}</dt>
          <dd className={showFingers ? undefined : styles.muted}>{handSideLine}</dd>
        </div>
        <div className={styles.row}>
          <dt>{t('res_label_fingers')}</dt>
          <dd className={!showFingers ? styles.muted : undefined}>
            {showFingers && primaryHand ? (
              <ul className={styles.fingerList}>
                {FINGER_ORDER.map(name => (
                  <li key={name}>{fingerLine(name)}</li>
                ))}
              </ul>
            ) : (
              t('res_fingers_na')
            )}
          </dd>
        </div>
      </dl>

      <p className={styles.modelNote}>{t('res_model_note')}</p>

      <div className={styles.actions}>
        <div className={styles.voiceRow}>
          <button
            type="button"
            className={`${styles.voiceToggle} ${voiceEnabled ? styles.voiceOn : ''}`}
            onClick={onToggleVoice}
            aria-pressed={voiceEnabled}
          >
            {voiceEnabled ? <Volume2 size={16} strokeWidth={1.75} /> : <VolumeX size={16} strokeWidth={1.75} />}
            <span>{voiceEnabled ? t('voice_on') : t('voice_off')}</span>
          </button>
          <motion.button
            type="button"
            className={styles.speakBtn}
            disabled={speakDisabled}
            onClick={onSpeak}
            whileHover={speakDisabled ? undefined : { scale: 1.01 }}
            whileTap={speakDisabled ? undefined : { scale: 0.99 }}
          >
            <Mic size={15} strokeWidth={1.75} />
            {t('btn_speak')}
          </motion.button>
        </div>
      </div>
    </aside>
  )
}
