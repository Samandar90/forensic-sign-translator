/** Buffers raw FPS values and emits display samples at most once per `intervalMs`. */
export function createFpsUiEmitter(intervalMs: number = 1000) {
  let lastEmitAt = 0
  let lastCamera = 0
  let lastDetection = 0

  return {
    /**
     * Feed latest instantaneous values; returns rounded pair when a new UI tick is due.
     */
    maybeEmit(nowMs: number, cameraFps: number, detectionFps: number): { camera: number; detection: number } | null {
      lastCamera = cameraFps
      lastDetection = detectionFps
      if (lastEmitAt === 0) {
        lastEmitAt = nowMs
        return {
          camera: Math.max(0, Math.round(lastCamera)),
          detection: Math.max(0, Math.round(lastDetection)),
        }
      }
      if (nowMs - lastEmitAt < intervalMs) return null
      lastEmitAt = nowMs
      return {
        camera: Math.max(0, Math.round(lastCamera)),
        detection: Math.max(0, Math.round(lastDetection)),
      }
    },
  }
}
