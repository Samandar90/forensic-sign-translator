import type { GestureSmootherOptions } from '../gestures/gestureSmoother'
import type { RecognitionSettings, TriLevel } from './settingsTypes'

function smoothingBase(level: TriLevel): Pick<GestureSmootherOptions, 'window' | 'minVotes' | 'minAvgConf'> {
  switch (level) {
    case 'low':
      return { window: 10, minVotes: 6, minAvgConf: 0.7 }
    case 'high':
      return { window: 18, minVotes: 10, minAvgConf: 0.82 }
    default:
      return { window: 14, minVotes: 8, minAvgConf: 0.76 }
  }
}

/** Maps persisted recognition UI → gesture smoother parameters. */
export function buildSmootherOptionsFromRecognition(r: RecognitionSettings): GestureSmootherOptions {
  const base = smoothingBase(r.smoothingLevel)
  const sens = r.gestureSensitivity === 'low' ? -1 : r.gestureSensitivity === 'high' ? 1 : 0
  const minVotes = Math.max(4, Math.min(14, base.minVotes + sens))
  const thr = (r.confidenceThreshold - 78) * 0.001
  const minAvgConf = Math.min(0.92, Math.max(0.58, base.minAvgConf + thr))
  return { window: base.window, minVotes, minAvgConf }
}

export function recognitionChannelSignature(r: RecognitionSettings): string {
  return `${r.gestureSensitivity}|${r.confidenceThreshold}|${r.smoothingLevel}|${r.motionSensitivity}`
}
