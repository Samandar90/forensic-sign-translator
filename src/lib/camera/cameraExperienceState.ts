import type { CameraState } from '../../hooks/useCamera'
import type { RecognitionFlowPhase } from '../../types'

/** UX-level camera lifecycle (independent of legacy stream state string). */
export const CameraExperienceState = {
  IDLE: 'IDLE',
  INITIALIZING: 'INITIALIZING',
  ACTIVE: 'ACTIVE',
  ERROR: 'ERROR',
  STOPPED: 'STOPPED',
} as const

export type CameraExperienceState = (typeof CameraExperienceState)[keyof typeof CameraExperienceState]

export function mapToCameraExperienceState(
  legacy: CameraState,
  recognitionPhase: RecognitionFlowPhase,
): CameraExperienceState {
  if (legacy === 'denied' || legacy === 'unavailable' || legacy === 'error') {
    return CameraExperienceState.ERROR
  }
  if (legacy === 'requesting') {
    return CameraExperienceState.INITIALIZING
  }
  if (legacy === 'active') {
    return CameraExperienceState.ACTIVE
  }
  if (legacy === 'idle' && recognitionPhase === 'stopped') {
    return CameraExperienceState.STOPPED
  }
  return CameraExperienceState.IDLE
}
