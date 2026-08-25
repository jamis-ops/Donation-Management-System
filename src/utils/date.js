/**
 * Shared date utility helper functions.
 */

/**
 * Returns today's date formatted as YYYY-MM-DD in local time.
 * Perfect for `min` attribute on <input type="date">.
 */
export function getTodayDateString() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Checks if a given date string or Date object is strictly before today (local date).
 */
export function isPastDateString(dateVal) {
  if (!dateVal || dateVal === '—') return false
  let key = ''
  if (typeof dateVal === 'string') {
    key = dateVal.slice(0, 10)
  } else if (dateVal instanceof Date) {
    const y = dateVal.getFullYear()
    const m = String(dateVal.getMonth() + 1).padStart(2, '0')
    const d = String(dateVal.getDate()).padStart(2, '0')
    key = `${y}-${m}-${d}`
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false
  return key < getTodayDateString()
}

/**
 * Formats a date into a standard YYYY-MM-DD key.
 */
export function formatDateKey(dateVal) {
  if (!dateVal || dateVal === '—') return ''
  if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateVal)) {
    return dateVal.slice(0, 10)
  }
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
