const DEFAULT_COOLDOWN_MS = 2500

export interface VoiceGate {
  /** Returns true if at least `cooldownMs` passed since last successful consume. */
  tryConsume(nowMs: number): boolean
  reset(): void
}

export function createVoiceGate(cooldownMs: number = DEFAULT_COOLDOWN_MS): VoiceGate {
  let lastAt = 0

  return {
    tryConsume(nowMs: number): boolean {
      if (nowMs - lastAt < cooldownMs) return false
      lastAt = nowMs
      return true
    },
    reset(): void {
      lastAt = 0
    },
  }
}
