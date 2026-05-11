import { AnimatePresence, motion } from 'framer-motion'
import { Brain, Ear, Lock, Volume2, VolumeX } from 'lucide-react'
import type { AIState, SystemStatus } from '../types'
import styles from './AnalysisPanel.module.css'

interface Props {
  status: SystemStatus
  onToggleVoice: () => void
}

const STATE_META: Record<AIState, { label: string; color: string }> = {
  idle: { label: 'IDLE', color: 'var(--text-muted)' },
  listening: { label: 'LISTENING', color: 'var(--cyan)' },
  thinking: { label: 'THINKING', color: 'var(--amber)' },
  locked: { label: 'LOCKED', color: 'var(--green)' },
}

function stateIcon(aiState: AIState) {
  if (aiState === 'listening') {
    return <Ear size={11} strokeWidth={2.4} />
  }

  if (aiState === 'thinking') {
    return <Brain size={11} strokeWidth={2.4} />
  }

  if (aiState === 'locked') {
    return <Lock size={11} strokeWidth={2.4} />
  }

  return <span className={styles.stateDot} />
}

export default function AnalysisPanel({ status, onToggleVoice }: Props) {
  const stateMeta = STATE_META[status.aiState]
  const voiceLabel = (
    status.voiceStatus === 'speaking' ? 'Speaking' :
    status.voiceStatus === 'muted' ? 'Muted' :
    status.voiceStatus === 'unavailable' ? 'Unavailable' :
    'Ready'
  )

  return (
    <div className={styles.panel}>
      <div className={styles.section}>
        <span className={styles.label}>AI State</span>
        <motion.div
          className={styles.stateChip}
          style={{ '--chip-color': stateMeta.color } as React.CSSProperties}
          animate={status.aiState === 'thinking' ? { boxShadow: ['0 0 0 rgba(0,0,0,0)', '0 0 24px rgba(255,190,30,0.12)', '0 0 0 rgba(0,0,0,0)'] } : undefined}
          transition={{ duration: 1.4, repeat: Infinity }}
        >
          {stateIcon(status.aiState)}
          <span>{stateMeta.label}</span>
          {!status.modelReady && status.isActive && (
            <span className={styles.metaHint}>Preparing model</span>
          )}
        </motion.div>
      </div>

      <div className={styles.divider} />

      <div className={styles.section}>
        <span className={styles.label}>Gesture</span>
        <AnimatePresence mode="wait">
          <motion.div
            key={status.currentGesture || status.aiState}
            className={styles.valueCard}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            <span className={`${styles.valuePrimary} ${status.aiState === 'locked' ? styles.valueLocked : ''}`}>
              {status.currentGesture || 'Waiting for gesture...'}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className={styles.divider} />

      <div className={styles.section}>
        <span className={styles.label}>Translation</span>
        <AnimatePresence mode="wait">
          <motion.div
            key={status.currentTranslation || 'empty'}
            className={`${styles.valueCard} ${styles.translationCard}`}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
          >
            <span className={styles.translationText}>
              {status.currentTranslation || 'Waiting for gesture...'}
            </span>
            <span className={styles.translationHint}>Show one gesture, then return hands down.</span>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className={styles.divider} />

      <div className={styles.section}>
        <div className={styles.rowBetween}>
          <span className={styles.label}>Confidence</span>
          <span className={styles.confidenceValue}>{status.confidence}%</span>
        </div>
        <div className={styles.confTrack}>
          <motion.div
            className={styles.confFill}
            animate={{ width: `${status.confidence}%` }}
            transition={{ duration: 0.32, ease: 'easeOut' }}
          />
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.section}>
        <div className={styles.rowBetween}>
          <span className={styles.label}>Voice Status</span>
          <motion.button
            className={`${styles.voiceToggle} ${status.voiceEnabled ? styles.voiceOn : styles.voiceOff}`}
            onClick={onToggleVoice}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            {status.voiceEnabled ? 'Voice On' : 'Voice Off'}
          </motion.button>
        </div>
        <div className={styles.voiceRow}>
          {status.voiceEnabled ? (
            <Volume2 size={14} strokeWidth={1.8} />
          ) : (
            <VolumeX size={14} strokeWidth={1.8} />
          )}
          <span className={styles.voiceValue}>{voiceLabel}</span>
        </div>
      </div>
    </div>
  )
}
