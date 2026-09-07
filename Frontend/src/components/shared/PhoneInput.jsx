import { useId, useState } from 'react'
import { digitsOnlyPhone, phoneError } from '../../utils/validation'

/**
 * Phone input that only accepts numeric digits, capped at 11.
 * Shows a clear validation message when invalid.
 */
export default function PhoneInput({
  value = '',
  onChange,
  required = false,
  disabled = false,
  name,
  id,
  placeholder = '09XXXXXXXXX',
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
  const digits = digitsOnlyPhone(value)
  const computedError = phoneError(digits, { required })
  const error = errorProp != null && errorProp !== '' ? errorProp : computedError
  const visibleError = (showError || touched) && error ? error : ''

  const handleChange = (e) => {
    const next = digitsOnlyPhone(e.target.value)
    onChange?.(next)
  }

  const handleBlur = (e) => {
    setTouched(true)
    onBlur?.(e)
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = digitsOnlyPhone(e.clipboardData?.getData('text') || '')
    onChange?.(pasted)
    setTouched(true)
  }

  const handleKeyDown = (e) => {
    // Allow control/navigation keys
    if (
      e.ctrlKey || e.metaKey || e.altKey
      || ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)
    ) {
      return
    }
    if (!/^\d$/.test(e.key)) {
      e.preventDefault()
    }
  }

  return (
    <div className={`phone-input${visibleError ? ' phone-input--invalid' : ''}${className ? ` ${className}` : ''}`}>
      <input
        {...rest}
        id={inputId}
        name={name}
        type="tel"
        inputMode="numeric"
        pattern="09[0-9]{9}"
        maxLength={11}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={digits}
        required={required}
        disabled={disabled}
        aria-invalid={visibleError ? true : undefined}
        aria-describedby={visibleError ? `${inputId}-error` : undefined}
        onChange={handleChange}
        onBlur={handleBlur}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
      />
      {visibleError ? (
        <span id={`${inputId}-error`} className="phone-input__error" role="alert">
          {visibleError}
        </span>
      ) : null}
    </div>
  )
}
