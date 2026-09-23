import { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown, X, Plus } from 'lucide-react'
import Req from './Req'

/**
 * Clean multi-select dropdown with checkboxes, chips display, and "Other" write-in support.
 * Styled with Rise Above Foundation Cebu red/white theme.
 */
export default function CheckboxMultiSelect({
  label,
  required = false,
  options = [],
  value = [],
  onChange,
  showOther = true,
  hasOther = false,
  onToggleOther,
  otherValue = '',
  onOtherChange,
  placeholder = 'Select from dropdown to add…',
  otherPlaceholder = 'Specify other (please enter name)…',
  hint = '',
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)
  const selected = Array.isArray(value) ? value : []

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isOpen])

  const toggleOption = (opt) => {
    if (selected.includes(opt)) {
      onChange?.(selected.filter((item) => item !== opt))
    } else {
      onChange?.([...selected, opt])
    }
  }

  const removeOption = (opt) => {
    onChange?.(selected.filter((item) => item !== opt))
  }

  const selectAll = () => {
    onChange?.([...options])
  }

  const clearAll = () => {
    onChange?.([])
  }

  // Summary label on the closed trigger
  const triggerLabel = () => {
    const totalCount = selected.length + (hasOther && otherValue.trim() ? 1 : 0)
    if (totalCount === 0) return placeholder
    if (selected.length === 1 && !hasOther) return selected[0]
    if (selected.length === 0 && hasOther && otherValue.trim()) return `Other: ${otherValue.trim()}`
    return `${totalCount} selected (${selected.slice(0, 2).join(', ')}${selected.length > 2 ? `, +${selected.length - 2} more` : ''})`
  }

  return (
    <div className="checkbox-multiselect-field" ref={dropdownRef}>
      {label && (
        <label className="checkbox-multiselect-field__label">
          {required ? <Req required>{label}</Req> : label}
          {hint && <span className="checkbox-multiselect-field__hint"> — {hint}</span>}
        </label>
      )}

      {/* Trigger Button */}
      <div className="checkbox-multiselect__wrapper">
        <button
          type="button"
          className={`checkbox-multiselect__trigger ${isOpen ? 'checkbox-multiselect__trigger--open' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className={`checkbox-multiselect__trigger-text ${selected.length === 0 && (!hasOther || !otherValue.trim()) ? 'checkbox-multiselect__trigger-text--empty' : ''}`}>
            {triggerLabel()}
          </span>
          <ChevronDown
            size={16}
            className={`checkbox-multiselect__chevron ${isOpen ? 'checkbox-multiselect__chevron--rotated' : ''}`}
          />
        </button>

        {/* Dropdown Menu Popup */}
        {isOpen && (
          <div className="checkbox-multiselect__menu" role="listbox">
            <div className="checkbox-multiselect__menu-header">
              <span>{selected.length} of {options.length} selected</span>
              <div className="checkbox-multiselect__menu-actions">
                {selected.length < options.length && (
                  <button
                    type="button"
                    className="checkbox-multiselect__action-btn"
                    onClick={selectAll}
                  >
                    Select All
                  </button>
                )}
                {selected.length > 0 && (
                  <button
                    type="button"
                    className="checkbox-multiselect__action-btn"
                    onClick={clearAll}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="checkbox-multiselect__list">
              {options.map((opt) => {
                const isChecked = selected.includes(opt)
                return (
                  <label
                    key={opt}
                    className={`checkbox-multiselect__item ${isChecked ? 'checkbox-multiselect__item--checked' : ''}`}
                  >
                    <input
                      type="checkbox"
                      className="checkbox-multiselect__checkbox"
                      checked={isChecked}
                      onChange={() => toggleOption(opt)}
                    />
                    <span className="checkbox-multiselect__item-label">{opt}</span>
                    {isChecked && <Check size={14} className="checkbox-multiselect__item-check" />}
                  </label>
                )
              })}

              {options.length === 0 && (
                <div style={{ padding: '0.65rem 0.85rem', color: '#64748b', fontSize: '0.84rem' }}>
                  No options in catalog.
                </div>
              )}

              {/* Other Option Checkbox */}
              {showOther && (
                <>
                  <div className="checkbox-multiselect__divider" />
                  <label className={`checkbox-multiselect__item checkbox-multiselect__item--other ${hasOther ? 'checkbox-multiselect__item--checked' : ''}`}>
                    <input
                      type="checkbox"
                      className="checkbox-multiselect__checkbox"
                      checked={hasOther}
                      onChange={(e) => onToggleOther?.(e.target.checked)}
                    />
                    <span className="checkbox-multiselect__item-label">
                      <strong>Other</strong> (enter custom)
                    </span>
                    {hasOther && <Check size={14} className="checkbox-multiselect__item-check" />}
                  </label>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Write-in field for "Other" when checked */}
      {showOther && hasOther && (
        <div className="checkbox-multiselect__other-box">
          <div className="checkbox-multiselect__other-input-wrap">
            <input
              type="text"
              className="checkbox-multiselect__other-input"
              value={otherValue}
              placeholder={otherPlaceholder}
              onChange={(e) => onOtherChange?.(e.target.value)}
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Selected Chips Display */}
      {(selected.length > 0 || (hasOther && otherValue.trim())) && (
        <div className="checkbox-multiselect__chips">
          {selected.map((item) => (
            <span key={item} className="checkbox-multiselect__chip">
              <span className="checkbox-multiselect__chip-text">{item}</span>
              <button
                type="button"
                className="checkbox-multiselect__chip-remove"
                onClick={() => removeOption(item)}
                title={`Remove ${item}`}
                aria-label={`Remove ${item}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}

          {hasOther && otherValue.trim() && (
            <span className="checkbox-multiselect__chip checkbox-multiselect__chip--other">
              <span className="checkbox-multiselect__chip-text">Other: {otherValue.trim()}</span>
              <button
                type="button"
                className="checkbox-multiselect__chip-remove"
                onClick={() => {
                  onToggleOther?.(false)
                  onOtherChange?.('')
                }}
                title="Remove custom option"
                aria-label="Remove custom option"
              >
                <X size={12} />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
