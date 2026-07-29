import { useState } from 'react'
import {
  Utensils, Droplets, Shirt, Pill, Sparkles, Home,
  Banknote, GraduationCap, Plus, X, Tag,
} from 'lucide-react'
import { NEEDS } from '../../constants/options'

/* Icon map — keyed to the NEEDS constant values */
const NEED_ICONS = {
  'Food':                 Utensils,
  'Water':                Droplets,
  'Clothing':             Shirt,
  'Medicine':             Pill,
  'Hygiene Kits':         Sparkles,
  'Shelter':              Home,
  'Financial Assistance': Banknote,
  'Educational Support':  GraduationCap,
}

/**
 * NeedsPicker — inline grid of toggle chips with icon + label.
 * Custom needs can be added via the "+ Other" row.
 * Selected items appear as removable chips in a strip below.
 */
export default function NeedsPicker({
  value = [],
  onChange,
  note = '',
  onNoteChange,
  showNote = true,
  label = 'Type of Needs',
}) {
  const selected = Array.isArray(value) ? value.filter(Boolean) : []
  const [custom, setCustom] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  const toggle = (need) => {
    if (selected.includes(need)) {
      onChange?.(selected.filter((n) => n !== need))
    } else {
      onChange?.([...selected, need])
    }
  }

  const removeNeed = (need) => {
    onChange?.(selected.filter((n) => n !== need))
  }

  const handleAddCustom = (e) => {
    e.preventDefault()
    const next = custom.trim()
    if (!next) return
    if (selected.some((s) => s.toLowerCase() === next.toLowerCase())) {
      setCustom('')
      setShowCustom(false)
      return
    }
    onChange?.([...selected, next])
    setCustom('')
    setShowCustom(false)
  }

  /* Custom needs are ones selected that aren't in the predefined NEEDS list */
  const customSelected = selected.filter((n) => !NEEDS.includes(n))

  return (
    <div className="needs-picker">

      {/* Section header */}
      <div className="needs-picker__header">
        <span className="needs-picker__label">{label}</span>
        <span className="needs-picker__count">
          {selected.length > 0 ? `${selected.length} selected` : 'None selected'}
        </span>
      </div>

      {/* Predefined needs grid */}
      <div className="needs-picker__grid" role="group" aria-label="Select types of needs">
        {NEEDS.map((need) => {
          const Icon = NEED_ICONS[need] ?? Tag
          const isActive = selected.includes(need)
          return (
            <button
              key={need}
              type="button"
              role="checkbox"
              aria-checked={isActive}
              className={`needs-picker__option${isActive ? ' needs-picker__option--active' : ''}`}
              onClick={() => toggle(need)}
            >
              <span className="needs-picker__option-icon">
                <Icon size={16} strokeWidth={2} />
              </span>
              <span className="needs-picker__option-label">{need}</span>
              {isActive && (
                <span className="needs-picker__option-check" aria-hidden="true">✓</span>
              )}
            </button>
          )
        })}

        {/* Other / custom trigger */}
        <button
          type="button"
          className={`needs-picker__option needs-picker__option--other${showCustom ? ' needs-picker__option--other-open' : ''}`}
          onClick={() => setShowCustom((v) => !v)}
          aria-expanded={showCustom}
          aria-label="Add a custom type of need"
        >
          <span className="needs-picker__option-icon">
            <Plus size={16} strokeWidth={2.5} />
          </span>
          <span className="needs-picker__option-label">Other</span>
        </button>
      </div>

      {/* Custom need input — inline below the grid */}
      {showCustom && (
        <form className="needs-picker__custom" onSubmit={handleAddCustom}>
          <input
            type="text"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Describe the need…"
            aria-label="Custom type of need"
            autoFocus
            maxLength={80}
          />
          <button
            type="submit"
            className="btn btn--sm btn--primary"
            disabled={!custom.trim()}
          >
            Add
          </button>
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={() => { setShowCustom(false); setCustom('') }}
          >
            Cancel
          </button>
        </form>
      )}

      {/* Selected strip */}
      {selected.length > 0 && (
        <div className="needs-picker__selected">
          <span className="needs-picker__selected-label">Selected</span>
          <div className="needs-picker__chips" role="list" aria-label="Selected needs">
            {selected.map((need) => {
              const Icon = NEED_ICONS[need] ?? Tag
              return (
                <span key={need} className="needs-picker__chip" role="listitem">
                  <Icon size={11} strokeWidth={2.5} aria-hidden="true" />
                  {need}
                  <button
                    type="button"
                    className="needs-picker__chip-remove"
                    onClick={() => removeNeed(need)}
                    aria-label={`Remove ${need}`}
                  >
                    <X size={11} />
                  </button>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Notes field */}
      {showNote && typeof onNoteChange === 'function' && (
        <label className="needs-picker__note">
          Notes <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: 400 }}>(optional)</span>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Any additional context about these needs…"
          />
        </label>
      )}
    </div>
  )
}
