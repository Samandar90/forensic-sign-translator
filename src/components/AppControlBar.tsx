import { memo } from 'react'
import { Keyboard, Monitor, Presentation } from 'lucide-react'
import type { Lang } from '../i18n'
import { useT } from '../i18n'
import styles from './AppControlBar.module.css'

interface Props {
  readonly lang: Lang
  readonly cleanMode: boolean
  readonly presentationMode: boolean
  readonly onToggleClean: () => void
  readonly onTogglePresentation: () => void
  readonly onOpenShortcuts: () => void
}

export default memo(function AppControlBar({
  lang,
  cleanMode,
  presentationMode,
  onToggleClean,
  onTogglePresentation,
  onOpenShortcuts,
}: Props) {
  const t = useT(lang)

  return (
    <div className={styles.bar} role="toolbar" aria-label={t('control_bar_title')}>
      <span className={styles.label}>{t('control_bar_title')}</span>
      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.btn} ${cleanMode ? styles.btnActive : ''}`}
          onClick={onToggleClean}
          aria-pressed={cleanMode}
        >
          <Monitor size={15} strokeWidth={2} aria-hidden />
          {t('control_clean')}
        </button>
        <button
          type="button"
          className={`${styles.btn} ${presentationMode ? styles.btnActive : ''}`}
          onClick={onTogglePresentation}
          aria-pressed={presentationMode}
        >
          <Presentation size={15} strokeWidth={2} aria-hidden />
          {t('control_present')}
        </button>
        <button type="button" className={styles.btn} onClick={onOpenShortcuts} aria-label={t('aria_open_shortcuts')}>
          <Keyboard size={15} strokeWidth={2} aria-hidden />
          {t('control_shortcuts')}
        </button>
      </div>
    </div>
  )
})
