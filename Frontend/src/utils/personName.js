/**
 * Shared LN / FN / MI helpers (Philippine-style personal names).
 */

export function emptyNameParts() {
  return { lastName: '', firstName: '', middleInitial: '' }
}

/** Build display name: "First M. Last" */
export function formatFullName({ lastName = '', firstName = '', middleInitial = '' } = {}) {
  const ln = String(lastName || '').trim()
  const fn = String(firstName || '').trim()
  let mi = String(middleInitial || '').trim().replace(/\./g, '')
  if (mi) mi = `${mi.charAt(0).toUpperCase()}.`
  return [fn, mi, ln].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}

/** Best-effort split of an existing full name for edit forms. */
export function parseFullName(full = '') {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return emptyNameParts()
  if (parts.length === 1) return { lastName: parts[0], firstName: '', middleInitial: '' }
  if (parts.length === 2) return { firstName: parts[0], lastName: parts[1], middleInitial: '' }
  const lastName = parts[parts.length - 1]
  const firstName = parts[0]
  const mid = parts.slice(1, -1).join(' ')
  const middleInitial = mid.replace(/\./g, '').charAt(0) || ''
  return { lastName, firstName, middleInitial }
}
