/**
 * Imperative toast API — works in React components and plain modules
 * (exportData, printCertificate, etc.). ToastProvider registers the pusher.
 */

let pushToast = null
const suppressUntil = new Map()

export function registerToastPusher(fn) {
  pushToast = typeof fn === 'function' ? fn : null
}

/** Suppress matching notification toasts briefly (avoids duplicate after local action). */
export function suppressNotificationToast(key, ms = 15000) {
  if (!key) return
  suppressUntil.set(String(key), Date.now() + ms)
}

export function isNotificationToastSuppressed(key) {
  const until = suppressUntil.get(String(key || ''))
  if (!until) return false
  if (Date.now() > until) {
    suppressUntil.delete(String(key))
    return false
  }
  return true
}

/**
 * @param {string} message
 * @param {'success'|'error'|'info'|'warning'} [type]
 * @param {number} [durationMs]
 */
export function toast(message, type = 'info', durationMs) {
  const text = String(message ?? '').trim()
  if (!text) return
  if (pushToast) {
    pushToast({ message: text, type, duration: durationMs })
    return
  }
  // Fallback before provider mounts (should be rare)
  if (typeof console !== 'undefined') {
    console[type === 'error' ? 'error' : 'log'](`[toast:${type}]`, text)
  }
}

export const notify = {
  success: (message, durationMs) => toast(message, 'success', durationMs),
  error: (message, durationMs) => toast(message, 'error', durationMs),
  info: (message, durationMs) => toast(message, 'info', durationMs),
  warning: (message, durationMs) => toast(message, 'warning', durationMs),
}

export default notify
