import { History, Settings, Shield, Keyboard } from 'lucide-react'
import type { Lang } from '../i18n'
import { useT } from '../i18n'
import styles from './Header.module.css'

interface Props {
  lang: Lang
  sessionActive: boolean
  sessionId: string
  onLangChange: (l: Lang) => void
  onOpenHistory?: () => void
  onOpenSettings?: () => void
  onOpenShortcuts?: () => void
}

export default function Header({
  lang,
  sessionActive,
  sessionId,
  onLangChange,
  onOpenHistory,
  onOpenSettings,
  onOpenShortcuts,
}: Props) {
  const t = useT(lang)

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <div className={styles.logo} aria-hidden>
          <Shield size={17} strokeWidth={1.5} />
        </div>
        <div className={styles.titles}>
          <span className={styles.name}>{t('app_brand')}</span>
          <span className={styles.tag}>{t('header_subtitle')}</span>
        </div>
      </div>

      <div className={styles.right}>
        <span className={styles.session} aria-live="polite" title={sessionId}>
          {sessionActive ? t('header_session_active') : t('header_session_idle')}
        </span>

        <div className={styles.iconGroup}>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label={t('aria_nav_history')}
            title={t('nav_history')}
            onClick={() => onOpenHistory?.()}
          >
            <History size={18} strokeWidth={1.65} />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label={t('aria_open_shortcuts')}
            title={t('nav_shortcuts')}
            onClick={() => onOpenShortcuts?.()}
          >
            <Keyboard size={18} strokeWidth={1.65} />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label={t('aria_nav_settings')}
            title={t('nav_settings')}
            onClick={() => onOpenSettings?.()}
          >
            <Settings size={18} strokeWidth={1.65} />
          </button>
        </div>

        <div className={styles.lang} role="group" aria-label={t('aria_lang_group')}>
          {(['ru', 'uz'] as Lang[]).map(l => (
            <button
              key={l}
              type="button"
              className={`${styles.langBtn} ${lang === l ? styles.langOn : ''}`}
              onClick={() => onLangChange(l)}
              aria-pressed={lang === l}
            >
              {l === 'ru' ? t('lang_switch_ru') : t('lang_switch_uz')}
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}
