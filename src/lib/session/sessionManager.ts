import type { MultiHandGestureSnapshot } from '../../types'
import { CHAT_GESTURE_CONFIDENCE_MIN } from '../translation/gestureTranslations'
import type {
  ForensicDeviceInfo,
  ForensicGestureLogEvent,
  ForensicGestureRecordInput,
  ForensicHandLabel,
  ForensicSession,
  ForensicSessionStartParams,
  ForensicReplayStub,
  SessionEvent,
  SystemEvent,
  VoiceEvent,
} from './sessionTypes'
import { FORENSIC_SESSION_SCHEMA_VERSION } from './sessionTypes'

const REPLAY_STUB: ForensicReplayStub = {
  supported: false,
  notes: 'Replay requires future media sync pipeline.',
}

function uid(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function collectDeviceInfo(): ForensicDeviceInfo {
  if (typeof navigator === 'undefined') {
    return { userAgent: '', platform: '', language: '', hardwareConcurrency: 0 }
  }
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    hardwareConcurrency: navigator.hardwareConcurrency ?? 0,
  }
}

export function inferForensicHandLabel(multi: MultiHandGestureSnapshot): ForensicHandLabel {
  const min = CHAT_GESTURE_CONFIDENCE_MIN
  const lOk =
    multi.left.present && multi.left.stableGesture !== null && multi.left.stableGesture.confidencePct >= min
  const rOk =
    multi.right.present && multi.right.stableGesture !== null && multi.right.stableGesture.confidencePct >= min
  if (lOk && rOk) {
    const lid = multi.left.stableGesture!.id
    const rid = multi.right.stableGesture!.id
    if (lid === rid) return 'Both'
    const lc = multi.left.stableGesture!.confidencePct
    const rc = multi.right.stableGesture!.confidencePct
    return lc >= rc ? 'Left' : 'Right'
  }
  if (lOk) return 'Left'
  if (rOk) return 'Right'
  return 'Unknown'
}

export function inferRecognitionConfidence(multi: MultiHandGestureSnapshot): number {
  const min = CHAT_GESTURE_CONFIDENCE_MIN
  const vals: number[] = []
  if (multi.left.present && multi.left.stableGesture && multi.left.stableGesture.confidencePct >= min) {
    vals.push(multi.left.stableGesture.confidencePct)
  }
  if (multi.right.present && multi.right.stableGesture && multi.right.stableGesture.confidencePct >= min) {
    vals.push(multi.right.stableGesture.confidencePct)
  }
  if (multi.primaryStable && multi.primaryStable.confidencePct >= min) {
    vals.push(multi.primaryStable.confidencePct)
  }
  if (!vals.length) return 0
  return Math.round(Math.max(...vals))
}

type Listener = () => void

const listeners = new Set<Listener>()

function emit(): void {
  listeners.forEach(fn => {
    fn()
  })
}

export function subscribeSessionManager(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

let current: ForensicSession | null = null
let fpsSum = 0
let fpsCount = 0

function freezeSession(s: ForensicSession): ForensicSession {
  return {
    ...s,
    events: s.events.map(e => ({ ...e })),
    stats: { ...s.stats },
    camera: { ...s.camera },
    device: { ...s.device },
    replay: { ...s.replay },
  }
}

export function getCurrentForensicSession(): ForensicSession | null {
  return current ? freezeSession(current) : null
}

export function hydrateForensicSession(session: ForensicSession | null): void {
  if (!session) {
    current = null
    resetFpsStats()
    emit()
    return
  }
  current = {
    ...session,
    events: session.events.map(e => ({ ...e })),
    stats: { ...session.stats },
    camera: { ...session.camera },
    device: { ...session.device },
    replay: { ...session.replay },
  }
  fpsSum =
    session.stats.detectionFpsSampleCount > 0
      ? session.stats.detectionFpsAvg * session.stats.detectionFpsSampleCount
      : 0
  fpsCount = session.stats.detectionFpsSampleCount
  emit()
}

export function resetFpsStats(): void {
  fpsSum = 0
  fpsCount = 0
  if (current) {
    current = {
      ...current,
      stats: { detectionFpsAvg: 0, detectionFpsSampleCount: 0 },
    }
  }
}

export function recordDetectionFpsSample(fps: number): void {
  if (!current || fps <= 0) return
  fpsSum += fps
  fpsCount += 1
  const avg = Math.round((fpsSum / fpsCount) * 10) / 10
  current = {
    ...current,
    stats: {
      detectionFpsAvg: avg,
      detectionFpsSampleCount: fpsCount,
    },
  }
  if (fpsCount % 8 === 0) emit()
}

export function startForensicSession(params: ForensicSessionStartParams): ForensicSession {
  resetFpsStats()
  const startedAt = Date.now()
  const startEv: SystemEvent = {
    kind: 'system',
    id: uid('sys'),
    ts: startedAt,
    code: 'session_start',
  }
  const session: ForensicSession = {
    schemaVersion: FORENSIC_SESSION_SCHEMA_VERSION,
    id: params.id,
    startedAt,
    endedAt: null,
    uiLang: params.uiLang,
    camera: { ...params.camera },
    device: { ...params.device },
    events: [startEv],
    stats: { detectionFpsAvg: 0, detectionFpsSampleCount: 0 },
    replay: REPLAY_STUB,
  }
  current = session
  emit()
  return freezeSession(session)
}

export function endForensicSession(): ForensicSession | null {
  if (!current) return null
  const endEv: SystemEvent = {
    kind: 'system',
    id: uid('sys'),
    ts: Date.now(),
    code: 'session_end',
  }
  const ended: ForensicSession = {
    ...current,
    endedAt: endEv.ts,
    events: [...current.events, endEv],
  }
  current = ended
  emit()
  const snap = freezeSession(ended)
  current = null
  resetFpsStats()
  emit()
  return snap
}

export function clearRecognitionLog(): void {
  if (!current) return
  const cleared: SystemEvent = {
    kind: 'system',
    id: uid('sys'),
    ts: Date.now(),
    code: 'chat_cleared',
  }
  const kept = current.events.filter(e => e.kind === 'system' && e.code === 'session_start')
  current = {
    ...current,
    events: [...kept, cleared],
  }
  emit()
}

function isGestureLog(e: SessionEvent): e is ForensicGestureLogEvent {
  return e.kind === 'gesture_log'
}

function lastGestureIndex(events: readonly SessionEvent[]): number {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].kind === 'gesture_log') return i
  }
  return -1
}

export function appendGroupedGesture(input: ForensicGestureRecordInput): void {
  if (!current) return
  const gi = lastGestureIndex(current.events)
  const last = gi >= 0 ? current.events[gi] : undefined
  if (last && isGestureLog(last) && last.signature === input.signature) {
    const mutable: ForensicGestureLogEvent = {
      ...last,
      tsLast: input.ts,
      confidencePct: input.confidencePct,
      repeatCount: last.repeatCount + 1,
      translationPrimary: input.translationPrimary,
      translationSecondary: input.translationSecondary,
      handLabel: input.handLabel,
    }
    const nextEvents = current.events.slice(0, gi).concat(mutable, current.events.slice(gi + 1))
    current = { ...current, events: nextEvents }
    emit()
    return
  }

  const row: ForensicGestureLogEvent = {
    kind: 'gesture_log',
    id: uid('gst'),
    ts: input.ts,
    tsLast: input.ts,
    signature: input.signature,
    gestureId: input.gestureId,
    emoji: input.emoji,
    gestureLabel: input.gestureLabel,
    translationPrimary: input.translationPrimary,
    translationSecondary: input.translationSecondary,
    confidencePct: input.confidencePct,
    handLabel: input.handLabel,
    repeatCount: 1,
  }
  current = { ...current, events: [...current.events, row] }
  emit()
}

export function appendVoiceEvent(
  ev: Pick<VoiceEvent, 'ts' | 'phase' | 'assistantMessageId' | 'textSnippet'>,
): void {
  if (!current) return
  const row: VoiceEvent = {
    kind: 'voice',
    id: uid('vc'),
    ts: ev.ts,
    phase: ev.phase,
    assistantMessageId: ev.assistantMessageId,
    textSnippet: ev.textSnippet,
  }
  current = { ...current, events: [...current.events, row] }
  emit()
}
