import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Radio,
  Trash2,
  FileDown,
  FileJson,
  Copy,
  Volume2,
  VolumeX,
  MessageSquareText,
  FileWarning,
} from 'lucide-react'
import type { Lang, TranslationKey } from '../i18n'
import { useT } from '../i18n'
import type { VisionDetectionState, ChatMessage, MultiHandGestureSnapshot } from '../types'
import { visionIsBootstrapping } from '../types'
import { multiReadyForChat } from '../lib/translation/gestureTranslations'
import { downloadTranscriptJson, downloadTranscriptTxt } from '../lib/export/exportTranscript'
import type { ProtocolTranscriptEntry } from '../lib/session/transcriptBuilder'
import styles from './AssistantPanel.module.css'

function formatTime(ts: number, lang: Lang): string {
  try {
    const loc = lang === 'uz' ? 'uz-UZ' : 'ru-RU'
    return new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit' }).format(new Date(ts))
  } catch {
    return ''
  }
}

function lastCopyPayload(messages: readonly ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role !== 'assistant') continue
    if (m.gestureBlock) {
      return [`UZ: ${m.gestureBlock.lineUz}`, `RU: ${m.gestureBlock.lineRu}`].join('\n')
    }
    if (m.translation) return m.translation
    return m.content
  }
  return ''
}

const NEAR_BOTTOM_PX = 80

function isNearBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
}

const MessageBubble = memo(function MessageBubble({ m, lang }: { m: ChatMessage; lang: Lang }) {
  const t = useT(lang)
  const conf = m.recognitionConfidencePct

  if (m.role === 'user') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className={`${styles.row} ${styles.rowUser}`}
      >
        <div className={styles.bubbleUser}>
          <p className={styles.userEmoji}>{m.emoji ?? m.content}</p>
        </div>
      </motion.div>
    )
  }

  const gb = m.gestureBlock

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={`${styles.row} ${styles.rowAssistant}`}
    >
      <div className={styles.bubbleAssistant}>
        {gb ? (
          <>
            <div className={styles.gestureCardHead}>
              <p className={styles.gestureCardTitle}>{gb.headline}</p>
            </div>
            <div className={styles.cardDivider} aria-hidden />
            <div className={styles.gestureCardBody}>
              <div className={styles.langLine}>
                <span className={styles.langTag}>{t('assist_lang_short_uz')}</span>
                <span className={styles.langVal}>{gb.lineUz}</span>
              </div>
              <div className={styles.langLine}>
                <span className={styles.langTag}>{t('assist_lang_short_ru')}</span>
                <span className={styles.langVal}>{gb.lineRu}</span>
              </div>
            </div>
            {typeof conf === 'number' && conf > 0 ? (
              <div className={styles.confidenceStrip}>
                <span className={styles.confidenceLabel}>{t('chat_confidence')}</span>
                <span className={styles.confidenceVal}>{conf}%</span>
              </div>
            ) : null}
            <div className={styles.timeRow}>
              <span>{t('assist_time_label')}</span>
              <time dateTime={new Date(m.ts).toISOString()}>{formatTime(m.ts, lang)}</time>
            </div>
          </>
        ) : (
          <>
            <p className={styles.fallbackBody}>{m.content}</p>
            {(m.translation || m.crossLang) && (
              <div className={styles.fallbackGloss}>
                {m.translation && (
                  <p>
                    <span className={styles.langTag}>{t('chat_label_meaning')} </span>
                    {m.translation}
                  </p>
                )}
                {m.crossLang && (
                  <p>
                    <span className={styles.langTag}>{t('chat_label_alt')} </span>
                    {m.crossLang}
                  </p>
                )}
              </div>
            )}
            <div className={styles.timeRow}>
              <span>{t('assist_time_label')}</span>
              <time dateTime={new Date(m.ts).toISOString()}>{formatTime(m.ts, lang)}</time>
            </div>
          </>
        )}
      </div>
    </motion.div>
  )
})

const ProtocolCard = memo(function ProtocolCard({ entry }: { entry: ProtocolTranscriptEntry }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      className={styles.protocolCard}
    >
      <div className={styles.protocolTime}>[{entry.tsDisplay}]</div>
      <p className={styles.protocolHeadline}>{entry.headline}</p>
      <div className={styles.protocolGrid}>
        {entry.blocks.map((b, i) => (
          <div key={`${entry.id}-${i}`} className={styles.protocolRow}>
            <p className={styles.protocolLabel}>{b.label}</p>
            <p className={styles.protocolValue}>{b.value}</p>
          </div>
        ))}
      </div>
    </motion.div>
  )
})

interface Props {
  lang: Lang
  messages: readonly ChatMessage[]
  protocolEntries: readonly ProtocolTranscriptEntry[]
  multiSnapshot: MultiHandGestureSnapshot | null
  sessionActive: boolean
  cameraOn: boolean
  visionState: VisionDetectionState
  handCount: number
  voiceEnabled: boolean
  speechOk: boolean
  isSpeaking: boolean
  sessionId: string | null
  onToggleVoice: () => void
  onClearChat: () => void
  onExportSessionTxt: () => void
  onExportSessionJson: () => void
  onExportPdfPlaceholder: () => void
}

export default memo(function AssistantPanel({
  lang,
  messages,
  protocolEntries,
  multiSnapshot,
  sessionActive,
  cameraOn,
  visionState,
  handCount,
  voiceEnabled,
  speechOk,
  isSpeaking,
  sessionId,
  onToggleVoice,
  onClearChat,
  onExportSessionTxt,
  onExportSessionJson,
  onExportPdfPlaceholder,
}: Props) {
  const t = useT(lang)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const pinnedToBottomRef = useRef(true)
  const prevCam = useRef(cameraOn)
  const prevVoice = useRef(voiceEnabled)
  const prevVision = useRef(visionState)
  const toastSeq = useRef(0)
  const [toasts, setToasts] = useState<readonly { readonly id: number; readonly key: TranslationKey }[]>([])
  const [copyHint, setCopyHint] = useState<string | null>(null)

  const pushToast = useCallback((key: TranslationKey) => {
    const id = ++toastSeq.current
    setToasts(prev => [...prev.slice(-2), { id, key }])
    window.setTimeout(() => {
      setToasts(prev => prev.filter(x => x.id !== id))
    }, 2600)
  }, [])

  useEffect(() => {
    if (sessionActive && cameraOn && !prevCam.current) pushToast('assist_toast_camera')
    prevCam.current = cameraOn
  }, [sessionActive, cameraOn, pushToast])

  useEffect(() => {
    if (sessionActive && voiceEnabled && !prevVoice.current) pushToast('assist_toast_voice')
    prevVoice.current = voiceEnabled
  }, [sessionActive, voiceEnabled, pushToast])

  useEffect(() => {
    if (sessionActive && cameraOn && visionState === 'ready' && visionIsBootstrapping(prevVision.current)) {
      pushToast('assist_toast_vision')
    }
    prevVision.current = visionState
  }, [sessionActive, cameraOn, visionState, pushToast])

  const liveStatusKey = useMemo((): TranslationKey => {
    if (!sessionActive) return 'assist_status_stopped'
    if (!cameraOn) return 'assist_status_stopped'
    if (visionState === 'loading_models') return 'assist_status_loading_models'
    if (visionState === 'initializing') return 'assist_status_initializing'
    if (visionState === 'error') return 'assist_status_vision_error'
    if (visionState !== 'ready') return 'assist_status_connecting'
    if (handCount === 0) return 'assist_status_waiting'
    return 'assist_status_active'
  }, [sessionActive, cameraOn, visionState, handCount])

  const liveDot = sessionActive && cameraOn && visionState === 'ready'

  const showTyping = useMemo(() => {
    if (!sessionActive || !cameraOn || visionState !== 'ready') return false
    if (handCount === 0 || !multiSnapshot) return false
    return !multiReadyForChat(multiSnapshot)
  }, [sessionActive, cameraOn, visionState, handCount, multiSnapshot])

  const typingPhrase = lang === 'ru' ? t('assist_typing') : t('assist_typing_uz')

  const langChip = lang === 'ru' ? t('assist_lang_short_ru') : t('assist_lang_short_uz')

  const lastSnippet = useMemo(() => {
    const lastP = protocolEntries[protocolEntries.length - 1]
    if (lastP) return lastP.headline
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m.role === 'assistant' && m.gestureBlock) return m.gestureBlock.headline
      if (m.role === 'assistant') return m.content
    }
    return null
  }, [messages, protocolEntries])

  const lastMessageId = messages[messages.length - 1]?.id ?? ''
  const lastProtocolId = protocolEntries[protocolEntries.length - 1]?.id ?? ''
  const scrollAnchor = `${lastProtocolId}|${lastMessageId}`

  useEffect(() => {
    if (messages.length === 0 && protocolEntries.length === 0) pinnedToBottomRef.current = true
  }, [messages.length, protocolEntries.length])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = (): void => {
      pinnedToBottomRef.current = isNearBottom(el)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (!pinnedToBottomRef.current) return
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, scrollAnchor])

  const exportMeta = useMemo(
    () => ({
      sessionId,
      uiLang: lang,
      exportedAt: Date.now(),
    }),
    [sessionId, lang],
  )

  const handleExportTxt = useCallback(() => {
    if (!messages.length) {
      setCopyHint(t('assist_export_empty'))
      window.setTimeout(() => setCopyHint(null), 2000)
      return
    }
    downloadTranscriptTxt(messages, exportMeta)
  }, [messages, exportMeta, t])

  const handleExportJson = useCallback(() => {
    if (!messages.length) {
      setCopyHint(t('assist_export_empty'))
      window.setTimeout(() => setCopyHint(null), 2000)
      return
    }
    downloadTranscriptJson(messages, exportMeta)
  }, [messages, exportMeta, t])

  const handleCopy = useCallback(async () => {
    const payload = lastCopyPayload(messages)
    if (!payload.trim()) {
      setCopyHint(t('assist_copy_empty'))
      window.setTimeout(() => setCopyHint(null), 2000)
      return
    }
    try {
      await navigator.clipboard.writeText(payload)
      setCopyHint(t('assist_copy_ok'))
    } catch {
      setCopyHint(t('assist_copy_empty'))
    }
    window.setTimeout(() => setCopyHint(null), 2000)
  }, [messages, t])

  const handleClear = useCallback(() => {
    startTransition(() => onClearChat())
  }, [onClearChat])

  return (
    <div className={styles.shell}>
      <div className={styles.shellTop}>
        <header className={styles.topHeader}>
          <div className={styles.aiMark} aria-hidden>
            <Sparkles size={20} strokeWidth={1.65} />
          </div>
          <div className={styles.headerMain}>
            <div className={styles.titleRow}>
              <h2 className={styles.title}>{t('chat_title')}</h2>
              <span className={styles.aiBadge}>{t('assist_badge_ai')}</span>
              {protocolEntries.length > 0 ? (
                <span className={styles.protocolBadge}>{t('assist_transcript_title')}</span>
              ) : null}
            </div>
            <div className={styles.headerChips}>
              <span className={`${styles.chip} ${sessionActive ? styles.chipLive : ''}`}>
                <Radio size={12} strokeWidth={2} aria-hidden />
                {sessionActive ? t('header_session_active') : t('header_session_idle')}
              </span>
              <span className={styles.chip}>{langChip}</span>
              <span className={`${styles.chip} ${voiceEnabled ? styles.chipLive : ''}`}>
                {voiceEnabled ? <Volume2 size={12} strokeWidth={2} /> : <VolumeX size={12} strokeWidth={2} />}
                {voiceEnabled ? t('assist_footer_voice_on') : t('assist_footer_voice_off')}
              </span>
            </div>
          </div>
        </header>

        <div className={styles.liveBar} role="status" aria-live="polite">
          <span className={styles.statusDot} data-live={liveDot} />
          <span className={styles.statusText}>{t(liveStatusKey)}</span>
        </div>

        <AnimatePresence initial={false}>
          {showTyping && (
            <motion.div
              key="typing"
              className={styles.typingRow}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className={styles.typingText}>
                {typingPhrase}
                <span className={styles.typingDots} aria-hidden>
                  <span />
                  <span />
                  <span />
                </span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {toasts.length > 0 && (
          <div className={styles.toastStack} aria-live="polite">
            <AnimatePresence>
              {toasts.map(toast => (
                <motion.div
                  key={toast.id}
                  className={styles.toast}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                >
                  {t(toast.key)}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className={styles.threadWrap}>
        <div
          ref={scrollRef}
          className={`${styles.thread} scroll-y-auto`}
          tabIndex={0}
          aria-label={t('chat_title')}
        >
          {protocolEntries.length === 0 && messages.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyArt} aria-hidden>
                <MessageSquareText size={30} strokeWidth={1.5} />
              </div>
              <p className={styles.emptyTitle}>{t('assist_empty_title')}</p>
              <p className={styles.emptySub}>{t('assist_empty_sub')}</p>
            </div>
          ) : protocolEntries.length > 0 ? (
            protocolEntries.map(e => <ProtocolCard key={e.id} entry={e} />)
          ) : (
            messages.map(m => <MessageBubble key={m.id} m={m} lang={lang} />)
          )}
          <div ref={endRef} className={styles.threadSentinel} aria-hidden />
        </div>
      </div>

      <div className={styles.bottomDock}>
        <div className={styles.footerMeta}>
          <span>
            <strong>{t('assist_footer_translation')}</strong>
            {lastSnippet ? ` · ${lastSnippet}` : ' —'}
          </span>
          {sessionActive && cameraOn && visionState === 'ready' && (
            <span>
              <strong>{t('assist_footer_recognition_on')}</strong>
            </span>
          )}
        </div>

        {copyHint && (
          <p className={styles.footerMeta} style={{ paddingTop: 0 }}>
            {copyHint}
          </p>
        )}

        {isSpeaking && voiceEnabled && speechOk && (
          <div className={styles.speakingRow} aria-live="polite">
            <span className={styles.speakingPulse} aria-hidden />
            <div className={styles.wave} aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <span className={styles.speakingLabel}>{t('chat_voice_live')}</span>
          </div>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.actionBtn} onClick={handleClear} disabled={!messages.length}>
            <span className={styles.actionIcon}>
              <Trash2 size={15} strokeWidth={2} />
            </span>
            {t('assist_action_clear')}
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={onToggleVoice}
            disabled={!speechOk}
            aria-pressed={voiceEnabled}
          >
            <span className={styles.actionIcon}>
              {voiceEnabled ? <VolumeX size={15} strokeWidth={2} /> : <Volume2 size={15} strokeWidth={2} />}
            </span>
            {voiceEnabled ? t('assist_action_voice_mute') : t('assist_action_voice_unmute')}
          </button>
          <button type="button" className={styles.actionBtn} onClick={handleExportTxt} disabled={!messages.length}>
            <span className={styles.actionIcon}>
              <FileDown size={15} strokeWidth={2} />
            </span>
            {t('assist_action_export_txt')}
          </button>
          <button type="button" className={styles.actionBtn} onClick={handleExportJson} disabled={!messages.length}>
            <span className={styles.actionIcon}>
              <FileJson size={15} strokeWidth={2} />
            </span>
            {t('assist_action_export_json')}
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={onExportSessionTxt}
            disabled={!protocolEntries.length}
          >
            <span className={styles.actionIcon}>
              <FileDown size={15} strokeWidth={2} />
            </span>
            {t('assist_export_session_txt')}
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={onExportSessionJson}
            disabled={!protocolEntries.length}
          >
            <span className={styles.actionIcon}>
              <FileJson size={15} strokeWidth={2} />
            </span>
            {t('assist_export_session_json')}
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={onExportPdfPlaceholder}
            disabled={!protocolEntries.length}
            title={t('assist_export_pdf_placeholder')}
          >
            <span className={styles.actionIcon}>
              <FileWarning size={15} strokeWidth={2} />
            </span>
            {t('assist_export_pdf_placeholder')}
          </button>
          <button type="button" className={styles.actionBtn} onClick={() => void handleCopy()}>
            <span className={styles.actionIcon}>
              <Copy size={15} strokeWidth={2} />
            </span>
            {t('assist_action_copy')}
          </button>
        </div>
      </div>
    </div>
  )
})
