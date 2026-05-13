import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera,
  WifiOff,
  AlertTriangle,
  Loader,
  Maximize2,
  Minimize2,
  RefreshCw,
  ImagePlus,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
} from 'lucide-react'
import type { RecognitionFlowPhase, CameraErrorCode, VisionDetectionState } from '../types'
import type { CameraState } from '../hooks/useCamera'
import type { Lang, TranslationKey } from '../i18n'
import { useT } from '../i18n'
import {
  createAdaptiveQualityController,
  presetToTier,
  type VideoQualityPreset,
} from '../lib/camera/adaptiveQuality'
import { getFullscreenElement, toggleFullscreen } from '../lib/camera/fullscreen'
import { captureVideoWithOverlayDataUrl } from '../lib/camera/screenshot'
import { createFpsUiEmitter } from '../lib/performance/fpsMonitor'
import type { AdvancedGestureId } from '../lib/gestures/gestureTypes'
import type { StableGestureResult } from '../lib/gestures/gestureTypes'
import { gestureDisplayName } from '../lib/translation/gestureTranslations'
import CameraStatusBar from './CameraStatusBar'
import styles from './CameraPanel.module.css'

const GESTURE_EMOJI: Record<AdvancedGestureId, string> = {
  LIKE: '👍',
  PEACE: '✌️',
  HELLO: '👋',
  STOP: '✋',
  FIST: '👊',
}

function cameraErrorKey(code: CameraErrorCode): TranslationKey | null {
  if (!code) return null
  const map: Record<Exclude<CameraErrorCode, null>, TranslationKey> = {
    api_unsupported: 'cam_err_api_unsupported',
    permission_denied: 'cam_err_permission_denied',
    no_device: 'cam_err_no_device',
    busy: 'cam_err_busy',
    no_video_target: 'cam_err_no_video_target',
    unknown: 'cam_err_unknown',
  }
  return map[code]
}

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  cameraState: CameraState
  errorCode: CameraErrorCode
  sessionActive: boolean
  lang: Lang
  recognitionPhase: RecognitionFlowPhase
  detectionFps: number
  qualityPreset: VideoQualityPreset
  visionState: VisionDetectionState
  stableGesture: StableGestureResult | null
  cleanView: boolean
  onCleanViewChange: (value: boolean) => void
  onRetryCamera: () => void | Promise<boolean>
  onRestartWithPreset: (preset: VideoQualityPreset) => Promise<boolean>
  voiceEnabled: boolean
  speechOk: boolean
  onToggleVoice: () => void
  autoQualityEnabled?: boolean
  showFpsOverlay?: boolean
  fullscreenDefault?: boolean
  activeSessionId?: string | null
  onRegisterFullscreenToggle?: (fn: (() => void) | null) => void
}

export default function CameraPanel({
  videoRef,
  canvasRef,
  cameraState,
  errorCode,
  sessionActive,
  lang,
  recognitionPhase,
  detectionFps,
  qualityPreset,
  visionState,
  stableGesture,
  cleanView,
  onCleanViewChange,
  onRetryCamera,
  onRestartWithPreset,
  voiceEnabled,
  speechOk,
  onToggleVoice,
  autoQualityEnabled = true,
  showFpsOverlay = false,
  fullscreenDefault = false,
  activeSessionId = null,
  onRegisterFullscreenToggle,
}: Props) {
  const t = useT(lang)
  const shellRef = useRef<HTMLDivElement | null>(null)
  const cameraFpsMeasureRef = useRef(0)
  const detectionFpsRef = useRef(0)
  const adaptiveRef = useRef(createAdaptiveQualityController(qualityPreset))
  const fpsEmitterRef = useRef(createFpsUiEmitter(1000))

  const [isFullscreen, setIsFullscreen] = useState(false)
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const [displayFps, setDisplayFps] = useState({ camera: 0, detection: 0 })
  const [adaptiveNotice, setAdaptiveNotice] = useState(false)
  const [shotToast, setShotToast] = useState(false)
  const [shotFlash, setShotFlash] = useState(false)

  const isLive = cameraState === 'active'
  const errKey = cameraErrorKey(errorCode)
  const isFirstIdle = recognitionPhase === 'idle' && cameraState === 'idle'
  const phaseKey = `flow_${recognitionPhase}` as TranslationKey

  const analysisLive = isLive && visionState === 'ready' && detectionFps > 0

  const showGestureChip =
    isLive && visionState === 'ready' && stableGesture !== null && stableGesture.confidencePct >= 70

  const gestureChipText = useMemo(() => {
    if (!stableGesture) return ''
    const name = gestureDisplayName(stableGesture.id, lang)
    return `${GESTURE_EMOJI[stableGesture.id]} ${name}`
  }, [stableGesture, lang])

  const resolutionLabel = useMemo(() => {
    const h = dims.h
    if (h >= 1000) return `FHD ${h}p`
    if (h >= 600) return `HD ${h}p`
    if (h > 0) return `${h}p`
    if (qualityPreset === 'FHD') return 'FHD 1080p'
    if (qualityPreset === 'HD') return 'HD 720p'
    return '480p'
  }, [dims.h, qualityPreset])

  const qualityTier = useMemo(() => presetToTier(qualityPreset), [qualityPreset])
  const qualityStateKey: TranslationKey = adaptiveNotice ? 'cam_state_adjusting' : 'cam_state_stable'

  useEffect(() => {
    detectionFpsRef.current = detectionFps
  }, [detectionFps])

  useEffect(() => {
    adaptiveRef.current.setPreset(qualityPreset)
  }, [qualityPreset])

  useEffect(() => {
    if (!adaptiveNotice) return
    const id = window.setTimeout(() => setAdaptiveNotice(false), 6500)
    return () => window.clearTimeout(id)
  }, [adaptiveNotice])

  useEffect(() => {
    const syncFs = (): void => {
      setIsFullscreen(getFullscreenElement() === shellRef.current)
    }
    syncFs()
    document.addEventListener('fullscreenchange', syncFs)
    return () => document.removeEventListener('fullscreenchange', syncFs)
  }, [])

  useEffect(() => {
    const v = videoRef.current
    if (!isLive || !v) {
      cameraFpsMeasureRef.current = 0
      setDims({ w: 0, h: 0 })
      return
    }

    const onMeta = (): void => {
      setDims({ w: v.videoWidth, h: v.videoHeight })
    }
    v.addEventListener('loadedmetadata', onMeta)
    onMeta()

    let handle = 0
    let frames = 0
    let last = performance.now()

    if (typeof v.requestVideoFrameCallback === 'function') {
      const tick = (): void => {
        frames += 1
        const now = performance.now()
        if (now - last >= 1000) {
          cameraFpsMeasureRef.current = Math.round((frames / (now - last)) * 1000)
          frames = 0
          last = now
        }
        handle = v.requestVideoFrameCallback(tick)
      }
      handle = v.requestVideoFrameCallback(tick)
      return () => {
        v.removeEventListener('loadedmetadata', onMeta)
        if (handle && typeof v.cancelVideoFrameCallback === 'function') {
          v.cancelVideoFrameCallback(handle)
        }
      }
    }

    const id = window.setInterval(() => {
      cameraFpsMeasureRef.current = 0
    }, 1000)
    return () => {
      v.removeEventListener('loadedmetadata', onMeta)
      window.clearInterval(id)
    }
  }, [isLive, videoRef])

  useEffect(() => {
    if (!isLive) {
      setDisplayFps({ camera: 0, detection: 0 })
      return
    }
    const id = window.setInterval(() => {
      const now = performance.now()
      const next = fpsEmitterRef.current.maybeEmit(
        now,
        cameraFpsMeasureRef.current,
        detectionFpsRef.current,
      )
      if (next) {
        setDisplayFps({ camera: next.camera, detection: next.detection })
      }
    }, 250)
    return () => window.clearInterval(id)
  }, [isLive])

  useEffect(() => {
    if (!isLive) return
    if (!autoQualityEnabled) return
    const id = window.setInterval(() => {
      const fps = cameraFpsMeasureRef.current
      const res = adaptiveRef.current.evaluate(fps)
      if (res.didDowngrade || res.didUpgrade) {
        if (res.didDowngrade) setAdaptiveNotice(true)
        void onRestartWithPreset(res.nextPreset)
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [isLive, onRestartWithPreset, autoQualityEnabled])

  const handleToggleFullscreen = useCallback(() => {
    const el = shellRef.current
    if (!el) return
    void toggleFullscreen(el).catch(() => {})
  }, [])

  useEffect(() => {
    onRegisterFullscreenToggle?.(() => {
      handleToggleFullscreen()
    })
    return () => onRegisterFullscreenToggle?.(null)
  }, [onRegisterFullscreenToggle, handleToggleFullscreen])

  const lastAutoFsSessionRef = useRef<string | null>(null)
  useEffect(() => {
    if (!fullscreenDefault || !sessionActive || !isLive || !activeSessionId) return
    if (lastAutoFsSessionRef.current === activeSessionId) return
    lastAutoFsSessionRef.current = activeSessionId
    const id = window.setTimeout(() => {
      handleToggleFullscreen()
    }, 480)
    return () => window.clearTimeout(id)
  }, [fullscreenDefault, sessionActive, isLive, activeSessionId, handleToggleFullscreen])

  const handleRestartCamera = useCallback(() => {
    void onRestartWithPreset(qualityPreset)
  }, [onRestartWithPreset, qualityPreset])

  const handleScreenshot = useCallback(() => {
    const v = videoRef.current
    const c = canvasRef.current
    if (!v || !c) return
    const url = captureVideoWithOverlayDataUrl(v, c)
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = `forensic-cam-${Date.now()}.png`
    a.rel = 'noopener'
    a.click()
    setShotToast(true)
    setShotFlash(true)
    window.setTimeout(() => setShotFlash(false), 420)
    window.setTimeout(() => setShotToast(false), 2400)
  }, [videoRef, canvasRef])

  const shellFs = isFullscreen

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div className={styles.panelHeaderRow}>
          <div>
            <h2 className={styles.panelTitle}>{t('cam_panel_title')}</h2>
            <p className={styles.panelMeta} aria-live="polite">
              {t(phaseKey)}
            </p>
          </div>
          {isLive && (
            <span
              className={`${styles.livePulse} ${analysisLive ? styles.livePulseOn : ''}`}
              aria-hidden
              title={t('flow_active')}
            />
          )}
        </div>
      </div>

      <div className={styles.cameraColumn}>
        <div
          ref={shellRef}
          className={`${styles.videoShell} ${isLive ? styles.videoShellLive : ''} ${shellFs ? styles.videoShellFs : ''}`}
        >
          <div className={`${styles.videoFrame} ${shotFlash ? styles.videoFrameFlash : ''}`}>
            <video
              ref={videoRef as React.RefObject<HTMLVideoElement>}
              className={styles.videoFeed}
              style={{ opacity: isLive ? 1 : 0 }}
              autoPlay
              playsInline
              muted
              aria-hidden={!isLive}
            />
            <canvas
              ref={canvasRef as React.RefObject<HTMLCanvasElement>}
              className={styles.handOverlay}
              aria-hidden
            />
            <div className={styles.videoVignette} aria-hidden />

            {showFpsOverlay && isLive && (
              <div className={styles.fpsDebug} aria-hidden>
                {displayFps.camera} · {displayFps.detection} fps
              </div>
            )}

            {isLive && (
              <>
                <button
                  type="button"
                  className={`${styles.cleanToggle} ${cleanView ? styles.cleanToggleOn : ''}`}
                  onClick={() => onCleanViewChange(!cleanView)}
                  aria-pressed={cleanView}
                  title={`${t('cam_clean_view')} — ${cleanView ? t('cam_clean_view_on') : t('cam_clean_view_off')}`}
                >
                  {cleanView ? <EyeOff size={15} strokeWidth={2} /> : <Eye size={15} strokeWidth={2} />}
                </button>

                <AnimatePresence>
                  {showGestureChip && stableGesture && (
                    <motion.div
                      key={stableGesture.id + String(stableGesture.confidencePct)}
                      className={styles.gestureChip}
                      role="status"
                      aria-live="polite"
                      initial={{ opacity: 0, y: 6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.98 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {gestureChipText}
                    </motion.div>
                  )}
                </AnimatePresence>

                {shellFs && (
                  <div className={styles.floatDock} role="toolbar" aria-label={t('controls_toolbar')}>
                    <button
                      type="button"
                      className={styles.floatBtn}
                      onClick={handleToggleFullscreen}
                      aria-label={isFullscreen ? t('cam_exit_fullscreen') : t('aria_cam_fullscreen')}
                    >
                      {isFullscreen ? <Minimize2 size={16} strokeWidth={2} /> : <Maximize2 size={16} strokeWidth={2} />}
                    </button>
                    <button
                      type="button"
                      className={styles.floatBtn}
                      onClick={handleRestartCamera}
                      aria-label={t('cam_restart')}
                    >
                      <RefreshCw size={16} strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      className={styles.floatBtn}
                      onClick={handleScreenshot}
                      aria-label={t('cam_screenshot')}
                    >
                      <ImagePlus size={16} strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.floatBtn} ${voiceEnabled ? styles.floatBtnOn : ''}`}
                      onClick={onToggleVoice}
                      disabled={!speechOk}
                      aria-pressed={voiceEnabled}
                      aria-label={voiceEnabled ? t('voice_on') : t('voice_off')}
                    >
                      {voiceEnabled ? <Volume2 size={16} strokeWidth={2} /> : <VolumeX size={16} strokeWidth={2} />}
                    </button>
                  </div>
                )}

                <AnimatePresence>
                  {shotToast && (
                    <motion.div
                      className={styles.shotToast}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.2 }}
                    >
                      {t('cam_screenshot_saved')}
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>

          <AnimatePresence mode="wait">
            {!isLive && cameraState === 'idle' && (
              <motion.div
                key="idle"
                className={styles.placeholder}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28 }}
              >
                <div className={styles.pulseBg} aria-hidden />
                <div className={styles.placeholderInner}>
                  <div className={styles.placeholderIcon}>
                    <Camera size={36} strokeWidth={1.2} aria-hidden />
                  </div>
                  <h3 className={styles.placeholderHeadline}>
                    {isFirstIdle ? t('cam_idle_ready_title') : t('cam_off')}
                  </h3>
                  <p className={styles.placeholderLead}>
                    {isFirstIdle ? t('cam_idle_ready_sub') : t('cam_privacy_hint')}
                  </p>
                  {sessionActive && isFirstIdle && (
                    <p className={styles.placeholderHint}>{t('cam_use_bottom_start')}</p>
                  )}
                </div>
              </motion.div>
            )}

            {cameraState === 'requesting' && (
              <motion.div
                key="loading"
                className={styles.placeholder}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
              >
                <div className={styles.pulseBg} aria-hidden />
                <div className={`${styles.placeholderInner} ${styles.placeholderInnerGlass}`}>
                  <div className={styles.connectingIcon} role="status" aria-live="polite">
                    <Loader size={28} strokeWidth={1.5} className={styles.loaderIcon} aria-hidden />
                  </div>
                  <p className={styles.placeholderHeadline}>{t('cam_connecting')}</p>
                  <p className={styles.placeholderLead}>{t('cam_loading_init')}</p>
                </div>
              </motion.div>
            )}

            {cameraState === 'denied' && (
              <motion.div
                key="denied"
                className={styles.placeholder}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.24 }}
              >
                <div className={`${styles.placeholderInner} ${styles.errorCard}`}>
                  <div className={styles.errorIcon} style={{ color: 'var(--error)' }}>
                    <WifiOff size={28} strokeWidth={1.5} aria-hidden />
                  </div>
                  <p className={styles.placeholderHeadline}>{t('cam_access_denied_title')}</p>
                  <p className={styles.placeholderLead}>{t('cam_err_permission_hint')}</p>
                  <motion.button
                    type="button"
                    className={styles.retryBtn}
                    onClick={() => void onRetryCamera()}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    {t('cam_retry')}
                  </motion.button>
                </div>
              </motion.div>
            )}

            {(cameraState === 'unavailable' || cameraState === 'error') && (
              <motion.div
                key="err"
                className={styles.placeholder}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.24 }}
              >
                <div className={`${styles.placeholderInner} ${styles.errorCard}`}>
                  <div className={styles.errorIcon} style={{ color: 'var(--warning)' }}>
                    <AlertTriangle size={28} strokeWidth={1.5} aria-hidden />
                  </div>
                  <p className={styles.placeholderHeadline}>
                    {cameraState === 'unavailable' ? t('cam_no_device') : t('cam_error')}
                  </p>
                  {errKey && <p className={styles.placeholderLead}>{t(errKey)}</p>}
                  <motion.button
                    type="button"
                    className={styles.retryBtn}
                    onClick={() => void onRetryCamera()}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    {t('cam_retry')}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <CameraStatusBar
          lang={lang}
          isLive={isLive}
          analysisLive={analysisLive}
          cameraFpsDisplay={displayFps.camera}
          detectionFpsDisplay={displayFps.detection}
          resolutionLabel={resolutionLabel}
          qualityTier={qualityTier}
          qualityStateKey={qualityStateKey}
          adaptiveNotice={adaptiveNotice}
          isFullscreen={isFullscreen}
          voiceEnabled={voiceEnabled}
          speechOk={speechOk}
          onToggleFullscreen={handleToggleFullscreen}
          onRestartCamera={handleRestartCamera}
          onScreenshot={handleScreenshot}
          onToggleVoice={onToggleVoice}
        />
      </div>
    </div>
  )
}
