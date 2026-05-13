import { memo } from 'react'
import {
  Camera,
  Gauge,
  ImagePlus,
  Maximize2,
  Minimize2,
  RefreshCw,
  Settings,
  Volume2,
  VolumeX,
} from 'lucide-react'
import type { Lang, TranslationKey } from '../i18n'
import { useT } from '../i18n'
import type { VideoQualityTier } from '../lib/camera/adaptiveQuality'
import styles from './CameraStatusBar.module.css'

export interface CameraStatusBarProps {
  lang: Lang
  isLive: boolean
  analysisLive: boolean
  cameraFpsDisplay: number
  detectionFpsDisplay: number
  resolutionLabel: string
  qualityTier: VideoQualityTier
  qualityStateKey: TranslationKey
  adaptiveNotice: boolean
  isFullscreen: boolean
  voiceEnabled: boolean
  speechOk: boolean
  onToggleFullscreen: () => void
  onRestartCamera: () => void
  onScreenshot: () => void
  onToggleVoice: () => void
  onOpenSettings?: () => void
}

function tierLabelKey(tier: VideoQualityTier): TranslationKey {
  if (tier === 'high') return 'cam_tier_high'
  if (tier === 'medium') return 'cam_tier_medium'
  return 'cam_tier_low'
}

export default memo(function CameraStatusBar({
  lang,
  isLive,
  analysisLive,
  cameraFpsDisplay,
  detectionFpsDisplay,
  resolutionLabel,
  qualityTier,
  qualityStateKey,
  adaptiveNotice,
  isFullscreen,
  voiceEnabled,
  speechOk,
  onToggleFullscreen,
  onRestartCamera,
  onScreenshot,
  onToggleVoice,
  onOpenSettings,
}: CameraStatusBarProps) {
  const t = useT(lang)
  const speakDisabled = !speechOk

  return (
    <div className={styles.bar} role="region" aria-label={t('cam_status_region')}>
      <div className={styles.left}>
        <span className={styles.metric}>
          <Camera size={14} strokeWidth={1.65} aria-hidden className={styles.metricIcon} />
          <span className={styles.metricLabel}>{t('cam_fps_camera')}</span>
          <span className={styles.metricVal}>{isLive && cameraFpsDisplay > 0 ? cameraFpsDisplay : '—'}</span>
          <span className={styles.metricUnit}>{t('cam_fps')}</span>
        </span>
        <span className={styles.sep} aria-hidden />
        <span className={styles.metric}>
          <Gauge size={14} strokeWidth={1.65} aria-hidden className={styles.metricIcon} />
          <span className={styles.metricLabel}>{t('cam_fps_detection')}</span>
          <span className={styles.metricVal}>{isLive && detectionFpsDisplay > 0 ? detectionFpsDisplay : '—'}</span>
          <span className={styles.metricUnit}>{t('cam_fps')}</span>
        </span>
      </div>

      <div className={styles.center}>
        {isLive ? (
          <span
            className={`${styles.signal} ${analysisLive ? styles.signalLive : ''}`}
            title={analysisLive ? t('cam_status_ai_live') : t('cam_status_ai_idle')}
          >
            <span className={styles.signalDot} aria-hidden />
            <span className={styles.signalText}>
              {analysisLive ? t('cam_status_ai_live') : t('cam_status_ai_idle')}
            </span>
          </span>
        ) : null}
        <span className={styles.pill}>
          <span className={styles.pillMuted}>{t('cam_hd')}</span>
          <span className={styles.pillStrong}>{resolutionLabel}</span>
        </span>
        <span className={styles.pill}>
          <span className={styles.pillMuted}>{t('cam_quality_tier')}</span>
          <span className={styles.pillStrong}>{t(tierLabelKey(qualityTier))}</span>
        </span>
        <span className={styles.pill}>
          <span className={styles.pillMuted}>{t('cam_quality_state')}</span>
          <span className={styles.pillStrong}>{t(qualityStateKey)}</span>
        </span>
        {adaptiveNotice && <p className={styles.notice}>{t('cam_adaptive_notice')}</p>}
      </div>

      <div className={styles.right}>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={onToggleFullscreen}
          disabled={!isLive}
          aria-pressed={isFullscreen}
          aria-label={isFullscreen ? t('cam_exit_fullscreen') : t('aria_cam_fullscreen')}
          title={isFullscreen ? t('cam_exit_fullscreen') : t('cam_fullscreen')}
        >
          {isFullscreen ? <Minimize2 size={17} strokeWidth={1.75} /> : <Maximize2 size={17} strokeWidth={1.75} />}
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={onRestartCamera}
          disabled={!isLive}
          aria-label={t('cam_restart')}
          title={t('cam_restart')}
        >
          <RefreshCw size={17} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={onScreenshot}
          disabled={!isLive}
          aria-label={t('cam_screenshot')}
          title={t('cam_screenshot')}
        >
          <ImagePlus size={17} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className={`${styles.iconBtn} ${voiceEnabled ? styles.iconOn : ''}`}
          onClick={onToggleVoice}
          disabled={speakDisabled}
          aria-pressed={voiceEnabled}
          aria-label={voiceEnabled ? t('voice_on') : t('voice_off')}
          title={voiceEnabled ? t('voice_on') : t('voice_off')}
        >
          {voiceEnabled ? <Volume2 size={17} strokeWidth={1.75} /> : <VolumeX size={17} strokeWidth={1.75} />}
        </button>
        {onOpenSettings ? (
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onOpenSettings}
            aria-label={t('nav_settings')}
            title={t('nav_settings')}
          >
            <Settings size={17} strokeWidth={1.75} />
          </button>
        ) : null}
      </div>
    </div>
  )
})
