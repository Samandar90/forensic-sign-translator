import { memo } from 'react'
import { motion } from 'framer-motion'
import { Mic, Play, Square, Volume2, VolumeX } from 'lucide-react'
import type { Lang } from '../i18n'
import { useT } from '../i18n'
import styles from './ControlsBar.module.css'

interface Props {
  lang: Lang
  sessionActive: boolean
  voiceEnabled: boolean
  speechOk: boolean
  onStart: () => void
  onStop: () => void
  onToggleVoice: () => void
  onSpeakSummary: () => void
}

export default memo(function ControlsBar({
  lang,
  sessionActive,
  voiceEnabled,
  speechOk,
  onStart,
  onStop,
  onToggleVoice,
  onSpeakSummary,
}: Props) {
  const t = useT(lang)
  const speakDisabled = !voiceEnabled || !speechOk

  return (
    <div className={styles.row}>
      <div className={styles.center}>
        <motion.button
          type="button"
          className={styles.start}
          disabled={sessionActive}
          onClick={onStart}
          whileHover={sessionActive ? undefined : { scale: 1.02 }}
          whileTap={sessionActive ? undefined : { scale: 0.98 }}
        >
          <Play size={16} strokeWidth={2} fill="currentColor" aria-hidden />
          {t('btn_start')}
        </motion.button>
        <motion.button
          type="button"
          className={styles.stop}
          disabled={!sessionActive}
          onClick={onStop}
          whileHover={!sessionActive ? undefined : { scale: 1.02 }}
          whileTap={!sessionActive ? undefined : { scale: 0.98 }}
        >
          <Square size={14} strokeWidth={2} fill="currentColor" aria-hidden />
          {t('btn_stop')}
        </motion.button>
      </div>

      <div className={styles.voiceCol}>
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
          onClick={onSpeakSummary}
          whileHover={speakDisabled ? undefined : { scale: 1.02 }}
          whileTap={speakDisabled ? undefined : { scale: 0.98 }}
        >
          <Mic size={15} strokeWidth={1.75} />
          {t('btn_speak')}
        </motion.button>
      </div>
    </div>
  )
})
