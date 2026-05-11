import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle, Copy, Download, FileText, RefreshCw, Trash2 } from 'lucide-react'
import type { TranscriptEntry } from '../types'
import { buildProtocolText, copyText, exportProtocolText } from '../utils/protocol'
import styles from './TranscriptPanel.module.css'

interface Props {
  entries: TranscriptEntry[]
  sessionId: string
  onClear: () => void
  onDemoReset: () => void
}

export default function TranscriptPanel({ entries, sessionId, onClear, onDemoReset }: Props) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const prevLengthRef = useRef(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (entries.length > prevLengthRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }

    prevLengthRef.current = entries.length
  }, [entries.length])

  async function handleCopy() {
    await copyText(buildProtocolText(entries, sessionId))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  function handleExport() {
    exportProtocolText(buildProtocolText(entries, sessionId), sessionId)
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <FileText size={14} strokeWidth={1.5} />
          <span className={styles.title}>Transcript</span>
          {entries.length > 0 && <span className={styles.count}>{entries.length}</span>}
        </div>

        <div className={styles.actions}>
          <motion.button
            className={`${styles.actionBtn} ${copied ? styles.actionBtnSuccess : ''}`}
            onClick={handleCopy}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            disabled={entries.length === 0}
          >
            {copied ? <><CheckCircle size={11} strokeWidth={2} /> Copied</> : <><Copy size={11} strokeWidth={2} /> Copy Protocol</>}
          </motion.button>

          <motion.button
            className={styles.actionBtn}
            onClick={handleExport}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            disabled={entries.length === 0}
          >
            <Download size={11} strokeWidth={2} />
            Export TXT
          </motion.button>

          <motion.button
            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            onClick={onClear}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            disabled={entries.length === 0}
          >
            <Trash2 size={11} strokeWidth={2} />
            Clear
          </motion.button>

          <motion.button
            className={`${styles.actionBtn} ${styles.actionBtnReset}`}
            onClick={onDemoReset}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <RefreshCw size={11} strokeWidth={2} />
            Reset Session
          </motion.button>
        </div>
      </div>

      <div className={styles.body} ref={listRef}>
        <AnimatePresence mode="wait">
          {entries.length === 0 ? (
            <motion.div
              key="empty"
              className={styles.emptyState}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <FileText size={26} strokeWidth={1} style={{ color: 'rgba(0,212,255,0.14)' }} />
              <p>Waiting for locked gestures</p>
              <span>Only confirmed translations are added to the transcript.</span>
            </motion.div>
          ) : (
            <motion.div
              key="list"
              className={styles.list}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {entries.map((entry, index) => (
                <motion.div
                  key={entry.id}
                  className={styles.row}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                  layout
                >
                  <span className={styles.rowNum}>{index + 1}.</span>
                  <span className={styles.rowTime}>[{entry.timestamp}]</span>
                  <p className={styles.rowPhrase}>{entry.translation}</p>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
