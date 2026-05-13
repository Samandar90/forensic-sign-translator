import { useCallback, useMemo, useRef, useState, memo, useEffect, useLayoutEffect, startTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Header from './components/Header'
import CameraPanel from './components/CameraPanel'
import AssistantPanel from './components/AssistantPanel'
import GestureAnalysisPanel from './components/GestureAnalysisPanel'
import GestureDock from './components/GestureDock'
import LoadingScreen from './components/LoadingScreen'
import SystemStatusStrip from './components/SystemStatusStrip'
import AppControlBar from './components/AppControlBar'
import ShortcutsModal from './components/ShortcutsModal'
import { useCamera } from './hooks/useCamera'
import { useAppSettings } from './hooks/useAppSettings'
import { useHotkeys } from './hooks/useHotkeys'
import SessionHistoryModal from './components/SessionHistoryModal'
import SettingsModal from './components/SettingsModal'
import type { Lang, TranslationKey } from './i18n'
import { useT } from './i18n'
import type { VideoQualityPreset } from './lib/camera/adaptiveQuality'
import type { RecognitionFlowPhase, ChatMessage, MultiHandGestureSnapshot } from './types'
import type { AdvancedGestureId } from './lib/gestures/gestureTypes'
import { speakAssistant, speechAvailable } from './lib/voice/speak'
import { buildSpeakSummary } from './utils/speakSummary'
import {
  multiReadyForChat,
  stableGestureSignatureForChat,
  buildGestureChatBlock,
  phraseFromMultiHand,
  gestureDisplayName,
  CHAT_COOLDOWN_MS,
} from './lib/translation/gestureTranslations'
import { buildProtocolTranscriptEntries } from './lib/session/transcriptBuilder'
import { downloadSessionJson, downloadSessionTxt } from './lib/session/exportSession'
import { buildPdfExportPlaceholder } from './lib/export/pdfExport'
import {
  listStoredSessions,
  loadPrefs,
  pushSessionToHistory,
  clearStoredSessionHistory,
} from './lib/session/sessionStorage'
import { getSettings, resetSettings } from './lib/settings/settingsManager'
import type { VisionUiSnapshot } from './hooks/useVisionDetection'
import { useVisionDetection } from './hooks/useVisionDetection'
import { useSession } from './hooks/useSession'
import { useForensicSession } from './hooks/useForensicSession'
import type { WorkspaceHydrationProps } from './lib/persistence/hydration'
import {
  registerWorkspacePersistReaders,
  scheduleWorkspacePersistDebounced,
  flushWorkspacePersistExplicit,
  installWorkspaceBeforeUnload,
} from './lib/persistence/persistenceManager'
import {
  collectDeviceInfo,
  getCurrentForensicSession,
  hydrateForensicSession,
  inferForensicHandLabel,
  inferRecognitionConfidence,
} from './lib/session/sessionManager'
import type { ForensicSession } from './lib/session/sessionTypes'
import styles from './App.module.css'

const GESTURE_EMOJI: Record<AdvancedGestureId, string> = {
  LIKE: '👍',
  PEACE: '✌️',
  HELLO: '👋',
  STOP: '✋',
  FIST: '👊',
}

function userEmojisFromMulti(m: MultiHandGestureSnapshot): string {
  const parts: string[] = []
  if (m.left.present && m.left.stableGesture) parts.push(GESTURE_EMOJI[m.left.stableGesture.id])
  if (m.right.present && m.right.stableGesture) {
    const id = m.right.stableGesture.id
    if (!m.left.stableGesture || m.left.stableGesture.id !== id) {
      parts.push(GESTURE_EMOJI[id])
    }
  }
  return parts.join(' ')
}

function computeRecognitionPhase(
  isActive: boolean,
  cameraState: string,
  hadSession: boolean,
): RecognitionFlowPhase {
  if (cameraState === 'denied' || cameraState === 'unavailable' || cameraState === 'error') {
    return 'error'
  }
  if (cameraState === 'requesting') return 'starting'
  if (!isActive && cameraState === 'idle') return hadSession ? 'stopped' : 'idle'
  if (isActive && cameraState === 'active') return 'active'
  if (isActive && cameraState !== 'active') return 'starting'
  return 'idle'
}

const MemoHeader = memo(Header)
const MemoCamera = memo(CameraPanel)
const MemoAnalysis = memo(GestureAnalysisPanel)
const MemoAssistant = memo(AssistantPanel)
const MemoDock = memo(GestureDock)

export default function App({ workspaceHydration }: { readonly workspaceHydration: WorkspaceHydrationProps }) {
  const { settings, patch } = useAppSettings()
  const [booting, setBooting] = useState(true)
  const [lang, setLang] = useState<Lang>(() => getSettings().general.uiLang)
  const t = useT(lang)
  const [hadSession, setHadSession] = useState(
    () => workspaceHydration.hadForensicSession || workspaceHydration.restoredFromDisk,
  )
  const [messages, setMessages] = useState<ChatMessage[]>(() => [...workspaceHydration.initialMessages])
  const [cameraCleanView, setCameraCleanView] = useState(() => getSettings().camera.cleanViewDefault)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [historyEpoch, setHistoryEpoch] = useState(0)
  const [dataToast, setDataToast] = useState<string | null>(null)
  const [extraBootKey, setExtraBootKey] = useState<TranslationKey | null>(() =>
    workspaceHydration.restoredFromDisk ? 'boot_workspace_restore' : null,
  )

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fsToggleRef = useRef<(() => void) | null>(null)
  const voiceRef = useRef(settings.voice)
  voiceRef.current = settings.voice

  const persistSnapshotRef = useRef({
    isActive: workspaceHydration.workspaceActive,
    sessionId: workspaceHydration.workspaceSessionId,
    messages: workspaceHydration.initialMessages as readonly ChatMessage[],
  })

  const visionUiRef = useRef<VisionUiSnapshot>({
    overlayVisible: true,
    landmarkDebug: false,
    intelligenceDebug: false,
    mirrorForPreview: true,
  })
  visionUiRef.current = {
    overlayVisible: settings.camera.overlayVisible,
    landmarkDebug: Boolean(import.meta.env.DEV && settings.advanced.landmarkDebugOverlay),
    intelligenceDebug: Boolean(import.meta.env.DEV && settings.advanced.debugGestures),
    mirrorForPreview: settings.camera.mirrorCamera,
  }

  const { cameraState, errorCode, qualityPreset, startCamera, stopCamera, setQualityPresetAndRestart, applyQualityWhenIdle } =
    useCamera(videoRef, getSettings().camera.preferredQuality)
  const {
    isActive,
    voiceEnabled,
    sessionId,
    startSession,
    startSessionWithExistingId,
    stopSession,
    toggleVoice,
    applySessionId,
  } = useSession({
    initialSessionId: workspaceHydration.workspaceSessionId,
    initialWorkspaceActive: workspaceHydration.workspaceActive,
  })
  const forensic = useForensicSession()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  persistSnapshotRef.current = { isActive, sessionId, messages }

  useEffect(() => {
    applyQualityWhenIdle(settings.camera.preferredQuality)
  }, [settings.camera.preferredQuality, applyQualityWhenIdle])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.highContrast = settings.accessibility.highContrast ? 'true' : 'false'
    root.dataset.largeControls = settings.accessibility.largerControls ? 'true' : 'false'
    root.dataset.compactUi = settings.interface.compactMode ? 'true' : 'false'
    const reduceMotion =
      settings.accessibility.reducedMotion ||
      settings.interface.reducedAnimations ||
      !settings.general.animationsEnabled
    root.dataset.reducedMotion = reduceMotion ? 'true' : 'false'
    root.dataset.panelDensity = settings.interface.panelDensity
    root.dataset.srEnhanced = settings.accessibility.screenReaderEnhancedLabels ? 'true' : 'false'
    root.dataset.kbdHints = settings.accessibility.keyboardNavigationHints ? 'true' : 'false'
  }, [settings])

  const visionOn = isActive && cameraState === 'active'
  const { handCount, personPresent, primaryHand, multiSnapshot, stableGesture, state: visionState, detectionFps } =
    useVisionDetection(videoRef, canvasRef, visionOn, lang, cameraCleanView, settings.recognition, visionUiRef)

  const detectionFpsRef = useRef(detectionFps)
  useEffect(() => {
    detectionFpsRef.current = detectionFps
  }, [detectionFps])

  const storedSessions = useMemo(() => (historyOpen ? listStoredSessions() : []), [historyOpen, historyEpoch])

  const protocolEntries = useMemo(
    () => buildProtocolTranscriptEntries(forensic.session?.events ?? [], lang),
    [forensic.session, lang],
  )

  useEffect(() => {
    if (!isActive) return
    const id = window.setInterval(() => {
      const v = detectionFpsRef.current
      if (v > 0) forensic.sampleFps(v)
    }, 2000)
    return () => window.clearInterval(id)
  }, [isActive, forensic])

  const [ttsSpeaking, setTtsSpeaking] = useState(false)
  const ttsCallbacks = useMemo(
    () => ({
      onStart: () => setTtsSpeaking(true),
      onEnd: () => setTtsSpeaking(false),
    }),
    [],
  )

  const lastChatSigRef = useRef<string | null>(null)
  const lastChatAtRef = useRef(0)
  const lastSpokenMsgRef = useRef<string | null>(null)
  const lastSpeakAtRef = useRef(0)
  const lastTtsPhraseRef = useRef<string | null>(null)

  useEffect(() => {
    lastChatSigRef.current = null
  }, [lang])

  useLayoutEffect(() => {
    return registerWorkspacePersistReaders({
      readWorkspaceActive: () => persistSnapshotRef.current.isActive,
      readWorkspaceSessionId: () => persistSnapshotRef.current.sessionId,
      readChatMessages: () => persistSnapshotRef.current.messages,
    })
  }, [])

  useEffect(() => {
    return installWorkspaceBeforeUnload(() => {
      flushWorkspacePersistExplicit({
        workspaceActive: persistSnapshotRef.current.isActive,
        workspaceSessionId: persistSnapshotRef.current.sessionId,
        forensicSession: getCurrentForensicSession(),
        chatMessages: persistSnapshotRef.current.messages,
      })
    })
  }, [])

  useEffect(() => {
    scheduleWorkspacePersistDebounced()
  }, [
    isActive,
    sessionId,
    messages,
    forensic.session?.id,
    forensic.session?.events.length,
    forensic.session?.stats?.detectionFpsAvg,
    forensic.session?.stats?.detectionFpsSampleCount,
  ])

  const prevIsActiveRef = useRef<boolean | null>(null)
  useEffect(() => {
    const prev = prevIsActiveRef.current
    prevIsActiveRef.current = isActive
    if (prev === true && !isActive) {
      startTransition(() => {
        setMessages([])
      })
      lastChatSigRef.current = null
      lastChatAtRef.current = 0
      lastSpokenMsgRef.current = null
      lastSpeakAtRef.current = 0
      lastTtsPhraseRef.current = null
    }
  }, [isActive])

  useEffect(() => {
    if (!visionOn || !multiSnapshot) return
    if (!multiReadyForChat(multiSnapshot)) return

    const sig = stableGestureSignatureForChat(multiSnapshot)
    if (!sig) return
    if (lastChatSigRef.current === sig) return

    const now = Date.now()
    if (now - lastChatAtRef.current < CHAT_COOLDOWN_MS) return

    lastChatSigRef.current = sig
    lastChatAtRef.current = now

    const base = Date.now()
    const suffix = `${base}-${sig}`
    const emoji = userEmojisFromMulti(multiSnapshot)
    const gestureBlock = buildGestureChatBlock(multiSnapshot, lang, emoji)
    if (!gestureBlock) return

    const content = phraseFromMultiHand(multiSnapshot, lang)
    const otherLine = lang === 'ru' ? gestureBlock.lineUz : gestureBlock.lineRu
    const translation = otherLine === content ? undefined : otherLine

    const primaryId = gestureBlock.primaryGestureId
    if (primaryId) {
      forensic.appendGesture({
        ts: base,
        signature: sig,
        gestureId: primaryId,
        emoji,
        gestureLabel: gestureDisplayName(primaryId, lang),
        translationPrimary: content,
        translationSecondary: translation ?? null,
        confidencePct: inferRecognitionConfidence(multiSnapshot),
        handLabel: inferForensicHandLabel(multiSnapshot),
      })
    }

    setMessages(prev => {
      const next: ChatMessage[] = [
        ...prev,
        { id: `u-${suffix}`, role: 'user', content: emoji, emoji, ts: base },
        {
          id: `a-${suffix}`,
          role: 'assistant',
          content,
          translation,
          gestureBlock,
          ts: base,
          recognitionConfidencePct: inferRecognitionConfidence(multiSnapshot),
        },
      ]
      return next.slice(-20)
    })
  }, [multiSnapshot, visionOn, lang, forensic])

  useEffect(() => {
    if (!voiceEnabled || !speechAvailable()) return
    const last = messages[messages.length - 1]
    if (!last || last.role !== 'assistant') return
    if (lastSpokenMsgRef.current === last.id) return

    const text = last.content.trim()
    if (!text) return

    const v = voiceRef.current
    if (v.muteDuplicatePhrases && lastTtsPhraseRef.current === text) {
      lastSpokenMsgRef.current = last.id
      return
    }

    const delayMs = Math.max(120, 2500 - (Date.now() - lastSpeakAtRef.current))
    const timer = window.setTimeout(() => {
      lastSpeakAtRef.current = Date.now()
      lastSpokenMsgRef.current = last.id
      lastTtsPhraseRef.current = text
      void speakAssistant(text, lang, {
        rate: v.speechRate,
        volume: v.speechVolume,
        speechLang: v.speechLang,
        preferredVoiceId: v.preferredVoiceId,
        onStart: () => {
          forensic.logVoice({
            ts: Date.now(),
            phase: 'playback_start',
            assistantMessageId: last.id,
            textSnippet: text.slice(0, 160),
          })
          setTtsSpeaking(true)
        },
        onEnd: () => {
          forensic.logVoice({
            ts: Date.now(),
            phase: 'playback_end',
            assistantMessageId: last.id,
            textSnippet: null,
          })
          setTtsSpeaking(false)
        },
      })
    }, delayMs)

    return () => window.clearTimeout(timer)
  }, [messages, voiceEnabled, lang, forensic])

  const flashDataToast = useCallback((text: string) => {
    setDataToast(text)
    window.setTimeout(() => setDataToast(null), 2200)
  }, [])

  const handleClearTranscriptForSettings = useCallback(() => {
    if (getCurrentForensicSession()) forensic.clearRecognitionLog()
    startTransition(() => {
      setMessages([])
    })
    lastChatSigRef.current = null
    lastChatAtRef.current = 0
    lastSpokenMsgRef.current = null
    lastSpeakAtRef.current = 0
    lastTtsPhraseRef.current = null
    flushWorkspacePersistExplicit({
      workspaceActive: persistSnapshotRef.current.isActive,
      workspaceSessionId: persistSnapshotRef.current.sessionId,
      forensicSession: getCurrentForensicSession(),
      chatMessages: [],
    })
    flashDataToast(t('settings_toast_transcript_cleared'))
  }, [forensic, flashDataToast, t])

  const handleClearSessionHistoryForSettings = useCallback(() => {
    clearStoredSessionHistory()
    setHistoryEpoch(e => e + 1)
    flashDataToast(t('settings_toast_history_cleared'))
  }, [flashDataToast, t])

  const handleResetAppSettingsForData = useCallback(() => {
    const next = resetSettings()
    setLang(next.general.uiLang)
    flashDataToast(t('settings_toast_settings_reset'))
  }, [flashDataToast, t])

  const handleRestoreStoredSession = useCallback(
    (s: ForensicSession) => {
      hydrateForensicSession(structuredClone(s))
      applySessionId(s.id)
      setHadSession(true)
      startTransition(() => {
        setMessages([])
      })
      lastChatSigRef.current = null
      lastChatAtRef.current = 0
      lastSpokenMsgRef.current = null
      lastSpeakAtRef.current = 0
      lastTtsPhraseRef.current = null
      setHistoryOpen(false)
      flushWorkspacePersistExplicit({
        workspaceActive: persistSnapshotRef.current.isActive,
        workspaceSessionId: s.id,
        forensicSession: getCurrentForensicSession(),
        chatMessages: [],
      })
      scheduleWorkspacePersistDebounced()
      flashDataToast(t('history_restored_toast'))
    },
    [applySessionId, flashDataToast, t],
  )

  useEffect(() => {
    if (!booting && extraBootKey) {
      setExtraBootKey(null)
    }
  }, [booting, extraBootKey])

  const recognitionPhase = useMemo(
    () => computeRecognitionPhase(isActive, cameraState, hadSession),
    [isActive, cameraState, hadSession],
  )

  const handleStart = useCallback(() => {
    setHadSession(true)
    const existing = getCurrentForensicSession()
    if (existing && existing.endedAt === null) {
      startSessionWithExistingId(existing.id)
      setCameraCleanView(getSettings().camera.cleanViewDefault)
      void startCamera()
      return
    }
    const id = startSession()
    setCameraCleanView(getSettings().camera.cleanViewDefault)
    forensic.startForensicSession({
      id,
      uiLang: lang,
      camera: { qualityPreset },
      device: collectDeviceInfo(),
    })
    void startCamera()
  }, [startCamera, startSession, startSessionWithExistingId, lang, qualityPreset, forensic])

  const handleStop = useCallback(() => {
    const ended = forensic.endForensicSession()
    if (ended && loadPrefs().autoSaveSession) {
      pushSessionToHistory(ended)
    }
    const sid = sessionId
    const chatSnap = messages
    stopSession()
    stopCamera()
    flushWorkspacePersistExplicit({
      workspaceActive: false,
      workspaceSessionId: sid,
      forensicSession: null,
      chatMessages: chatSnap,
    })
  }, [forensic, stopSession, stopCamera, sessionId, messages])

  const handleRestartCameraWithPreset = useCallback(
    (preset: VideoQualityPreset) => setQualityPresetAndRestart(preset),
    [setQualityPresetAndRestart],
  )

  const handleSpeak = useCallback(async () => {
    if (!voiceEnabled || !speechAvailable()) return
    const text = buildSpeakSummary(lang, {
      sessionActive: isActive,
      cameraOn: cameraState === 'active',
      visionState,
      handCount,
      personPresent,
      primaryHand,
    })
    const v = voiceRef.current
    await speakAssistant(text, lang, {
      ...ttsCallbacks,
      rate: v.speechRate,
      volume: v.speechVolume,
      speechLang: v.speechLang,
      preferredVoiceId: v.preferredVoiceId,
    })
  }, [voiceEnabled, lang, isActive, cameraState, visionState, handCount, personPresent, primaryHand, ttsCallbacks])

  const handleClearChat = useCallback(() => {
    forensic.clearRecognitionLog()
    startTransition(() => {
      setMessages([])
    })
    lastChatSigRef.current = null
    lastChatAtRef.current = 0
    lastSpokenMsgRef.current = null
    lastTtsPhraseRef.current = null
    flushWorkspacePersistExplicit({
      workspaceActive: persistSnapshotRef.current.isActive,
      workspaceSessionId: persistSnapshotRef.current.sessionId,
      forensicSession: getCurrentForensicSession(),
      chatMessages: [],
    })
  }, [forensic])

  const handleExportSessionTxt = useCallback(() => {
    const s = getCurrentForensicSession()
    if (!s || !s.events.some(e => e.kind === 'gesture_log')) return
    downloadSessionTxt(s, { includeDeviceDetails: loadPrefs().exportIncludeDeviceDetails })
  }, [])

  const handleExportSessionJson = useCallback(() => {
    const s = getCurrentForensicSession()
    if (!s || !s.events.some(e => e.kind === 'gesture_log')) return
    downloadSessionJson(s)
  }, [])

  const handlePdfPlaceholder = useCallback(() => {
    const s = getCurrentForensicSession()
    if (!s) return
    const p = buildPdfExportPlaceholder(s)
    window.alert(p.message)
  }, [])

  const handleLangChange = useCallback((l: Lang) => {
    setLang(l)
    patch({ general: { uiLang: l } })
  }, [patch])

  const handleUiLangFromSettings = useCallback((l: Lang) => {
    setLang(l)
  }, [])

  const hotkeysEnabled = !booting && !settingsOpen && !historyOpen && !shortcutsOpen

  useHotkeys(
    {
      onToggleSession: () => {
        if (isActive) handleStop()
        else void handleStart()
      },
      onToggleFullscreen: () => fsToggleRef.current?.(),
      onMuteVoice: () => toggleVoice(),
      onClearTranscript: () => handleClearChat(),
    },
    { enabled: hotkeysEnabled },
  )

  const motionReduced =
    settings.accessibility.reducedMotion ||
    settings.interface.reducedAnimations ||
    !settings.general.animationsEnabled

  const appShellClass = [
    styles.app,
    settings.interface.cleanMode ? styles.appClean : '',
    settings.interface.presentationMode ? styles.appPresent : '',
    settings.interface.comfortableSpacing ? styles.appComfort : '',
    settings.interface.panelDensity === 'compact' ? styles.appDensityCompact : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <AnimatePresence>
        {booting && (
          <LoadingScreen
            key="boot"
            lang={lang}
            onComplete={() => setBooting(false)}
            bootSubline={extraBootKey ? t(extraBootKey) : null}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {dataToast ? (
          <motion.p
            key="data-toast"
            className={styles.dataToast}
            role="status"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2 }}
          >
            {dataToast}
          </motion.p>
        ) : null}
      </AnimatePresence>

      <motion.div
        className={appShellClass}
        initial={{ opacity: 0 }}
        animate={{ opacity: booting ? 0 : 1 }}
        transition={{ duration: motionReduced ? 0.05 : 0.45, ease: 'easeOut' }}
      >
        {!settings.interface.cleanMode && (
          <MemoHeader
            lang={lang}
            sessionActive={isActive}
            sessionId={sessionId}
            onLangChange={handleLangChange}
            onOpenHistory={() => setHistoryOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenShortcuts={() => setShortcutsOpen(true)}
          />
        )}

        {!settings.interface.cleanMode && (
          <SystemStatusStrip
            lang={lang}
            cameraOn={cameraState === 'active'}
            voiceEnabled={voiceEnabled}
            sessionActive={isActive}
            visionState={visionState}
            detectionFps={detectionFps}
            forensicSession={forensic.session}
            workspaceSessionId={sessionId}
          />
        )}

        <AppControlBar
          lang={lang}
          cleanMode={settings.interface.cleanMode}
          presentationMode={settings.interface.presentationMode}
          onToggleClean={() => patch({ interface: { cleanMode: !settings.interface.cleanMode } })}
          onTogglePresentation={() =>
            patch({ interface: { presentationMode: !settings.interface.presentationMode } })}
          onOpenShortcuts={() => setShortcutsOpen(true)}
        />

        <SessionHistoryModal
          lang={lang}
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          sessions={storedSessions}
          onRestoreSession={handleRestoreStoredSession}
        />
        <SettingsModal
          lang={lang}
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          onUiLangChange={handleUiLangFromSettings}
          onClearTranscript={handleClearTranscriptForSettings}
          onClearSessionHistory={handleClearSessionHistoryForSettings}
          onResetAppSettings={handleResetAppSettingsForData}
        />
        <ShortcutsModal lang={lang} open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

        <main id="workspace" className={styles.main}>
          <div className={styles.workspaceGrid}>
            <div className={styles.colCamera}>
              <MemoCamera
                videoRef={videoRef}
                canvasRef={canvasRef}
                cameraState={cameraState}
                errorCode={errorCode}
                sessionActive={isActive}
                lang={lang}
                recognitionPhase={recognitionPhase}
                detectionFps={detectionFps}
                qualityPreset={qualityPreset}
                visionState={visionState}
                stableGesture={stableGesture}
                cleanView={cameraCleanView}
                onCleanViewChange={setCameraCleanView}
                onRetryCamera={startCamera}
                onRestartWithPreset={handleRestartCameraWithPreset}
                voiceEnabled={voiceEnabled}
                speechOk={speechAvailable()}
                onToggleVoice={toggleVoice}
                autoQualityEnabled={settings.camera.autoQuality}
                showFpsOverlay={Boolean(import.meta.env.DEV && settings.advanced.fpsOverlay)}
                fullscreenDefault={settings.camera.fullscreenDefault}
                activeSessionId={isActive ? sessionId : null}
                onRegisterFullscreenToggle={fn => {
                  fsToggleRef.current = fn
                }}
              />
            </div>
            <div className={styles.colCenter}>
              <MemoAnalysis
                lang={lang}
                sessionActive={isActive}
                cameraOn={cameraState === 'active'}
                visionState={visionState}
                handCount={handCount}
                personPresent={personPresent}
                multiSnapshot={multiSnapshot}
                showIntelligenceDebug={Boolean(import.meta.env.DEV && settings.advanced.debugGestures)}
              />
            </div>
            <div className={styles.colChat}>
              <MemoAssistant
                lang={lang}
                messages={messages}
                protocolEntries={protocolEntries}
                multiSnapshot={multiSnapshot}
                sessionActive={isActive}
                cameraOn={cameraState === 'active'}
                visionState={visionState}
                handCount={handCount}
                voiceEnabled={voiceEnabled}
                speechOk={speechAvailable()}
                isSpeaking={ttsSpeaking}
                sessionId={sessionId}
                onToggleVoice={toggleVoice}
                onClearChat={handleClearChat}
                onExportSessionTxt={handleExportSessionTxt}
                onExportSessionJson={handleExportSessionJson}
                onExportPdfPlaceholder={handlePdfPlaceholder}
              />
            </div>
          </div>
        </main>

        {!settings.interface.cleanMode && (
          <div className={styles.dockWrap}>
            <MemoDock
              lang={lang}
              sessionActive={isActive}
              voiceEnabled={voiceEnabled}
              speechOk={speechAvailable()}
              activeGestureId={stableGesture?.id ?? null}
              onStart={handleStart}
              onStop={handleStop}
              onToggleVoice={toggleVoice}
              onSpeakSummary={handleSpeak}
            />
          </div>
        )}
      </motion.div>
    </>
  )
}
