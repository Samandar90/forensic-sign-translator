import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield } from 'lucide-react'
import type { Lang } from '../i18n'
import { useT } from '../i18n'
import styles from './LoadingScreen.module.css'

interface Props {
  lang: Lang
  onComplete: () => void
  /** Optional second line during boot (e.g. workspace restore). */
  bootSubline?: string | null
}

const TOTAL_MS = 3200
const PROGRESS_MS = 2800

export default function LoadingScreen({ lang, onComplete, bootSubline }: Props) {
  const t = useT(lang)

  const [progress, setProgress] = useState(0)
  const [lineIdx,  setLineIdx]  = useState(0)
  const [ready,    setReady]    = useState(false)

  const BOOT_LINES = [t('boot_1'), t('boot_2'), t('boot_3'), t('boot_4'), t('boot_5')]

  useEffect(() => {
    const start = performance.now()
    let raf: number
    const tick = (now: number) => {
      const pct = Math.min(100, Math.round(((now - start) / PROGRESS_MS) * 100))
      setProgress(pct)
      if (now - start < PROGRESS_MS) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setLineIdx(i => (i < BOOT_LINES.length - 1 ? i + 1 : i))
    }, PROGRESS_MS / BOOT_LINES.length)
    return () => clearInterval(interval)
  }, [BOOT_LINES.length])

  useEffect(() => {
    const t1 = setTimeout(() => setReady(true),      PROGRESS_MS + 100)
    const t2 = setTimeout(() => onComplete(),         TOTAL_MS)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onComplete])

  return (
    <motion.div
      className={styles.screen}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
    >
      <div className={styles.center}>
        {/* Logo */}
        <motion.div
          className={styles.logoWrap}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'backOut' }}
        >
          <div className={styles.logoRing} aria-hidden />
          <Shield size={28} className={styles.logoIcon} strokeWidth={1.5} />
        </motion.div>

        {/* Title */}
        <motion.div
          className={styles.titleBlock}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.2 }}
        >
          <h1 className={styles.appName}>Forensic Sign Translator</h1>
          <p className={styles.appSub}>v2.4.1</p>
        </motion.div>

        {bootSubline ? (
          <motion.p
            className={styles.bootSubline}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.28 }}
          >
            {bootSubline}
          </motion.p>
        ) : null}

        {/* Boot line */}
        <motion.div
          className={styles.bootLine}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={lineIdx}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
            >
              {BOOT_LINES[lineIdx]}
            </motion.span>
          </AnimatePresence>
        </motion.div>

        {/* Progress */}
        <motion.div
          className={styles.progressWrap}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div className={styles.track}>
            <div className={styles.fill} style={{ width: `${progress}%` }} />
          </div>
          <div className={styles.progressRow}>
            <AnimatePresence mode="wait">
              {ready ? (
                <motion.span key="ready" className={styles.readyText}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  ✓ {t('boot_5')}
                </motion.span>
              ) : (
                <motion.span key="pct" className={styles.pctText} exit={{ opacity: 0 }}>
                  {progress}%
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
