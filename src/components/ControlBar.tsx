import { motion } from 'framer-motion'
import { Play, Square } from 'lucide-react'
import type { Lang } from '../i18n'
import { useT } from '../i18n'
import styles from './ControlBar.module.css'

interface Props {
  lang: Lang
  sessionActive: boolean
  onStart: () => void
  onStop: () => void
}

export default function ControlBar({ lang, sessionActive, onStart, onStop }: Props) {
  const t = useT(lang)

  return (
    <div className={styles.bar} role="toolbar" aria-label={t('controls_toolbar')}>
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
  )
}
