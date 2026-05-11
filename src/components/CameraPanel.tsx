import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Play, Square, Scan, WifiOff, AlertTriangle, Loader, Hand } from 'lucide-react'
import type { SystemStatus } from '../types'
import type { CameraState } from '../hooks/useCamera'
import type { TrackingStatus, HandInfo } from '../hooks/useHandTracking'
import { useClock } from '../hooks/useClock'
import styles from './CameraPanel.module.css'

interface Props {
  videoRef:       React.RefObject<HTMLVideoElement | null>
  canvasRef:      React.RefObject<HTMLCanvasElement | null>
  cameraState:    CameraState
  errorMessage:   string
  trackingStatus: TrackingStatus
  handsDetected:  number
  handInfos:      HandInfo[]
  status:         SystemStatus
  onStart:        () => void
  onStop:         () => void
  onRetryCamera:  () => void
}

export default function CameraPanel({
  videoRef, canvasRef, cameraState, errorMessage,
  trackingStatus, handsDetected, handInfos,
  status, onStart, onStop, onRetryCamera,
}: Props) {
  const clock = useClock()
  const isLive = cameraState === 'active'

  return (
    <div className={styles.panel}>
      {/* ── Header bar ── */}
      <div className={styles.panelHeader}>
        <div className={styles.panelTitle}>
          <Camera size={14} strokeWidth={1.5} />
          Live Camera Feed
        </div>
        <div className={styles.indicators}>
          <span className={`${styles.dot} ${isLive ? styles.dotActive : styles.dotIdle}`} />
          <span className={styles.feedLabel}>
            {cameraState === 'requesting' ? 'CONNECTING' :
             isLive                        ? 'RECORDING'  :
             cameraState === 'denied'      ? 'BLOCKED'    :
             cameraState === 'unavailable' ? 'NO CAMERA'  :
             cameraState === 'error'       ? 'ERROR'      : 'STANDBY'}
          </span>
        </div>
      </div>

      {/* ── Viewport ── */}
      <div className={styles.viewport}>

        {/* Real video */}
        <motion.video
          ref={videoRef as React.RefObject<HTMLVideoElement>}
          className={styles.videoFeed}
          autoPlay playsInline muted
          initial={{ opacity: 0 }}
          animate={{ opacity: isLive ? 1 : 0 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
        />

        {/* MediaPipe hand tracking canvas */}
        <canvas
          ref={canvasRef}
          className={styles.trackingCanvas}
          style={{ opacity: trackingStatus === 'ready' ? 1 : 0 }}
        />

        {/* Grid */}
        <div className={styles.grid} />

        {/* Forensic corner brackets */}
        <div className={`${styles.corner} ${styles.cornerTL}`} />
        <div className={`${styles.corner} ${styles.cornerTR}`} />
        <div className={`${styles.corner} ${styles.cornerBL}`} />
        <div className={`${styles.corner} ${styles.cornerBR}`} />

        {/* ── State overlays ── */}
        <AnimatePresence mode="wait">
          {!status.isActive && cameraState === 'idle' && (
            <motion.div key="idle" className={styles.stateOverlay}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
              <div className={styles.cameraIcon}><Camera size={40} strokeWidth={0.8} /></div>
              <p className={styles.stateTitle}>Camera feed inactive</p>
              <p className={styles.stateSubtitle}>Click "Initialize Session" to begin</p>
              <p className={styles.stateHint}>Show one gesture, then lower your hands to register the next command.</p>
            </motion.div>
          )}

          {cameraState === 'requesting' && (
            <motion.div key="requesting" className={styles.stateOverlay}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}>
                <Loader size={36} strokeWidth={1} color="var(--cyan)" />
              </motion.div>
              <p className={styles.stateTitle} style={{ color: 'var(--cyan)' }}>Initializing camera...</p>
              <p className={styles.stateSubtitle}>Requesting device access</p>
            </motion.div>
          )}

          {cameraState === 'denied' && (
            <motion.div key="denied" className={styles.stateOverlay}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div style={{ color: 'var(--red)', marginBottom: 6 }}><WifiOff size={36} strokeWidth={1} /></div>
              <p className={styles.stateTitle} style={{ color: 'var(--red)' }}>Permission Denied</p>
              <p className={styles.stateSubtitle}>{errorMessage}</p>
              <button className={styles.retryBtn} onClick={onRetryCamera}>Retry Permission</button>
            </motion.div>
          )}

          {(cameraState === 'unavailable' || cameraState === 'error') && (
            <motion.div key="error" className={styles.stateOverlay}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div style={{ color: 'rgba(255,180,0,0.8)', marginBottom: 6 }}><AlertTriangle size={36} strokeWidth={1} /></div>
              <p className={styles.stateTitle} style={{ color: 'rgba(255,180,0,0.9)' }}>
                {cameraState === 'unavailable' ? 'No Camera Found' : 'Camera Error'}
              </p>
              <p className={styles.stateSubtitle}>{errorMessage}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Live forensic overlays (shown when camera active) ── */}
        <AnimatePresence>
          {isLive && (
            <motion.div key="overlays" className={styles.activeOverlays}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>

              {/* Top bar: AI ACTIVE + timestamp */}
              <div className={styles.overlayTop}>
                <div className={styles.overlayTopLeft}>
                  <motion.div className={styles.aiBadge}
                    animate={{ opacity: [1, 0.6, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
                    <span className={styles.aiBadgeDot} />
                    AI ACTIVE
                  </motion.div>
                  {trackingStatus === 'loading' && (
                    <motion.div className={styles.loadingBadge}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ display: 'flex' }}>
                        <Loader size={10} strokeWidth={2.5} />
                      </motion.div>
                      LOADING
                    </motion.div>
                  )}
                </div>
                <div className={styles.overlayTopRight}>
                  <span className={styles.liveTimestamp}>{clock}</span>
                </div>
              </div>

              {/* Hand detection strip */}
              <AnimatePresence>
                {handsDetected > 0 && trackingStatus === 'ready' && (
                  <motion.div className={styles.handStrip}
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
                    <motion.div className={styles.handStripPulse}
                      animate={{ opacity: [0, 0.35, 0] }} transition={{ duration: 1.5, repeat: Infinity }} />
                    <div className={styles.handStripLeft}>
                      <Hand size={12} strokeWidth={2} />
                      <span className={styles.handCount}>
                        {handsDetected} HAND{handsDetected > 1 ? 'S' : ''} DETECTED
                      </span>
                    </div>
                    <div className={styles.handStripRight}>
                      {handInfos.map((h, i) => (
                        <div key={i} className={styles.handChip}>
                          <span className={styles.handChipLabel}>{h.label}</span>
                          <span className={styles.handChipConf}>{Math.round(h.confidence * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Scanning state */}
              <AnimatePresence>
                {handsDetected === 0 && trackingStatus === 'ready' && (
                  <motion.div className={styles.scanningStrip}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <motion.div className={styles.scanningDot}
                      animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }} />
                    SCANNING FOR HANDS
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Scan line — green when hands detected */}
              <motion.div
                className={`${styles.scanLine} ${handsDetected > 0 ? styles.scanLineActive : ''}`}
                animate={{ top: ['3%', '97%', '3%'] }}
                transition={{ duration: handsDetected > 0 ? 2 : 3.5, repeat: Infinity, ease: 'linear' }}
              />

              {/* Gesture lock box */}
              <AnimatePresence>
                {status.aiState === 'locked' && (
                  <motion.div className={styles.detectionBox}
                    initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.25 }}>
                    <div className={`${styles.detectionCorner} ${styles.dTL}`} />
                    <div className={`${styles.detectionCorner} ${styles.dTR}`} />
                    <div className={`${styles.detectionCorner} ${styles.dBL}`} />
                    <div className={`${styles.detectionCorner} ${styles.dBR}`} />
                    <span className={styles.detectionLabel}>GESTURE LOCKED</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* AI thinking pulse */}
              <AnimatePresence>
                {status.aiState === 'thinking' && (
                  <motion.div className={styles.processingOverlay}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.4, 0] }}
                    transition={{ duration: 0.7, repeat: Infinity }}
                    exit={{ opacity: 0 }} />
                )}
              </AnimatePresence>

            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom overlay bar */}
        <AnimatePresence>
          {status.isActive && (
            <motion.div className={styles.overlayBar}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className={styles.overlayLeft}>
                <Scan size={12} strokeWidth={1.5} />
                <span>FORENSIC-7B</span>
              </div>
              <div className={styles.overlayRight}>
                {isLive && (
                  <motion.div className={styles.recIndicator}
                    animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                    <span className={styles.recDot} />
                    REC
                  </motion.div>
                )}
                <span>30 FPS</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Controls ── */}
      <div className={styles.controls}>
        {!status.isActive ? (
          <motion.button className={styles.startBtn} onClick={onStart}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Play size={15} strokeWidth={2} fill="currentColor" />
            Initialize Session
          </motion.button>
        ) : (
          <motion.button className={styles.stopBtn} onClick={onStop}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Square size={13} strokeWidth={2} fill="currentColor" />
            Terminate Session
          </motion.button>
        )}
        <p className={styles.hintText}>
          Show a gesture · lower hands · next command
        </p>
      </div>
    </div>
  )
}
