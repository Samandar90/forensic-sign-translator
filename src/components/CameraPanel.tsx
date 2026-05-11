import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Camera, Loader, Play, Scan, Square, WifiOff } from 'lucide-react'
import type { SystemStatus } from '../types'
import type { CameraState } from '../hooks/useCamera'
import type { HandInfo, TrackingStatus } from '../hooks/useHandTracking'
import { useClock } from '../hooks/useClock'
import styles from './CameraPanel.module.css'

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  cameraState: CameraState
  errorMessage: string
  trackingStatus: TrackingStatus
  handsDetected: number
  handInfos: HandInfo[]
  status: SystemStatus
  onStart: () => void
  onStop: () => void
  onRetryCamera: () => void
}

export default function CameraPanel({
  videoRef,
  canvasRef,
  cameraState,
  errorMessage,
  trackingStatus,
  handsDetected,
  handInfos,
  status,
  onStart,
  onStop,
  onRetryCamera,
}: Props) {
  const clock = useClock()
  const isLive = cameraState === 'active'
  const subtitle = status.currentTranslation || 'Waiting for gesture...'
  const handLabel = handsDetected > 0 ? `${handsDetected} hand${handsDetected > 1 ? 's' : ''} detected` : 'Scanning for hands'

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div className={styles.panelTitle}>
          <Camera size={14} strokeWidth={1.5} />
          Live Camera Feed
        </div>
        <div className={styles.indicators}>
          <span className={`${styles.dot} ${isLive ? styles.dotActive : styles.dotIdle}`} />
          <span className={styles.feedLabel}>
            {cameraState === 'requesting' ? 'CONNECTING' :
             isLive ? 'LIVE' :
             cameraState === 'denied' ? 'BLOCKED' :
             cameraState === 'unavailable' ? 'NO CAMERA' :
             cameraState === 'error' ? 'ERROR' :
             'STANDBY'}
          </span>
        </div>
      </div>

      <div className={styles.viewport}>
        <motion.video
          ref={videoRef as React.RefObject<HTMLVideoElement>}
          className={styles.videoFeed}
          autoPlay
          playsInline
          muted
          initial={{ opacity: 0 }}
          animate={{ opacity: isLive ? 1 : 0 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
        />

        <canvas
          ref={canvasRef}
          className={styles.trackingCanvas}
          style={{ opacity: trackingStatus === 'ready' ? 1 : 0 }}
        />

        <div className={styles.grid} />
        <div className={`${styles.corner} ${styles.cornerTL}`} />
        <div className={`${styles.corner} ${styles.cornerTR}`} />
        <div className={`${styles.corner} ${styles.cornerBL}`} />
        <div className={`${styles.corner} ${styles.cornerBR}`} />

        <AnimatePresence mode="wait">
          {!status.isActive && cameraState === 'idle' && (
            <motion.div
              key="idle"
              className={styles.stateOverlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className={styles.cameraIcon}><Camera size={40} strokeWidth={0.8} /></div>
              <p className={styles.stateTitle}>Camera feed inactive</p>
              <p className={styles.stateSubtitle}>Initialize the session to start translation.</p>
              <p className={styles.stateHint}>Show one gesture, then return hands down.</p>
            </motion.div>
          )}

          {cameraState === 'requesting' && (
            <motion.div
              key="requesting"
              className={styles.stateOverlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
              >
                <Loader size={36} strokeWidth={1} color="var(--cyan)" />
              </motion.div>
              <p className={styles.stateTitle} style={{ color: 'var(--cyan)' }}>Initializing camera...</p>
              <p className={styles.stateSubtitle}>Requesting secure device access</p>
            </motion.div>
          )}

          {cameraState === 'denied' && (
            <motion.div
              key="denied"
              className={styles.stateOverlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div style={{ color: 'var(--red)', marginBottom: 6 }}><WifiOff size={36} strokeWidth={1} /></div>
              <p className={styles.stateTitle} style={{ color: 'var(--red)' }}>Permission denied</p>
              <p className={styles.stateSubtitle}>{errorMessage}</p>
              <button className={styles.retryBtn} onClick={onRetryCamera}>Retry Camera Access</button>
            </motion.div>
          )}

          {(cameraState === 'unavailable' || cameraState === 'error') && (
            <motion.div
              key="error"
              className={styles.stateOverlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div style={{ color: 'rgba(255,190,30,0.9)', marginBottom: 6 }}>
                <AlertTriangle size={36} strokeWidth={1} />
              </div>
              <p className={styles.stateTitle} style={{ color: 'rgba(255,190,30,0.95)' }}>
                {cameraState === 'unavailable' ? 'No camera found' : 'Camera error'}
              </p>
              <p className={styles.stateSubtitle}>{errorMessage}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isLive && (
            <motion.div
              key="live-overlays"
              className={styles.activeOverlays}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              <div className={styles.overlayTop}>
                <div className={styles.aiBadge}>
                  <span className={styles.aiBadgeDot} />
                  AI ACTIVE
                </div>
                <span className={styles.liveTimestamp}>{clock}</span>
              </div>

              <div className={styles.scanStatus}>
                <Scan size={12} strokeWidth={1.6} />
                <span>{handLabel}</span>
                {handsDetected > 0 && handInfos.length > 0 && (
                  <span className={styles.handMeta}>{handInfos.map(info => info.label).join(' · ')}</span>
                )}
              </div>

              <motion.div
                className={`${styles.scanLine} ${handsDetected > 0 ? styles.scanLineActive : ''}`}
                animate={{ top: ['4%', '96%', '4%'] }}
                transition={{ duration: handsDetected > 0 ? 2.2 : 3.6, repeat: Infinity, ease: 'linear' }}
              />

              <AnimatePresence>
                {status.aiState === 'locked' && (
                  <motion.div
                    className={styles.detectionBox}
                    initial={{ opacity: 0, scale: 0.93 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.93 }}
                  >
                    <div className={`${styles.detectionCorner} ${styles.dTL}`} />
                    <div className={`${styles.detectionCorner} ${styles.dTR}`} />
                    <div className={`${styles.detectionCorner} ${styles.dBL}`} />
                    <div className={`${styles.detectionCorner} ${styles.dBR}`} />
                    <span className={styles.detectionLabel}>Gesture locked</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {status.aiState === 'thinking' && (
                  <motion.div
                    className={styles.processingOverlay}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.45, 0] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    exit={{ opacity: 0 }}
                  />
                )}
              </AnimatePresence>

              <div className={styles.subtitleWrap}>
                <motion.div
                  key={subtitle}
                  className={styles.subtitleCard}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.24 }}
                >
                  <p className={styles.subtitleText}>{subtitle}</p>
                  <span className={styles.subtitleHint}>Show one gesture, then return hands down.</span>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className={styles.controls}>
        {!status.isActive ? (
          <motion.button
            className={styles.startBtn}
            onClick={onStart}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Play size={15} strokeWidth={2} fill="currentColor" />
            Initialize Session
          </motion.button>
        ) : (
          <motion.button
            className={styles.stopBtn}
            onClick={onStop}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Square size={13} strokeWidth={2} fill="currentColor" />
            Terminate Session
          </motion.button>
        )}

        <p className={styles.hintText}>Show one gesture, then return hands down.</p>
      </div>
    </div>
  )
}
