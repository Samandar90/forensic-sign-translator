import { AnimatePresence, motion } from 'framer-motion'
import { Brain, Shield, Wifi, WifiOff } from 'lucide-react'
import type { SystemStatus } from '../types'
import { MODE_LABEL } from '../utils/session'
import styles from './Header.module.css'

interface Props {
  status: SystemStatus
}

export default function Header({ status }: Props) {
  const showThinking = status.aiState === 'thinking'

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <div className={styles.logo}>
          <Shield size={20} strokeWidth={1.5} />
        </div>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Forensic Sign Translator</h1>
          <span className={styles.subtitle}>Emergency communication intelligence interface</span>
        </div>
      </div>

      <div className={styles.center}>
        <div className={styles.modeBadge}>{MODE_LABEL}</div>
      </div>

      <div className={styles.right}>
        <motion.div
          className={`${styles.statusBadge} ${status.isListening ? styles.statusActive : styles.statusIdle}`}
          animate={status.isListening ? { opacity: [1, 0.55, 1] } : { opacity: 1 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          {status.isListening ? (
            <><Wifi size={13} strokeWidth={2} /> AI Listening</>
          ) : (
            <><WifiOff size={13} strokeWidth={2} /> Standby</>
          )}
        </motion.div>

        <AnimatePresence>
          {showThinking && (
            <motion.div
              className={styles.processingBadge}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
                style={{ display: 'flex' }}
              >
                <Brain size={12} strokeWidth={2} />
              </motion.div>
              Analyzing
            </motion.div>
          )}
        </AnimatePresence>

        <div className={styles.sessionInfo}>
          <span className={styles.sessionLabel}>Session</span>
          <span className={styles.sessionId}>{status.sessionId}</span>
        </div>
      </div>
    </header>
  )
}
