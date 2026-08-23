/** Shared client-side validation helpers (PH mobile + email). */

/**
 * Sanitize phone typing/paste to digits only, max 11.
 * Converts +63 / 63… and bare 9… forms when recognizable.
 */
export function digitsOnlyPhone(value, maxLength = 11) {
  let digits = String(value || '').replace(/\D/g, '')
  if (digits.startsWith('63') && digits.length >= 12) {
    digits = `0${digits.slice(2)}`
  } else if (digits.length === 10 && digits.startsWith('9')) {
    digits = `0${digits}`
  }
  return digits.slice(0, maxLength)
}

/**
 * Normalize common PH mobile formats to 11 digits (09XXXXXXXXX).
 * Does not invent digits — only reformats when length matches known patterns.
 */
export function normalizePhPhone(value) {
  return digitsOnlyPhone(value, 11)
}

/** True when value is a valid PH mobile: exactly 11 digits starting with 09. */
export function isValidPhMobile(value) {
  if (value == null || String(value).trim() === '') return false
  const digits = digitsOnlyPhone(value)
  return /^09\d{9}$/.test(digits)
}

export const PHONE_HINT = 'Enter exactly 11 digits (09XXXXXXXXX). Letters and symbols are not allowed.'

export function phoneError(value, { required = false } = {}) {
  const digits = digitsOnlyPhone(value)
  if (!digits) return required ? 'Phone number is required (11 digits).' : ''
  if (digits.length !== 11) {
    return `Phone number must be exactly 11 digits (currently ${digits.length}).`
  }
  if (!digits.startsWith('09')) {
    return 'Phone number must start with 09 (PH mobile).'
  }
  if (!isValidPhMobile(digits)) {
    return PHONE_HINT
  }
  return ''
}

export function isValidEmail(value) {
  const email = String(value || '').trim()
  if (!email) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function emailError(value, { required = true } = {}) {
  const raw = String(value || '').trim()
  if (!raw) return required ? 'Email is required.' : ''
  if (!isValidEmail(raw)) return 'Enter a valid email address.'
  return ''
}

export const MAX_UPLOAD_BYTES = {
  profile: 3 * 1024 * 1024,
  proof: 5 * 1024 * 1024,
  donation: 5 * 1024 * 1024,
}

export function fileSizeError(file, maxBytes, label = 'File') {
  if (!file) return ''
  if (file.size > maxBytes) {
    const mb = (maxBytes / (1024 * 1024)).toFixed(0)
    return `${label} must be ${mb}MB or smaller.`
  }
  return ''
}

/**
 * Password Policy Requirements:
 * 1. At least 8 characters
 * 2. At least one uppercase letter (A-Z)
 * 3. At least one lowercase letter (a-z)
 * 4. At least one number (0-9)
 * 5. At least one special character (!@#$%^&*...)
 */
export const PASSWORD_REQUIREMENTS = [
  { id: 'min_length', label: 'At least 8 characters', test: (p) => (p || '').length >= 8 },
  { id: 'uppercase', label: 'At least one uppercase letter (A-Z)', test: (p) => /[A-Z]/.test(p || '') },
  { id: 'lowercase', label: 'At least one lowercase letter (a-z)', test: (p) => /[a-z]/.test(p || '') },
  { id: 'number', label: 'At least one number (0-9)', test: (p) => /[0-9]/.test(p || '') },
  { id: 'special', label: 'At least one special character (!@#$%^&*...)', test: (p) => /[^A-Za-z0-9]/.test(p || '') },
]

export function checkPasswordRequirements(password) {
  const p = String(password || '')
  const results = PASSWORD_REQUIREMENTS.map((rule) => ({
    ...rule,
    met: rule.test(p),
  }))
  const metCount = results.filter((r) => r.met).length
  const isValid = metCount === PASSWORD_REQUIREMENTS.length
  return {
    results,
    metCount,
    totalCount: PASSWORD_REQUIREMENTS.length,
    isValid,
  }
}

export function passwordError(password, { required = true, fieldLabel = 'Password' } = {}) {
  const p = String(password || '')
  if (!p) return required ? `${fieldLabel} is required.` : ''
  if (p.length < 8) return `${fieldLabel} must be at least 8 characters long.`
  if (!/[A-Z]/.test(p)) return `${fieldLabel} must contain at least one uppercase letter (A-Z).`
  if (!/[a-z]/.test(p)) return `${fieldLabel} must contain at least one lowercase letter (a-z).`
  if (!/[0-9]/.test(p)) return `${fieldLabel} must contain at least one number (0-9).`
  if (!/[^A-Za-z0-9]/.test(p)) return `${fieldLabel} must contain at least one special character.`
  return ''
}

