import { useState } from 'react'
import { Check, ChevronDown, Plus, Sparkles, X } from 'lucide-react'
import { useCatalogOptions } from '../../hooks/useCatalogOptions'

/**
 * Clean card/box layout with a dropdown selector and active chip tags.
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
  const [dropdownValue, setDropdownValue] = useState('')

  const handleDropdownSelect = (e) => {
    const val = e.target.value
    if (!val) return
    if (!selected.includes(val)) {
      onChange?.([...selected, val])
    }
    setDropdownValue('')
  }

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

  // Options that are not yet selected
  const unselectedOptions = availableOptions.filter((opt) => !selected.includes(opt))

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

      {/* Dropdown Selector */}
      <div className="multi-select-card__dropdown-wrapper">
        <div className="multi-select-card__select-container">
          <select
            className="multi-select-card__select"
            value={dropdownValue}
            onChange={handleDropdownSelect}
            disabled={loading}
          >
            <option value="">
              {loading ? 'Loading options…' : unselectedOptions.length === 0 ? 'All options selected' : placeholder}
            </option>
            {unselectedOptions.map((opt) => (
              <option key={opt} value={opt}>
                + Add {opt}
              </option>
            ))}
          </select>
          <span className="multi-select-card__select-chevron" aria-hidden="true">
            <ChevronDown size={16} />
          </span>
        </div>
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
          <span>No items selected yet. Choose from the dropdown or click the suggestions below.</span>
        </div>
      )}

      {/* Quick Suggestion Chips */}
      {availableOptions.length > 0 && (
        <div className="multi-select-card__suggestions">
          <span className="multi-select-card__suggestions-label">Available options:</span>
          <div className="multi-select-card__chip-grid">
            {availableOptions.map((opt) => {
              const isSelected = selected.includes(opt)
              return (
                <button
                  key={opt}
                  type="button"
                  className={`multi-select-chip ${isSelected ? 'multi-select-chip--active' : ''}`}
                  onClick={() => toggleOption(opt)}
                >
                  <span className="multi-select-chip__icon" aria-hidden="true">
                    {isSelected ? <Check size={12} /> : <Plus size={12} />}
                  </span>
                  <span>{opt}</span>
                </button>
              )
            })}
          </div>
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
