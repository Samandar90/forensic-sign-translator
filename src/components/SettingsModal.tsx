import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import type { Lang, TranslationKey } from '../i18n'
import { useT } from '../i18n'
import { useAppSettings } from '../hooks/useAppSettings'
import type { SettingsSectionId, TriLevel, PanelDensity, SpeechLangMode } from '../lib/settings/settingsTypes'
import type { VideoQualityPreset } from '../lib/camera/adaptiveQuality'
import styles from './SettingsModal.module.css'

interface Props {
  readonly lang: Lang
  readonly open: boolean
  readonly onClose: () => void
  readonly onUiLangChange: (l: Lang) => void
  readonly onClearTranscript: () => void
  readonly onClearSessionHistory: () => void
  readonly onResetAppSettings: () => void
}

const SECTIONS: readonly { id: SettingsSectionId; label: TranslationKey }[] = [
  { id: 'general', label: 'settings_nav_general' },
  { id: 'data', label: 'settings_nav_data' },
  { id: 'camera', label: 'settings_nav_camera' },
  { id: 'voice', label: 'settings_nav_voice' },
  { id: 'recognition', label: 'settings_nav_recognition' },
  { id: 'interface', label: 'settings_nav_interface' },
  { id: 'accessibility', label: 'settings_nav_a11y' },
  { id: 'advanced', label: 'settings_nav_advanced' },
] as const

function triOpts(t: ReturnType<typeof useT>): { v: TriLevel; label: string }[] {
  return [
    { v: 'low', label: t('settings_tri_low') },
    { v: 'medium', label: t('settings_tri_med') },
    { v: 'high', label: t('settings_tri_high') },
  ]
}

export default memo(function SettingsModal({
  lang,
  open,
  onClose,
  onUiLangChange,
  onClearTranscript,
  onClearSessionHistory,
  onResetAppSettings,
}: Props) {
  const t = useT(lang)
  const { settings, patch } = useAppSettings()
  const [section, setSection] = useState<SettingsSectionId>('general')
  const [toast, setToast] = useState(false)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)

  const flashSaved = useCallback(() => {
    setToast(true)
    window.setTimeout(() => setToast(false), 1400)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    closeBtnRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const showAdvanced = import.meta.env.DEV

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.backdrop}
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            data-hotkeys-ignore="true"
            initial={{ opacity: 0, y: 14, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.985 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            onClick={e => e.stopPropagation()}
          >
            <div className={styles.shell}>
              <aside className={styles.nav} aria-label={t('settings_modal_title')}>
                <div className={styles.navHead}>
                  <h2 id="settings-title" className={styles.title}>
                    {t('settings_modal_title')}
                  </h2>
                  <button
                    ref={closeBtnRef}
                    type="button"
                    className={styles.close}
                    onClick={onClose}
                    aria-label={t('settings_close_aria')}
                  >
                    <X size={18} strokeWidth={2} />
                  </button>
                </div>
                <nav className={styles.navList}>
                  {SECTIONS.map(s => {
                    if (s.id === 'advanced' && !showAdvanced) return null
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className={`${styles.navBtn} ${section === s.id ? styles.navBtnOn : ''}`}
                        onClick={() => setSection(s.id)}
                      >
                        {t(s.label)}
                      </button>
                    )
                  })}
                </nav>
              </aside>

              <div className={styles.body}>
                {toast && <p className={styles.toast}>{t('settings_saved_toast')}</p>}

                {section === 'general' && (
                  <section className={styles.section} aria-labelledby="sec-general">
                    <h3 id="sec-general" className={styles.secTitle}>
                      {t('settings_nav_general')}
                    </h3>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>{t('session_ui_lang')}</span>
                      <select
                        className={styles.select}
                        value={settings.general.uiLang}
                        onChange={e => {
                          const l = e.target.value as Lang
                          patch({ general: { uiLang: l } })
                          onUiLangChange(l)
                          flashSaved()
                        }}
                      >
                        <option value="ru">{t('lang_switch_ru')}</option>
                        <option value="uz">{t('lang_switch_uz')}</option>
                      </select>
                    </label>
                    <ToggleRow
                      label={t('session_settings_autosave')}
                      checked={settings.forensic.autoSaveSession}
                      onChange={v => {
                        patch({ forensic: { autoSaveSession: v } })
                        flashSaved()
                      }}
                    />
                    <ToggleRow
                      label={t('settings_remember')}
                      checked={settings.general.rememberSettings}
                      onChange={v => {
                        patch({ general: { rememberSettings: v } })
                        flashSaved()
                      }}
                    />
                    <ToggleRow
                      label={t('settings_animations')}
                      checked={settings.general.animationsEnabled}
                      onChange={v => {
                        patch({ general: { animationsEnabled: v } })
                        flashSaved()
                      }}
                    />
                    <ToggleRow
                      label={t('session_settings_device_export')}
                      checked={settings.forensic.exportIncludeDeviceDetails}
                      onChange={v => {
                        patch({ forensic: { exportIncludeDeviceDetails: v } })
                        flashSaved()
                      }}
                    />
                  </section>
                )}

                {section === 'data' && (
                  <section className={styles.section} aria-labelledby="sec-data">
                    <h3 id="sec-data" className={styles.secTitle}>
                      {t('data_mgmt_title')}
                    </h3>
                    <p className={styles.dataLead}>{t('session_history_lead')}</p>
                    <div className={styles.dataStack}>
                      <button type="button" className={styles.dataBtn} onClick={onClearTranscript}>
                        {t('settings_clear_transcript_btn')}
                      </button>
                      <button type="button" className={styles.dataBtn} onClick={onClearSessionHistory}>
                        {t('settings_clear_sessions_btn')}
                      </button>
                      <button type="button" className={`${styles.dataBtn} ${styles.dataBtnDanger}`} onClick={onResetAppSettings}>
                        {t('settings_reset_settings_btn')}
                      </button>
                    </div>
                  </section>
                )}

                {section === 'camera' && (
                  <section className={styles.section} aria-labelledby="sec-cam">
                    <h3 id="sec-cam" className={styles.secTitle}>
                      {t('settings_nav_camera')}
                    </h3>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>{t('settings_camera_quality')}</span>
                      <select
                        className={styles.select}
                        value={settings.camera.preferredQuality}
                        onChange={e => {
                          patch({ camera: { preferredQuality: e.target.value as VideoQualityPreset } })
                          flashSaved()
                        }}
                      >
                        <option value="FHD">{t('settings_quality_fhd')}</option>
                        <option value="HD">{t('settings_quality_hd')}</option>
                        <option value="SD">{t('settings_quality_sd')}</option>
                      </select>
                    </label>
                    <ToggleRow
                      label={t('settings_camera_auto_quality')}
                      checked={settings.camera.autoQuality}
                      onChange={v => {
                        patch({ camera: { autoQuality: v } })
                        flashSaved()
                      }}
                    />
                    <ToggleRow
                      label={t('settings_camera_mirror')}
                      checked={settings.camera.mirrorCamera}
                      onChange={v => {
                        patch({ camera: { mirrorCamera: v } })
                        flashSaved()
                      }}
                    />
                    <ToggleRow
                      label={t('settings_camera_fs_default')}
                      checked={settings.camera.fullscreenDefault}
                      onChange={v => {
                        patch({ camera: { fullscreenDefault: v } })
                        flashSaved()
                      }}
                    />
                    <ToggleRow
                      label={t('settings_camera_overlay')}
                      checked={settings.camera.overlayVisible}
                      onChange={v => {
                        patch({ camera: { overlayVisible: v } })
                        flashSaved()
                      }}
                    />
                    <ToggleRow
                      label={t('settings_camera_clean_default')}
                      checked={settings.camera.cleanViewDefault}
                      onChange={v => {
                        patch({ camera: { cleanViewDefault: v } })
                        flashSaved()
                      }}
                    />
                  </section>
                )}

                {section === 'voice' && (
                  <section className={styles.section} aria-labelledby="sec-voice">
                    <h3 id="sec-voice" className={styles.secTitle}>
                      {t('settings_nav_voice')}
                    </h3>
                    <ToggleRow
                      label={t('settings_voice_default_on')}
                      checked={settings.voice.voiceEnabledDefault}
                      onChange={v => {
                        patch({ voice: { voiceEnabledDefault: v } })
                        flashSaved()
                      }}
                    />
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>{t('settings_speech_lang')}</span>
                      <select
                        className={styles.select}
                        value={settings.voice.speechLang}
                        onChange={e => {
                          patch({ voice: { speechLang: e.target.value as SpeechLangMode } })
                          flashSaved()
                        }}
                      >
                        <option value="auto">{t('settings_speech_lang_auto')}</option>
                        <option value="ru">{t('settings_speech_lang_ru')}</option>
                        <option value="uz">{t('settings_speech_lang_uz')}</option>
                      </select>
                    </label>
                    <SliderRow
                      label={t('settings_speech_rate')}
                      min={0.55}
                      max={1.15}
                      step={0.01}
                      value={settings.voice.speechRate}
                      format={v => v.toFixed(2)}
                      onChange={v => {
                        patch({ voice: { speechRate: v } })
                        flashSaved()
                      }}
                    />
                    <SliderRow
                      label={t('settings_speech_vol')}
                      min={0}
                      max={1}
                      step={0.02}
                      value={settings.voice.speechVolume}
                      format={v => `${Math.round(v * 100)}%`}
                      onChange={v => {
                        patch({ voice: { speechVolume: v } })
                        flashSaved()
                      }}
                    />
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>{t('settings_voice_pick')}</span>
                      <input
                        className={styles.textIn}
                        value={settings.voice.preferredVoiceId}
                        onChange={e => {
                          patch({ voice: { preferredVoiceId: e.target.value } })
                          flashSaved()
                        }}
                        autoComplete="off"
                      />
                    </label>
                    <ToggleRow
                      label={t('settings_mute_dup')}
                      checked={settings.voice.muteDuplicatePhrases}
                      onChange={v => {
                        patch({ voice: { muteDuplicatePhrases: v } })
                        flashSaved()
                      }}
                    />
                  </section>
                )}

                {section === 'recognition' && (
                  <section className={styles.section} aria-labelledby="sec-rec">
                    <h3 id="sec-rec" className={styles.secTitle}>
                      {t('settings_nav_recognition')}
                    </h3>
                    <TriRow
                      label={t('settings_recog_sensitivity')}
                      value={settings.recognition.gestureSensitivity}
                      options={triOpts(t)}
                      onChange={v => {
                        patch({ recognition: { gestureSensitivity: v } })
                        flashSaved()
                      }}
                    />
                    <SliderRow
                      label={t('settings_recog_confidence')}
                      min={50}
                      max={95}
                      step={1}
                      value={settings.recognition.confidenceThreshold}
                      format={v => String(Math.round(v))}
                      onChange={v => {
                        patch({ recognition: { confidenceThreshold: v } })
                        flashSaved()
                      }}
                    />
                    <TriRow
                      label={t('settings_recog_smooth')}
                      value={settings.recognition.smoothingLevel}
                      options={triOpts(t)}
                      onChange={v => {
                        patch({ recognition: { smoothingLevel: v } })
                        flashSaved()
                      }}
                    />
                    <TriRow
                      label={t('settings_recog_motion')}
                      value={settings.recognition.motionSensitivity}
                      options={triOpts(t)}
                      onChange={v => {
                        patch({ recognition: { motionSensitivity: v } })
                        flashSaved()
                      }}
                    />
                  </section>
                )}

                {section === 'interface' && (
                  <section className={styles.section} aria-labelledby="sec-ui">
                    <h3 id="sec-ui" className={styles.secTitle}>
                      {t('settings_nav_interface')}
                    </h3>
                    <ToggleRow
                      label={t('settings_ui_compact')}
                      checked={settings.interface.compactMode}
                      onChange={v => {
                        patch({ interface: { compactMode: v } })
                        flashSaved()
                      }}
                    />
                    <ToggleRow
                      label={t('settings_ui_spacing')}
                      checked={settings.interface.comfortableSpacing}
                      onChange={v => {
                        patch({ interface: { comfortableSpacing: v } })
                        flashSaved()
                      }}
                    />
                    <ToggleRow
                      label={t('settings_ui_reduced_anim')}
                      checked={settings.interface.reducedAnimations}
                      onChange={v => {
                        patch({ interface: { reducedAnimations: v } })
                        flashSaved()
                      }}
                    />
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>{t('settings_ui_density')}</span>
                      <select
                        className={styles.select}
                        value={settings.interface.panelDensity}
                        onChange={e => {
                          patch({ interface: { panelDensity: e.target.value as PanelDensity } })
                          flashSaved()
                        }}
                      >
                        <option value="comfortable">{t('settings_density_comfort')}</option>
                        <option value="compact">{t('settings_density_compact')}</option>
                      </select>
                    </label>
                    <ToggleRow
                      label={t('settings_ui_clean')}
                      checked={settings.interface.cleanMode}
                      onChange={v => {
                        patch({ interface: { cleanMode: v } })
                        flashSaved()
                      }}
                    />
                    <ToggleRow
                      label={t('settings_ui_present')}
                      checked={settings.interface.presentationMode}
                      onChange={v => {
                        patch({ interface: { presentationMode: v } })
                        flashSaved()
                      }}
                    />
                  </section>
                )}

                {section === 'accessibility' && (
                  <section className={styles.section} aria-labelledby="sec-a11y">
                    <h3 id="sec-a11y" className={styles.secTitle}>
                      {t('settings_nav_a11y')}
                    </h3>
                    <ToggleRow
                      label={t('settings_a11y_kbd')}
                      checked={settings.accessibility.keyboardNavigationHints}
                      onChange={v => {
                        patch({ accessibility: { keyboardNavigationHints: v } })
                        flashSaved()
                      }}
                    />
                    <ToggleRow
                      label={t('settings_a11y_contrast')}
                      checked={settings.accessibility.highContrast}
                      onChange={v => {
                        patch({ accessibility: { highContrast: v } })
                        flashSaved()
                      }}
                    />
                    <ToggleRow
                      label={t('settings_a11y_large')}
                      checked={settings.accessibility.largerControls}
                      onChange={v => {
                        patch({ accessibility: { largerControls: v } })
                        flashSaved()
                      }}
                    />
                    <ToggleRow
                      label={t('settings_a11y_rm')}
                      checked={settings.accessibility.reducedMotion}
                      onChange={v => {
                        patch({ accessibility: { reducedMotion: v } })
                        flashSaved()
                      }}
                    />
                    <ToggleRow
                      label={t('settings_a11y_sr')}
                      checked={settings.accessibility.screenReaderEnhancedLabels}
                      onChange={v => {
                        patch({ accessibility: { screenReaderEnhancedLabels: v } })
                        flashSaved()
                      }}
                    />
                  </section>
                )}

                {section === 'advanced' && showAdvanced && (
                  <section className={styles.section} aria-labelledby="sec-adv">
                    <h3 id="sec-adv" className={styles.secTitle}>
                      {t('settings_nav_advanced')}
                    </h3>
                    <p className={styles.devNote}>{t('settings_adv_dev_only')}</p>
                    <ToggleRow
                      label={t('settings_adv_debug')}
                      checked={settings.advanced.debugGestures}
                      onChange={v => {
                        patch({ advanced: { debugGestures: v } })
                        flashSaved()
                      }}
                    />
                    <ToggleRow
                      label={t('settings_adv_fps')}
                      checked={settings.advanced.fpsOverlay}
                      onChange={v => {
                        patch({ advanced: { fpsOverlay: v } })
                        flashSaved()
                      }}
                    />
                    <ToggleRow
                      label={t('settings_adv_landmarks')}
                      checked={settings.advanced.landmarkDebugOverlay}
                      onChange={v => {
                        patch({ advanced: { landmarkDebugOverlay: v } })
                        flashSaved()
                      }}
                    />
                  </section>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className={styles.toggleRow}>
      <span className={styles.toggleLabel}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`${styles.switch} ${checked ? styles.switchOn : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.switchKnob} />
      </button>
    </label>
  )
}

function SliderRow({
  label,
  min,
  max,
  step,
  value,
  format,
  onChange,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  format: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <label className={styles.sliderRow}>
      <div className={styles.sliderHead}>
        <span className={styles.fieldLabel}>{label}</span>
        <span className={styles.sliderVal}>{format(value)}</span>
      </div>
      <input
        type="range"
        className={styles.slider}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
      />
    </label>
  )
}

function TriRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: TriLevel
  options: { v: TriLevel; label: string }[]
  onChange: (v: TriLevel) => void
}) {
  return (
    <div className={styles.triBlock}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.seg}>
        {options.map(o => (
          <button
            key={o.v}
            type="button"
            className={`${styles.segBtn} ${value === o.v ? styles.segBtnOn : ''}`}
            onClick={() => onChange(o.v)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
