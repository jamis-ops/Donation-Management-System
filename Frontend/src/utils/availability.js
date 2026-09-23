/**
 * Availability & Schedule utilities for Volunteers and Interns
 * Rise Above Foundation Cebu
 */

export const AVAILABILITY_TYPES = [
  'Weekdays',
  'Weekends',
  'Weekdays & Weekends',
  'Flexible / Any Day',
]

export const TIME_SLOTS = [
  { id: 'Morning', label: 'Morning', time: '9 AM – 12 PM' },
  { id: 'Afternoon', label: 'Afternoon', time: '12 PM – 4 PM' },
  { id: 'Evening', label: 'Evening', time: '4 PM – 8 PM' },
  { id: 'Night', label: 'Night', time: '8 PM – 12 AM' },
]

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
export const WEEKENDS = ['Saturday', 'Sunday']
export const ALL_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

/**
 * Returns strictly the relevant days to display for a given availability type.
 * Irrelevant days are completely hidden.
 */
export function getRelevantDays(type) {
  if (type === 'Weekdays') return [...WEEKDAYS]
  if (type === 'Weekends') return [...WEEKENDS]
  if (type === 'Weekdays & Weekends' || type === 'Flexible / Any Day') return [...ALL_DAYS]
  return []
}

/**
 * Safely parses availability from raw backend data (JSON string, object, or legacy string).
 */
export function parseAvailability(raw) {
  if (!raw) {
    return { type: '', slots: {} }
  }

  if (typeof raw === 'object') {
    return {
      type: raw.type || '',
      slots: typeof raw.slots === 'object' && raw.slots !== null ? raw.slots : {},
    }
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed)
        return {
          type: parsed.type || '',
          slots: typeof parsed.slots === 'object' && parsed.slots !== null ? parsed.slots : {},
        }
      } catch {
        // Fall back to plain string parsing
      }
    }

    // Match against known availability types or legacy values
    if (trimmed.toLowerCase().includes('weekend') && !trimmed.toLowerCase().includes('weekday')) {
      return { type: 'Weekends', slots: {} }
    }
    if (trimmed.toLowerCase().includes('weekday') && trimmed.toLowerCase().includes('weekend')) {
      return { type: 'Weekdays & Weekends', slots: {} }
    }
    if (trimmed.toLowerCase().includes('weekday') || trimmed.toLowerCase().includes('mon-fri') || trimmed.toLowerCase().includes('monday to friday')) {
      return { type: 'Weekdays', slots: {} }
    }
    if (trimmed.toLowerCase().includes('flexible') || trimmed.toLowerCase().includes('any day') || trimmed.toLowerCase().includes('on-call')) {
      return { type: 'Flexible / Any Day', slots: {} }
    }

    return { type: trimmed, slots: {} }
  }

  return { type: '', slots: {} }
}

/**
 * Serializes structured availability into a JSON string for database storage.
 */
export function serializeAvailability(data) {
  if (!data) return ''
  if (typeof data === 'string') return data.trim()
  
  const type = data.type || ''
  const slots = data.slots || {}
  
  // Clean up slots to only include active days for the type
  const relevantDays = getRelevantDays(type)
  const cleanedSlots = {}
  relevantDays.forEach((day) => {
    if (Array.isArray(slots[day]) && slots[day].length > 0) {
      cleanedSlots[day] = slots[day]
    }
  })

  return JSON.stringify({
    type,
    slots: cleanedSlots,
  })
}

/**
 * Returns a concise, user-friendly summary string for tables and badges.
 */
export function formatAvailabilitySummary(raw) {
  const { type, slots } = parseAvailability(raw)
  if (!type) return '—'

  const activeDays = Object.keys(slots).filter((d) => Array.isArray(slots[d]) && slots[d].length > 0)
  if (activeDays.length === 0) {
    return type
  }

  // Count total slots
  let totalSlots = 0
  activeDays.forEach((d) => {
    totalSlots += slots[d].length
  })

  // Format short day summary
  const dayAbbrs = activeDays.map((d) => d.slice(0, 3)).join(', ')
  return `${type} · ${dayAbbrs} (${totalSlots} slot${totalSlots > 1 ? 's' : ''})`
}
