import { motion, AnimatePresence } from 'framer-motion'
import {
  Volume2, VolumeX, Lock, Brain, Ear, Loader, Zap,
} from 'lucide-react'
import type { SystemStatus, AIState } from '../types'
import styles from './AnalysisPanel.module.css'

interface Props {
  status:        SystemStatus
  onToggleVoice: () => void
}

// ── AI state config ───────────────────────────────────────────────────────────

const STATE_META: Record<AIState, { label: string; color: string; pulse: boolean }> = {
  idle:      { label: 'IDLE',            color: 'var(--text-muted)', pulse: false },
  loading:   { label: 'LOADING MODEL',   color: 'var(--cyan)',       pulse: true  },
  listening: { label: 'LISTENING',       color: 'var(--cyan)',       pulse: true  },
  thinking:  { label: 'ANALYZING',       color: '#ffbe1e',           pulse: true  },
  locked:    { label: 'GESTURE LOCKED',  color: 'var(--green)',      pulse: false },
}

function AIStateChip({ aiState }: { aiState: AIState }) {
  const { label, color, pulse } = STATE_META[aiState]
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={aiState}
        className={styles.stateChip}
        style={{ '--chip-color': color } as React.CSSProperties}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={{ duration: 0.18 }}
      >
        <motion.span
          className={styles.stateChipDot}
          animate={pulse ? { opacity: [1, 0.25, 1] } : { opacity: 1 }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
        {aiState === 'loading' && (
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }} style={{ display: 'flex' }}>
            <Loader size={10} strokeWidth={2.5} />
          </motion.div>
        )}
        {aiState === 'listening' && <Ear size={10} strokeWidth={2.5} />}
        {aiState === 'thinking'  && <Brain size={10} strokeWidth={2.5} />}
        {aiState === 'locked'    && <Lock size={10} strokeWidth={2.5} />}
        {label}
      </motion.div>
    </AnimatePresence>
  )
}

// ── Confidence bar ────────────────────────────────────────────────────────────

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 85 ? 'var(--green)' : value >= 65 ? 'var(--cyan)' : 'var(--red)'
  return (
    <div className={styles.confRow}>
      <div className={styles.confTrack}>
        <motion.div
          className={styles.confFill}
          style={{ background: color, boxShadow: `0 0 8px ${color}44` }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
      <motion.span
        key={value}
        className={styles.confNum}
        style={{ color }}
        initial={{ scale: 1.15 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        {value}%
      </motion.span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AnalysisPanel({ status, onToggleVoice }: Props) {
  return (
    <div className={styles.panel}>

      {/* ── AI State ── */}
      <div className={styles.section}>
        <span className={styles.label}>AI System</span>
        <AIStateChip aiState={status.aiState} />
      </div>

      <div className={styles.divider} />

      {/* ── Active Gesture ── */}
      <div className={styles.section}>
        <span className={styles.label}>Active Gesture</span>
        <AnimatePresence mode="wait">
          {status.aiState === 'thinking' ? (
            <motion.div key="thinking" className={styles.thinkingRow}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {[0,1,2].map(i => (
                <motion.span key={i} className={styles.thinkDot}
                  animate={{ opacity: [0.2, 1, 0.2], scaleY: [0.6, 1.2, 0.6] }}
                  transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.16 }} />
              ))}
              <span className={styles.thinkText}>Analyzing pattern...</span>
            </motion.div>
          ) : status.currentGesture ? (
            <motion.div key={status.currentGesture} className={styles.gestureRow}
              initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.28 }}>
              <span className={`${styles.gestureName} ${status.aiState === 'locked' ? styles.gestureNameLocked : ''}`}>
                {status.currentGesture}
              </span>
              {status.aiState === 'locked' && (
                <motion.span className={styles.lockedBadge}
                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
                  <Lock size={9} strokeWidth={2.5} /> LOCKED
                </motion.span>
              )}
            </motion.div>
          ) : (
            <motion.p key="idle" className={styles.dimText}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {status.isActive ? 'Waiting for gesture...' : 'Start session to begin'}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <div className={styles.divider} />

      {/* ── Live Translation ── */}
      <div className={styles.section}>
        <span className={styles.label}>Live Translation</span>
        <AnimatePresence mode="wait">
          {status.currentTranslation ? (
            <motion.div key={status.currentTranslation} className={styles.translationBox}
              initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.32 }}>
              <p className={styles.translationText}>"{status.currentTranslation}"</p>
              <span className={styles.translationSub}>Uzbek · AI Translated</span>
            </motion.div>
          ) : (
            <motion.p key="waiting" className={`${styles.dimText} ${styles.dimTextLg}`}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {status.aiState === 'listening' ? 'Kuting...' : 'Waiting for gesture...'}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <div className={styles.divider} />

      {/* ── Confidence ── */}
      <div className={styles.section}>
        <div className={styles.rowBetween}>
          <span className={styles.label}>Confidence</span>
          {status.confidence > 0 && (
            <span className={`${styles.confLabel} ${
              status.confidence >= 85 ? styles.confHigh :
              status.confidence >= 65 ? styles.confMed  : styles.confLow
            }`}>
              {status.confidence >= 85 ? 'HIGH' : status.confidence >= 65 ? 'MED' : 'LOW'}
            </span>
          )}
        </div>
        {status.confidence > 0
          ? <ConfidenceBar value={status.confidence} />
          : <p className={styles.dimText}>Threshold: 85%</p>
        }
      </div>

      <div className={styles.divider} />

      {/* ── Voice Output ── */}
      <div className={styles.section}>
        <div className={styles.rowBetween}>
          <div className={styles.voiceLabelRow}>
            {status.voiceEnabled
              ? <Volume2 size={13} strokeWidth={1.5} />
              : <VolumeX  size={13} strokeWidth={1.5} />
            }
            <span className={styles.label}>Voice Output</span>
          </div>
          <motion.button
            className={`${styles.toggleBtn} ${status.voiceEnabled ? styles.toggleOn : styles.toggleOff}`}
            onClick={onToggleVoice}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {status.voiceEnabled ? 'ON' : 'OFF'}
          </motion.button>
        </div>
        {status.voiceEnabled ? (
          <div className={styles.waveRow}>
            {[...Array(14)].map((_, i) => (
              <motion.div key={i} className={styles.wavebar}
                animate={status.aiState === 'locked' ? {
                  height: ['3px', `${5 + (i % 4) * 5}px`, '3px'],
                } : { height: '3px' }}
                transition={{ duration: 0.3 + (i % 3) * 0.1, repeat: Infinity, delay: i * 0.04, ease: 'easeInOut' }}
              />
            ))}
            <span className={styles.waveLabel}>
              {status.aiState === 'locked' ? 'Speaking...' : 'Ready'}
            </span>
          </div>
        ) : (
          <p className={styles.dimText}>Voice muted</p>
        )}
      </div>

      <div className={styles.divider} />

      {/* ── Mode info ── */}
      <div className={styles.section}>
        <div className={styles.rowBetween}>
          <span className={styles.label}>Mode</span>
        </div>
        <div className={styles.modeCard}>
          <div className={styles.modeTop}>
            <Zap size={13} strokeWidth={1.5} style={{ color: 'var(--cyan)' }} />
            <span className={styles.modeName}>Uzbek Emergency Sign</span>
          </div>
          <p className={styles.modeDesc}>
            {status.modelReady
              ? '4 gestures · TensorFlow · 85% threshold'
              : 'Loading TensorFlow model...'}
          </p>
        </div>
      </div>

    </div>
  )
}
