import { useId, useState, useMemo, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  COUNTRY_DIAL_CODES,
  digitsOnlyPhone,
  phoneError,
} from '../../utils/validation'

// Sort dial codes by length descending so multi-digit codes match before single-digit prefixes
const SORTED_COUNTRIES = [...COUNTRY_DIAL_CODES].sort(
  (a, b) => b.dialCode.length - a.dialCode.length
)

function detectCountry(value) {
  if (!value) return '+63'
  const str = String(value).trim()
  if (str.startsWith('+')) {
    const matched = SORTED_COUNTRIES.find((c) => str.startsWith(c.dialCode))
    return matched ? matched.dialCode : '+63'
  }
  return '+63'
}

function extractNationalDigits(value, dialCode) {
  if (!value) return ''
  const str = String(value).trim()
  if (str.startsWith('+')) {
    if (str.startsWith(dialCode)) {
      return str.slice(dialCode.length).replace(/\D/g, '')
    }
    const matched = SORTED_COUNTRIES.find((c) => str.startsWith(c.dialCode))
    if (matched) {
      return str.slice(matched.dialCode.length).replace(/\D/g, '')
    }
    return str.slice(1).replace(/\D/g, '')
  }
  const digits = str.replace(/\D/g, '')
  if (dialCode === '+63') {
    if (digits.startsWith('63') && digits.length >= 12) {
      return digits.slice(2)
    }
    if (digits.startsWith('0') && digits.length >= 11) {
      return digits.slice(1)
    }
  }
  return digits
}

/**
 * Phone input supporting both standard PH-only mode (11 digits, 09XXXXXXXXX)
 * and international mode with a country code dropdown (defaults to Philippines +63).
 */
export default function PhoneInput({
  value = '',
  onChange,
  required = false,
  disabled = false,
  allowInternational = false,
  name,
  id,
  placeholder,
  className = '',
  autoComplete = 'tel',
  /** Force showing the error (e.g. after submit attempt). */
  showError = false,
  /** Optional external error override. */
  error: errorProp,
  onBlur,
  ...rest
}) {
  const autoId = useId()
  const inputId = id || autoId
  const [touched, setTouched] = useState(false)

  // Track selected country dial code when international is enabled
  const [selectedCountry, setSelectedCountry] = useState(() => detectCountry(value))

  // Sync selected country if value changes externally to a different international dial code
  useEffect(() => {
    if (allowInternational && value && String(value).startsWith('+')) {
      const detected = detectCountry(value)
      if (detected !== selectedCountry) {
        setSelectedCountry(detected)
      }
    }
  }, [value, allowInternational])

  const currentCountryObj = useMemo(() => {
    return (
      COUNTRY_DIAL_CODES.find((c) => c.dialCode === selectedCountry) ||
      COUNTRY_DIAL_CODES.find((c) => c.code === 'PH') ||
      COUNTRY_DIAL_CODES[0]
    )
  }, [selectedCountry])

  // Compute error message
  const computedError = phoneError(value, {
    required,
    allowInternational,
  })
  const error = errorProp != null && errorProp !== '' ? errorProp : computedError
  const visibleError = (showError || touched) && error ? error : ''

  // Standard (Local-only) Mode Handlers
  const handleLocalChange = (e) => {
    const next = digitsOnlyPhone(e.target.value)
    onChange?.(next)
  }

  // International Mode Handlers
  const nationalDigits = useMemo(() => {
    if (!allowInternational) return digitsOnlyPhone(value)
    return extractNationalDigits(value, selectedCountry)
  }, [value, allowInternational, selectedCountry])

  const handleInternationalInput = (rawVal) => {
    let cleaned = String(rawVal || '').replace(/\D/g, '')

    if (selectedCountry === '+63') {
      // If user typed/pasted '09...', strip leading 0 so it stays as 10-digit national number (9XXXXXXXXX)
      if (cleaned.startsWith('0')) {
        cleaned = cleaned.slice(1)
      }
      cleaned = cleaned.slice(0, 10)
    } else {
      // General international digit limit
      cleaned = cleaned.slice(0, currentCountryObj.maxDigits || 15)
    }

    if (!cleaned) {
      onChange?.('')
      return
    }

    const fullNumber = `${selectedCountry}${cleaned}`
    onChange?.(fullNumber)
  }

  const handleCountryChange = (e) => {
    const nextDialCode = e.target.value
    setSelectedCountry(nextDialCode)
    if (nationalDigits) {
      let cleaned = nationalDigits
      if (nextDialCode === '+63' && cleaned.startsWith('0')) {
        cleaned = cleaned.slice(1)
      }
      onChange?.(`${nextDialCode}${cleaned}`)
    }
  }

  const handleBlur = (e) => {
    setTouched(true)
    onBlur?.(e)
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData?.getData('text') || ''
    if (!allowInternational) {
      const next = digitsOnlyPhone(pasted)
      onChange?.(next)
    } else {
      // Check if pasted value contains its own +country code
      if (pasted.trim().startsWith('+')) {
        const detected = detectCountry(pasted)
        setSelectedCountry(detected)
        const digits = extractNationalDigits(pasted, detected)
        onChange?.(`${detected}${digits}`)
      } else {
        handleInternationalInput(pasted)
      }
    }
    setTouched(true)
  }

  const handleKeyDown = (e) => {
    // Allow control/navigation keys
    if (
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      [
        'Backspace',
        'Delete',
        'Tab',
        'Escape',
        'Enter',
        'ArrowLeft',
        'ArrowRight',
        'Home',
        'End',
      ].includes(e.key)
    ) {
      return
    }
    if (!/^\d$/.test(e.key)) {
      e.preventDefault()
    }
  }

  // Determine dynamic placeholder
  const inputPlaceholder =
    placeholder ||
    (allowInternational
      ? currentCountryObj.placeholder || 'XXXXXXXXXX'
      : '09XXXXXXXXX')

  return (
    <div
      className={`phone-input${visibleError ? ' phone-input--invalid' : ''}${
        allowInternational ? ' phone-input--international' : ''
      }${className ? ` ${className}` : ''}`}
    >
      <div className="phone-input__field-group">
        {allowInternational && (
          <div className="phone-input__country-select-wrap">
            <select
              id={`${inputId}-country`}
              className="phone-input__country-select"
              value={selectedCountry}
              onChange={handleCountryChange}
              disabled={disabled}
              aria-label="Country calling code"
            >
              {COUNTRY_DIAL_CODES.map((c) => (
                <option key={`${c.code}-${c.dialCode}`} value={c.dialCode}>
                  {c.flag} {c.name} ({c.dialCode})
                </option>
              ))}
            </select>
            <div className="phone-input__country-display" aria-hidden="true">
              <span className="phone-input__country-flag">
                {currentCountryObj.flag}
              </span>
              <span className="phone-input__country-dial">
                {currentCountryObj.dialCode}
              </span>
              <ChevronDown size={14} className="phone-input__chevron" />
            </div>
          </div>
        )}

        <input
          {...rest}
          id={inputId}
          name={name}
          type="tel"
          inputMode="numeric"
          pattern={
            allowInternational
              ? selectedCountry === '+63'
                ? '9[0-9]{9}'
                : '[0-9]{6,15}'
              : '09[0-9]{9}'
          }
          maxLength={
            allowInternational
              ? selectedCountry === '+63'
                ? 10
                : currentCountryObj.maxDigits || 15
              : 11
          }
          autoComplete={autoComplete}
          placeholder={inputPlaceholder}
          value={allowInternational ? nationalDigits : digitsOnlyPhone(value)}
          required={required}
          disabled={disabled}
          aria-invalid={visibleError ? true : undefined}
          aria-describedby={visibleError ? `${inputId}-error` : undefined}
          onChange={
            allowInternational
              ? (e) => handleInternationalInput(e.target.value)
              : handleLocalChange
          }
          onBlur={handleBlur}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
        />
      </div>

      {visibleError ? (
        <span id={`${inputId}-error`} className="phone-input__error" role="alert">
          {visibleError}
        </span>
      ) : null}
    </div>
  )
}
