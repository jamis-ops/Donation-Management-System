/** Shared client-side validation helpers (PH mobile + email + international phone). */

export const COUNTRY_DIAL_CODES = [
  { code: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺', placeholder: '412 345 678', maxDigits: 10 },
  { code: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦', placeholder: '(555) 000-0000', maxDigits: 10 },
  { code: 'CN', name: 'China', dialCode: '+86', flag: '🇨🇳', placeholder: '131 2345 6789', maxDigits: 12 },
  { code: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷', placeholder: '6 12 34 56 78', maxDigits: 10 },
  { code: 'DE', name: 'Germany', dialCode: '+49', flag: '🇩🇪', placeholder: '151 23456789', maxDigits: 12 },
  { code: 'HK', name: 'Hong Kong', dialCode: '+852', flag: '🇭🇰', placeholder: '9123 4567', maxDigits: 9 },
  { code: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳', placeholder: '98765 43210', maxDigits: 11 },
  { code: 'ID', name: 'Indonesia', dialCode: '+62', flag: '🇮🇩', placeholder: '812 3456 7890', maxDigits: 12 },
  { code: 'IT', name: 'Italy', dialCode: '+39', flag: '🇮🇹', placeholder: '312 345 6789', maxDigits: 11 },
  { code: 'JP', name: 'Japan', dialCode: '+81', flag: '🇯🇵', placeholder: '90 1234 5678', maxDigits: 11 },
  { code: 'KW', name: 'Kuwait', dialCode: '+965', flag: '🇰🇼', placeholder: '9123 4567', maxDigits: 9 },
  { code: 'MY', name: 'Malaysia', dialCode: '+60', flag: '🇲🇾', placeholder: '12 345 6789', maxDigits: 11 },
  { code: 'NL', name: 'Netherlands', dialCode: '+31', flag: '🇳🇱', placeholder: '6 12345678', maxDigits: 10 },
  { code: 'NZ', name: 'New Zealand', dialCode: '+64', flag: '🇳🇿', placeholder: '21 123 4567', maxDigits: 11 },
  { code: 'PH', name: 'Philippines', dialCode: '+63', flag: '🇵🇭', placeholder: '9XX XXX XXXX', maxDigits: 10 },
  { code: 'QA', name: 'Qatar', dialCode: '+974', flag: '🇶🇦', placeholder: '3312 3456', maxDigits: 9 },
  { code: 'SA', name: 'Saudi Arabia', dialCode: '+966', flag: '🇸🇦', placeholder: '50 123 4567', maxDigits: 10 },
  { code: 'SG', name: 'Singapore', dialCode: '+65', flag: '🇸🇬', placeholder: '8123 4567', maxDigits: 9 },
  { code: 'KR', name: 'South Korea', dialCode: '+82', flag: '🇰🇷', placeholder: '10 1234 5678', maxDigits: 11 },
  { code: 'ES', name: 'Spain', dialCode: '+34', flag: '🇪🇸', placeholder: '612 34 56 78', maxDigits: 10 },
  { code: 'TW', name: 'Taiwan', dialCode: '+886', flag: '🇹🇼', placeholder: '912 345 678', maxDigits: 10 },
  { code: 'TH', name: 'Thailand', dialCode: '+66', flag: '🇹🇭', placeholder: '81 234 5678', maxDigits: 10 },
  { code: 'AE', name: 'United Arab Emirates', dialCode: '+971', flag: '🇦🇪', placeholder: '50 123 4567', maxDigits: 10 },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧', placeholder: '7123 456789', maxDigits: 11 },
  { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸', placeholder: '(555) 000-0000', maxDigits: 10 },
  { code: 'VN', name: 'Vietnam', dialCode: '+84', flag: '🇻🇳', placeholder: '91 234 5678', maxDigits: 11 },
]

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

/**
 * Validate international or local phone numbers.
 */
export function isValidPhone(value, { allowInternational = false } = {}) {
  if (value == null || String(value).trim() === '') return false
  const raw = String(value).trim()
  if (!allowInternational) {
    return isValidPhMobile(raw)
  }
  if (raw.startsWith('+63') || raw.startsWith('09') || (raw.startsWith('63') && raw.length >= 12)) {
    return isValidPhMobile(raw)
  }
  if (raw.startsWith('+')) {
    const digits = raw.replace(/\D/g, '')
    return digits.length >= 7 && digits.length <= 15
  }
  const digits = raw.replace(/\D/g, '')
  return (digits.length === 10 && digits.startsWith('9')) || (digits.length === 11 && digits.startsWith('09'))
}

export const PHONE_HINT = 'Enter exactly 11 digits (09XXXXXXXXX). Letters and symbols are not allowed.'

export function phoneError(value, { required = false, allowInternational = false } = {}) {
  const raw = String(value || '').trim()
  if (!raw) {
    if (!required) return ''
    return allowInternational ? 'Phone number is required.' : 'Phone number is required (11 digits).'
  }

  if (!allowInternational) {
    const digits = digitsOnlyPhone(raw)
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

  // International mode validation
  if (raw.startsWith('+')) {
    if (raw.startsWith('+63')) {
      const phDigits = raw.slice(3).replace(/\D/g, '')
      if (!phDigits) return required ? 'Phone number is required.' : ''
      if (phDigits.length < 10) {
        return `Philippine number must be 10 digits after +63 (currently ${phDigits.length}).`
      }
      if (!phDigits.startsWith('9')) {
        return 'Philippine mobile numbers must start with 9 after +63.'
      }
      return ''
    }
    const allDigits = raw.slice(1).replace(/\D/g, '')
    if (!allDigits) return required ? 'Phone number is required.' : ''
    if (allDigits.length < 7) {
      return 'Phone number is too short (min 7 digits).'
    }
    if (allDigits.length > 15) {
      return 'Phone number is too long (max 15 digits).'
    }
    return ''
  }

  // When entered without a '+' prefix in international mode
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('63') && digits.length >= 12) {
    const phDigits = digits.slice(2)
    if (phDigits.length === 10 && phDigits.startsWith('9')) return ''
  }
  if (digits.length === 10 && digits.startsWith('9')) return ''
  if (digits.length === 11 && digits.startsWith('09')) return ''
  if (digits.length >= 7 && digits.length <= 15) return ''

  return 'Enter a valid phone number.'
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

