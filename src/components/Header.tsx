import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Wifi, WifiOff, Brain } from 'lucide-react'
import type { SystemStatus } from '../types'
import styles from './Header.module.css'

interface Props {
  status: SystemStatus
}

export default function Header({ status }: Props) {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <div className={styles.logo}>
          <Shield size={20} strokeWidth={1.5} />
        </div>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Forensic Sign Translator</h1>
          <span className={styles.subtitle}>AI Forensic Intelligence System · v2.4.1</span>
        </div>
      </div>

      {/* Static mode badge — single language, no tabs */}
      <div className={styles.center}>
        <div className={styles.modeBadge}>
          <span className={styles.modeFlag}>🇺🇿</span>
          Uzbek Emergency Sign Mode
        </div>
      </div>

      <div className={styles.right}>
        {/* AI listening status */}
        <motion.div
          className={`${styles.statusBadge} ${status.isListening ? styles.statusActive : styles.statusIdle}`}
          animate={status.isListening ? { opacity: [1, 0.5, 1] } : { opacity: 1 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          {status.isListening ? (
            <><Wifi size={13} strokeWidth={2} /> AI Listening</>
          ) : (
            <><WifiOff size={13} strokeWidth={2} /> Standby</>
          )}
        </motion.div>

        {/* AI thinking indicator */}
        <AnimatePresence>
          {status.aiState === 'thinking' && (
            <motion.div
              className={styles.processingBadge}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                style={{ display: 'flex' }}
              >
                <Brain size={12} strokeWidth={2} />
              </motion.div>
              Analyzing
            </motion.div>
          )}
        </AnimatePresence>

        <div className={styles.sessionInfo}>
          <span className={styles.sessionLabel}>SESSION</span>
          <span className={styles.sessionId}>FST-{Date.now().toString(36).toUpperCase().slice(-6)}</span>
        </div>
      </div>
    </header>
  )
}
