import { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown, Sparkles, X } from 'lucide-react'
import { useCatalogOptions } from '../../hooks/useCatalogOptions'

/**
 * Clean card/box layout with a dropdown selector containing checkboxes and active chip tags.
 * Supports multi-select via dropdown checkboxes.
 * Automatically synchronizes with Admin CMS Catalogs.
 */
export default function MultiSelectBox({
  catalog,
  fallback = [],
  value = [],
  onChange,
  label = 'Select Options',
  placeholder = 'Select from dropdown to add…',
  other = '',
  onOtherChange,
  showOther = false,
  otherPlaceholder = 'Other (please specify)…',
  otherLabel = 'Other',
  icon: Icon = Sparkles,
  required = false,
  hint = '',
}) {
  const { options: availableOptions, loading } = useCatalogOptions(catalog, fallback)
  const selected = Array.isArray(value) ? value : []
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

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

  const clearAll = () => {
    onChange?.([])
  }

  return (
    <div className="multi-select-card">
      <div className="multi-select-card__header">
        <div className="multi-select-card__title-group">
          <span className="multi-select-card__icon" aria-hidden="true">
            <Icon size={16} />
          </span>
          <label className="multi-select-card__label">
            {label}
            {required && <span className="req" aria-hidden="true"> *</span>}
          </label>
        </div>
        <div className="multi-select-card__badge-group">
          <span className="multi-select-card__count">
            {selected.length} {selected.length === 1 ? 'selected' : 'selected'}
          </span>
          {selected.length > 0 && (
            <button
              type="button"
              className="multi-select-card__clear-btn"
              onClick={clearAll}
              title="Clear all selections"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {hint && <p className="multi-select-card__hint">{hint}</p>}

      {/* Dropdown with Checkboxes */}
      <div className="multi-select-card__dropdown-wrapper" ref={dropdownRef}>
        <button
          type="button"
          className={`multi-select-card__trigger ${isOpen ? 'multi-select-card__trigger--open' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          disabled={loading}
        >
          <span className="multi-select-card__trigger-text">
            {loading
              ? 'Loading options…'
              : selected.length === 0
                ? placeholder
                : `${selected.length} selected (${selected.slice(0, 2).join(', ')}${selected.length > 2 ? `, +${selected.length - 2} more` : ''})`}
          </span>
          <ChevronDown
            size={16}
            className={`multi-select-card__chevron ${isOpen ? 'multi-select-card__chevron--rotated' : ''}`}
          />
        </button>

        {isOpen && (
          <div className="multi-select-card__menu" role="listbox">
            <div className="multi-select-card__menu-header">
              <span>{selected.length} of {availableOptions.length} selected</span>
              <div className="multi-select-card__menu-actions">
                {selected.length < availableOptions.length && (
                  <button
                    type="button"
                    className="multi-select-card__menu-action-btn"
                    onClick={() => onChange?.([...availableOptions])}
                  >
                    Select All
                  </button>
                )}
                {selected.length > 0 && (
                  <button
                    type="button"
                    className="multi-select-card__menu-action-btn"
                    onClick={() => onChange?.([])}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <div className="multi-select-card__menu-list">
              {availableOptions.map((opt) => {
                const isChecked = selected.includes(opt)
                return (
                  <label
                    key={opt}
                    className={`multi-select-card__menu-item ${isChecked ? 'multi-select-card__menu-item--checked' : ''}`}
                  >
                    <input
                      type="checkbox"
                      className="multi-select-card__checkbox"
                      checked={isChecked}
                      onChange={() => toggleOption(opt)}
                    />
                    <span className="multi-select-card__item-label">{opt}</span>
                  </label>
                )
              })}
              {availableOptions.length === 0 && !loading && (
                <div style={{ padding: '0.65rem 0.85rem', color: '#64748b', fontSize: '0.85rem' }}>
                  No options available.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Active Selected Tags Display */}
      {selected.length > 0 ? (
        <div className="multi-select-card__selected-tags">
          {selected.map((item) => (
            <span key={item} className="multi-select-tag">
              <span className="multi-select-tag__check" aria-hidden="true">
                <Check size={12} />
              </span>
              <span className="multi-select-tag__text">{item}</span>
              <button
                type="button"
                className="multi-select-tag__remove"
                onClick={() => removeOption(item)}
                title={`Remove ${item}`}
                aria-label={`Remove ${item}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <div className="multi-select-card__empty">
          <span>No items selected yet. Choose from the dropdown to add.</span>
        </div>
      )}

      {/* Optional "Other" Custom Write-in Field */}
      {showOther && (
        <div className="multi-select-card__other-wrapper">
          <label className="multi-select-card__other-label">
            {otherLabel}
            <input
              type="text"
              className="multi-select-card__other-input"
              value={other}
              placeholder={otherPlaceholder}
              onChange={(e) => onOtherChange?.(e.target.value)}
            />
          </label>
        </div>
      )}
    </div>
  )
}
