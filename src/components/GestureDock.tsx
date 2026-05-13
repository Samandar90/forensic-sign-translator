import { memo } from 'react'
import type { Lang } from '../i18n'
import { useT } from '../i18n'
import type { AdvancedGestureId } from '../lib/gestures/gestureTypes'
import QuickGesturesBar from './QuickGesturesBar'
import ControlsBar from './ControlsBar'
import styles from './GestureDock.module.css'

interface Props {
  lang: Lang
  sessionActive: boolean
  voiceEnabled: boolean
  speechOk: boolean
  activeGestureId: AdvancedGestureId | null
  onStart: () => void
  onStop: () => void
  onToggleVoice: () => void
  onSpeakSummary: () => void
}

export default memo(function GestureDock({
  lang,
  sessionActive,
  voiceEnabled,
  speechOk,
  activeGestureId,
  onStart,
  onStop,
  onToggleVoice,
  onSpeakSummary,
}: Props) {
  const t = useT(lang)

  return (
    <div className={styles.dock} role="toolbar" aria-label={t('controls_toolbar')}>
      <QuickGesturesBar lang={lang} activeGestureId={activeGestureId} />
      <ControlsBar
        lang={lang}
        sessionActive={sessionActive}
        voiceEnabled={voiceEnabled}
        speechOk={speechOk}
        onStart={onStart}
        onStop={onStop}
        onToggleVoice={onToggleVoice}
        onSpeakSummary={onSpeakSummary}
      />
    </div>
  )
})
