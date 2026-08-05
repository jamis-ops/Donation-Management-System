import { useEffect, useState } from 'react'
import {
  Utensils, Droplets, Shirt, Pill, Sparkles, Home,
  Banknote, GraduationCap, Tag, Package, X,
} from 'lucide-react'
import { catalogItemsApi } from '../../api/resources'
import { NEEDS as FALLBACK_NEEDS } from '../../constants/options'
import { useSeeMore } from '../../hooks/useSeeMore'
import { SeeMoreToggle } from '../admin/shared/SeeMoreList'
import CatalogQuickAdd from '../admin/shared/CatalogQuickAdd'
import { CATALOG_CHANGED_EVENT } from '../../utils/catalogSync'
import { sortLabelsAz } from '../../utils/sortLabels'

const NEED_ICONS = {
  Food: Utensils,
  Water: Droplets,
  Clothing: Shirt,
  Medicine: Pill,
  'Hygiene Kits': Sparkles,
  Shelter: Home,
  'Financial Assistance': Banknote,
  'Educational Support': GraduationCap,
}

function iconForNeed(label) {
  if (NEED_ICONS[label]) return NEED_ICONS[label]
  const key = String(label || '').toLowerCase()
  if (key.includes('food') || key.includes('rice')) return Utensils
  if (key.includes('water')) return Droplets
  if (key.includes('cloth')) return Shirt
  if (key.includes('medicine') || key.includes('medical')) return Pill
  if (key.includes('hygiene')) return Sparkles
  if (key.includes('shelter') || key.includes('housing')) return Home
  if (key.includes('financial') || key.includes('cash')) return Banknote
  if (key.includes('educat') || key.includes('school')) return GraduationCap
  if (key.includes('relief') || key.includes('pack')) return Package
  return Tag
}

/**
 * Type of Needs selector — original chip-grid UI.
 * Options come from Settings → Type of Needs catalog.
 */
export default function NeedsPicker({
  value = [],
  onChange,
  note = '',
  onNoteChange,
  showNote = true,
  label = 'Type of Needs',
  initialVisible = 6,
  options: optionsProp = null,
  showQuickAdd = false,
  onCatalogUpdated,
  required = false,
  error = '',
}) {
  const selected = Array.isArray(value) ? value.filter(Boolean) : []
  const [options, setOptions] = useState(() => (
    sortLabelsAz(
      Array.isArray(optionsProp) && optionsProp.length > 0
        ? optionsProp.map((o) => (typeof o === 'string' ? o : o.label)).filter(Boolean)
        : FALLBACK_NEEDS,
    )
  ))

  useEffect(() => {
    if (Array.isArray(optionsProp)) {
      setOptions(sortLabelsAz(optionsProp.map((o) => (typeof o === 'string' ? o : o.label)).filter(Boolean)))
      return
    }
    let active = true
    catalogItemsApi.list('needs', false)
      .then((res) => {
        if (!active) return
        const list = (res?.data || []).map((n) => n.label).filter(Boolean)
        if (list.length > 0) setOptions(sortLabelsAz(list))
      })
      .catch(() => { /* keep fallback */ })
    return () => { active = false }
  }, [optionsProp])

  useEffect(() => {
    if (Array.isArray(optionsProp)) return undefined
    const onChanged = (event) => {
      if (event?.detail?.catalog !== 'needs') return
      const incoming = event.detail?.list
      if (Array.isArray(incoming) && incoming.length > 0) {
        const labels = incoming
          .filter((item) => item && item.isActive !== false)
          .map((item) => item.label)
          .filter(Boolean)
        if (labels.length > 0) {
          setOptions(sortLabelsAz(labels))
          return
        }
      }
      catalogItemsApi.list('needs', false)
        .then((res) => {
          const list = (res?.data || []).map((n) => n.label).filter(Boolean)
          if (list.length > 0) setOptions(sortLabelsAz(list))
        })
        .catch(() => { /* ignore */ })
    }
    window.addEventListener(CATALOG_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(CATALOG_CHANGED_EVENT, onChanged)
  }, [optionsProp])

  const seeMore = useSeeMore(options, initialVisible)

  const handleCatalogUpdated = (list) => {
    const labels = (Array.isArray(list) ? list : [])
      .filter((item) => item && item.isActive !== false)
      .map((item) => item.label)
      .filter(Boolean)
    if (labels.length > 0) setOptions(sortLabelsAz(labels))
    onCatalogUpdated?.(list)
  }

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

  return (
    <div className={`needs-picker${error || (required && selected.length === 0) ? ' needs-picker--invalid' : ''}`}>
      <div className="needs-picker__header">
        <span className="needs-picker__label-row">
          <span className="needs-picker__label">
            {label}
            {required ? <span className="req" aria-hidden> *</span> : null}
          </span>
          {showQuickAdd && (
            <CatalogQuickAdd catalog="needs" onUpdated={handleCatalogUpdated} />
          )}
        </span>
        <span className="needs-picker__count">
          {selected.length > 0 ? `${selected.length} selected` : 'None selected'}
        </span>
      </div>

      <div
        className="needs-picker__grid"
        role="group"
        aria-label="Select types of needs"
        aria-required={required || undefined}
      >
        {seeMore.visible.map((need) => {
          const Icon = iconForNeed(need)
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
      </div>

      {seeMore.needsToggle && (
        <SeeMoreToggle
          expanded={seeMore.expanded}
          onToggle={seeMore.toggle}
          hiddenCount={seeMore.hiddenCount}
          moreLabel="Show More"
          lessLabel="Show Less"
        />
      )}

      {selected.length > 0 && (
        <div className="needs-picker__selected">
          <span className="needs-picker__selected-label">Selected</span>
          <div className="needs-picker__chips" role="list" aria-label="Selected needs">
            {selected.map((need) => {
              const Icon = iconForNeed(need)
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

      {error ? (
        <p className="needs-picker__error" role="alert" style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '0.35rem' }}>
          {error}
        </p>
      ) : null}

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
