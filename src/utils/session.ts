export const MODE_LABEL = 'Uzbek Emergency Sign Mode'

export function createSessionId() {
  return `FST-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export function formatClockTimestamp(date = new Date()) {
  return date.toLocaleTimeString('en-GB', { hour12: false })
}

export function formatProtocolDate(date = new Date()) {
  return date.toLocaleDateString('en-GB')
}
