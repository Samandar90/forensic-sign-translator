import { memo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import type { Lang } from '../i18n'
import { useT } from '../i18n'
import styles from './ShortcutsModal.module.css'

interface Props {
  readonly lang: Lang
  readonly open: boolean
  readonly onClose: () => void
}

const rows: readonly { k: string; tk: 'shortcuts_space' | 'shortcuts_f' | 'shortcuts_m' | 'shortcuts_c' }[] = [
  { k: 'Space', tk: 'shortcuts_space' },
  { k: 'F', tk: 'shortcuts_f' },
  { k: 'M', tk: 'shortcuts_m' },
  { k: 'C', tk: 'shortcuts_c' },
]

export default memo(function ShortcutsModal({ lang, open, onClose }: Props) {
  const t = useT(lang)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    closeBtnRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

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
            aria-labelledby="shortcuts-title"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={e => e.stopPropagation()}
          >
            <div className={styles.head}>
              <h2 id="shortcuts-title" className={styles.title}>
                {t('shortcuts_modal_title')}
              </h2>
              <button
                ref={closeBtnRef}
                type="button"
                className={styles.close}
                onClick={onClose}
                aria-label={t('session_modal_close')}
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <ul className={styles.list}>
              {rows.map(r => (
                <li key={r.k} className={styles.row}>
                  <kbd className={styles.kbd}>{r.k}</kbd>
                  <span className={styles.desc}>{t(r.tk)}</span>
                </li>
              ))}
            </ul>
            <p className={styles.footer}>{t('shortcuts_hint_footer')}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
