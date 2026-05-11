import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield } from 'lucide-react'
import styles from './LoadingScreen.module.css'

interface Props {
  onComplete: () => void
}

// ── Boot log sequence ─────────────────────────────────────────────────────────

const BOOT_LINES = [
  { text: 'Initializing secure forensic session...',   delay: 400,  duration: 600  },
  { text: 'Loading TensorFlow gesture model...',       delay: 1100, duration: 800  },
  { text: 'Calibrating MediaPipe hand tracking...',    delay: 2050, duration: 700  },
  { text: 'Establishing neural inference pipeline...', delay: 2900, duration: 600  },
  { text: 'Mounting speech synthesis engine...',       delay: 3600, duration: 500  },
  { text: 'System ready.',                             delay: 4250, duration: 400  },
]

const TOTAL_MS    = 4900   // completion fires after this
const PROGRESS_MS = 4400   // progress bar fills by this point

// ── Neural network node positions (% relative to SVG viewBox) ────────────────

const NODES: { cx: number; cy: number; r: number; delay: number }[] = [
  { cx: 50,  cy: 50,  r: 5,   delay: 0    }, // center — logo node
  { cx: 22,  cy: 28,  r: 3,   delay: 0.3  },
  { cx: 78,  cy: 22,  r: 3.5, delay: 0.5  },
  { cx: 15,  cy: 62,  r: 2.5, delay: 0.7  },
  { cx: 84,  cy: 68,  r: 3,   delay: 0.4  },
  { cx: 38,  cy: 15,  r: 2.5, delay: 0.6  },
  { cx: 65,  cy: 82,  r: 3,   delay: 0.8  },
  { cx: 88,  cy: 42,  r: 2,   delay: 0.9  },
  { cx: 12,  cy: 44,  r: 2.5, delay: 1.0  },
  { cx: 55,  cy: 20,  r: 2,   delay: 0.35 },
  { cx: 32,  cy: 78,  r: 2.5, delay: 0.75 },
  { cx: 72,  cy: 55,  r: 2,   delay: 0.55 },
]

const EDGES: [number, number][] = [
  [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6],
  [1, 8], [1, 9], [2, 4], [2, 11], [3, 10], [4, 7],
  [5, 9], [6, 10], [7, 11], [8, 3], [9, 1],
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function BootLine({ text, startDelay }: { text: string; startDelay: number }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), startDelay)
    return () => clearTimeout(t)
  }, [startDelay])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={styles.bootLine}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <motion.span
            className={styles.bootDot}
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
          {text}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LoadingScreen({ onComplete }: Props) {
  const [progress, setProgress] = useState(0)
  const [ready,    setReady]    = useState(false)

  // Animate progress bar
  useEffect(() => {
    const start = performance.now()
    let raf: number

    const tick = (now: number) => {
      const elapsed = now - start
      setProgress(Math.min(100, Math.round((elapsed / PROGRESS_MS) * 100)))
      if (elapsed < PROGRESS_MS) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Flash "READY" then exit
  useEffect(() => {
    const t1 = setTimeout(() => setReady(true),    4200)
    const t2 = setTimeout(() => onComplete(),       TOTAL_MS)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onComplete])

  return (
    <motion.div
      className={styles.screen}
      exit={{ opacity: 0, filter: 'blur(12px)', scale: 1.02 }}
      transition={{ duration: 0.65, ease: 'easeInOut' }}
    >
      {/* Ambient radial glow */}
      <div className={styles.ambientGlow} />

      {/* Grid overlay */}
      <div className={styles.gridOverlay} />

      {/* Horizontal scan line */}
      <motion.div
        className={styles.hScanLine}
        animate={{ top: ['0%', '100%', '0%'] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
      />

      {/* ── Center visualization ── */}
      <div className={styles.center}>

        {/* Neural network SVG */}
        <div className={styles.netWrapper}>
          <svg viewBox="0 0 100 100" className={styles.netSvg} preserveAspectRatio="xMidYMid meet">
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>

            {/* Edges */}
            {EDGES.map(([a, b], i) => {
              const na = NODES[a], nb = NODES[b]
              return (
                <motion.line
                  key={i}
                  x1={na.cx} y1={na.cy}
                  x2={nb.cx} y2={nb.cy}
                  stroke="rgba(0,212,255,0.25)"
                  strokeWidth="0.4"
                  filter="url(#glow)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.6, delay: Math.max(na.delay, nb.delay) + 0.4 }}
                />
              )
            })}

            {/* Nodes */}
            {NODES.map((n, i) => (
              <motion.circle
                key={i}
                cx={n.cx} cy={n.cy} r={n.r}
                fill={i === 0 ? 'rgba(0,212,255,0.9)' : 'rgba(0,212,255,0.55)'}
                filter="url(#glow)"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.35, delay: n.delay, ease: 'backOut' }}
                style={{ transformOrigin: `${n.cx}px ${n.cy}px` }}
              />
            ))}

            {/* Pulse rings from center */}
            {[0, 1, 2].map(i => (
              <motion.circle
                key={`ring-${i}`}
                cx={50} cy={50} r={6}
                fill="none"
                stroke="rgba(0,212,255,0.18)"
                strokeWidth="0.5"
                initial={{ scale: 1, opacity: 0.7 }}
                animate={{ scale: [1, 6, 8], opacity: [0.5, 0.1, 0] }}
                transition={{
                  duration: 2.8,
                  repeat: Infinity,
                  delay: i * 0.9,
                  ease: 'easeOut',
                }}
                style={{ transformOrigin: '50px 50px' }}
              />
            ))}
          </svg>

          {/* Center logo */}
          <motion.div
            className={styles.logoCenter}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: 'backOut' }}
          >
            <motion.div
              className={styles.logoRing}
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className={styles.logoRingOuter}
              animate={{ rotate: -360 }}
              transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
            />
            <Shield size={32} strokeWidth={1} className={styles.logoIcon} />
          </motion.div>
        </div>

        {/* Title */}
        <motion.div
          className={styles.titleBlock}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          <h1 className={styles.appTitle}>Forensic Sign Translator</h1>
          <p className={styles.appSubtitle}>AI Forensic Intelligence System · v2.4.1</p>
        </motion.div>

        {/* Boot log */}
        <motion.div
          className={styles.bootLog}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          {BOOT_LINES.map((line, i) => (
            <BootLine key={i} text={line.text} startDelay={line.delay} />
          ))}
        </motion.div>

        {/* Progress bar */}
        <div className={styles.progressWrap}>
          <div className={styles.progressTrack}>
            <motion.div
              className={styles.progressFill}
              style={{ width: `${progress}%` }}
            >
              <div className={styles.progressGlow} />
            </motion.div>
          </div>
          <div className={styles.progressRow}>
            <AnimatePresence mode="wait">
              {ready ? (
                <motion.span
                  key="ready"
                  className={styles.progressReady}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: [0, 1, 0.6, 1], scale: 1 }}
                  transition={{ duration: 0.4 }}
                >
                  ✦ SYSTEM READY
                </motion.span>
              ) : (
                <motion.span key="pct" className={styles.progressPct} exit={{ opacity: 0 }}>
                  {progress}%
                </motion.span>
              )}
            </AnimatePresence>
            <span className={styles.progressLabel}>INITIALIZING</span>
          </div>
        </div>

      </div>

      {/* Corner markers */}
      <div className={`${styles.corner} ${styles.cTL}`} />
      <div className={`${styles.corner} ${styles.cTR}`} />
      <div className={`${styles.corner} ${styles.cBL}`} />
      <div className={`${styles.corner} ${styles.cBR}`} />

      {/* Session ID bottom right */}
      <div className={styles.sessionTag}>
        FST-{Math.random().toString(36).slice(2, 8).toUpperCase()}
      </div>
    </motion.div>
  )
}
