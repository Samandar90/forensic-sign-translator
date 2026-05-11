import { useState, useEffect } from 'react'

export function useClock() {
  const [time, setTime] = useState(() => formatTime())

  useEffect(() => {
    const id = setInterval(() => setTime(formatTime()), 1000)
    return () => clearInterval(id)
  }, [])

  return time
}

function formatTime() {
  const d = new Date()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  const ms = String(Math.floor(d.getMilliseconds() / 10)).padStart(2, '0')
  return `${hh}:${mm}:${ss}.${ms}`
}
