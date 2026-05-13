import { memo } from 'react'
import type { Lang, TranslationKey } from '../i18n'
import { useT } from '../i18n'
import type { AdvancedGestureId } from '../lib/gestures/gestureTypes'
import styles from './QuickGesturesBar.module.css'

const GESTURES: readonly { id: AdvancedGestureId; emoji: string; nameKey: TranslationKey }[] = [
  { id: 'LIKE', emoji: '👍', nameKey: 'gesture_name_like' },
  { id: 'PEACE', emoji: '✌️', nameKey: 'gesture_name_peace' },
  { id: 'HELLO', emoji: '👋', nameKey: 'gesture_name_hello' },
  { id: 'STOP', emoji: '✋', nameKey: 'gesture_name_stop' },
  { id: 'FIST', emoji: '👊', nameKey: 'gesture_name_fist' },
] as const

interface Props {
  lang: Lang
  activeGestureId: AdvancedGestureId | null
}

export default memo(function QuickGesturesBar({ lang, activeGestureId }: Props) {
  const t = useT(lang)
  return (
    <div className={styles.wrap}>
      <span className={styles.label}>{t('dock_gestures')}</span>
      <div className={styles.scroll}>
        {GESTURES.map(g => (
          <div
            key={g.id}
            className={`${styles.card} ${activeGestureId === g.id ? styles.cardActive : ''}`}
            title={t(g.nameKey)}
          >
            <span className={styles.emoji}>{g.emoji}</span>
            <span className={styles.name}>{t(g.nameKey)}</span>
          </div>
        ))}
      </div>
    </div>
  )
})
