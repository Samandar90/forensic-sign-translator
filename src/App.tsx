import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Header from './components/Header'
import CameraPanel from './components/CameraPanel'
import AnalysisPanel from './components/AnalysisPanel'
import TranscriptPanel from './components/TranscriptPanel'
import LoadingScreen from './components/LoadingScreen'
import { useCamera } from './hooks/useCamera'
import { useHandTracking } from './hooks/useHandTracking'
import { useGestureEngine } from './hooks/useGestureEngine'
import styles from './App.module.css'

export default function App() {
  const [booting, setBooting] = useState(true)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  // Camera layer
  const { cameraState, errorMessage, startCamera, stopCamera } = useCamera(videoRef)

  // Hand tracking layer (active only when camera is live)
  const { canvasRef, trackingStatus, handsDetected, handInfos } =
    useHandTracking(videoRef, cameraState === 'active')

  // Gesture recognition engine — fed by handsDetected signal
  const {
    status,
    transcript,
    startSession,
    stopSession,
    demoReset,
    toggleVoice,
    clearTranscript,
  } = useGestureEngine(videoRef, handsDetected)

  function handleStart() {
    startSession()
    startCamera()
  }

  function handleStop() {
    stopSession()
    stopCamera()
  }

  function handleDemoReset() {
    demoReset()
    stopCamera()
  }

  return (
    <>
      <AnimatePresence>
        {booting && (
          <LoadingScreen key="boot" onComplete={() => setBooting(false)} />
        )}
      </AnimatePresence>

    <motion.div
      className={styles.app}
      initial={{ opacity: 0 }}
      animate={{ opacity: booting ? 0 : 1 }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
    >
      <Header status={status} />

      <main className={styles.main}>
        <motion.div
          className={styles.grid}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <div className={styles.cameraCol}>
            <CameraPanel
              videoRef={videoRef}
              canvasRef={canvasRef}
              cameraState={cameraState}
              errorMessage={errorMessage}
              trackingStatus={trackingStatus}
              handsDetected={handsDetected}
              handInfos={handInfos}
              status={status}
              onStart={handleStart}
              onStop={handleStop}
              onRetryCamera={startCamera}
            />
          </div>

          <div className={styles.analysisCol}>
            <AnalysisPanel status={status} onToggleVoice={toggleVoice} />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
        >
          <TranscriptPanel
            entries={transcript}
            onClear={clearTranscript}
            onDemoReset={handleDemoReset}
          />
        </motion.div>
      </main>

      <div className={styles.ambientTL} />
      <div className={styles.ambientBR} />
    </motion.div>
    </>
  )
}
