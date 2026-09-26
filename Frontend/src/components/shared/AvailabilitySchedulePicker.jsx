import { useMemo } from 'react'
import { Check, Calendar, Clock, CheckCheck, RotateCcw } from 'lucide-react'
import Req from './Req'
import {
  AVAILABILITY_TYPES,
  TIME_SLOTS,
  getRelevantDays,
  parseAvailability,
} from '../../utils/availability'

/**
 * Clean, interactive Days × Time Slots availability schedule picker and viewer.
 * Follows the Rise Above Foundation Cebu red/white theme.
 */
export default function AvailabilitySchedulePicker({
  value,
  onChange,
  label = 'Availability & Schedule',
  required = false,
  readOnly = false,
  hint = '',
}) {
  const parsed = useMemo(() => parseAvailability(value), [value])
  const selectedType = parsed.type || ''
  const slots = parsed.slots || {}

  const relevantDays = useMemo(() => getRelevantDays(selectedType), [selectedType])

  const handleTypeChange = (newType) => {
    if (readOnly) return
    // When changing type, preserve slots for days that remain relevant
    const newRelevantDays = getRelevantDays(newType)
    const newSlots = {}
    newRelevantDays.forEach((day) => {
      if (slots[day]) {
        newSlots[day] = slots[day]
      }
    })
    onChange?.({
      type: newType,
      slots: newSlots,
    })
  }

  const toggleSlot = (day, slotId) => {
    if (readOnly) return
    const daySlots = Array.isArray(slots[day]) ? [...slots[day]] : []
    const index = daySlots.indexOf(slotId)
    if (index >= 0) {
      daySlots.splice(index, 1)
    } else {
      daySlots.push(slotId)
    }

    const nextSlots = { ...slots }
    if (daySlots.length > 0) {
      nextSlots[day] = daySlots
    } else {
      delete nextSlots[day]
    }

    onChange?.({
      type: selectedType,
      slots: nextSlots,
    })
  }

  const toggleDayRow = (day) => {
    if (readOnly) return
    const currentDaySlots = Array.isArray(slots[day]) ? slots[day] : []
    const allSlotIds = TIME_SLOTS.map((s) => s.id)
    const isAllChecked = allSlotIds.every((id) => currentDaySlots.includes(id))

    const nextSlots = { ...slots }
    if (isAllChecked) {
      delete nextSlots[day]
    } else {
      nextSlots[day] = [...allSlotIds]
    }

    onChange?.({
      type: selectedType,
      slots: nextSlots,
    })
  }

  const selectAllSlots = () => {
    if (readOnly || !selectedType) return
    const allSlotIds = TIME_SLOTS.map((s) => s.id)
    const nextSlots = {}
    relevantDays.forEach((day) => {
      nextSlots[day] = [...allSlotIds]
    })
    onChange?.({
      type: selectedType,
      slots: nextSlots,
    })
  }

  const clearAllSlots = () => {
    if (readOnly) return
    onChange?.({
      type: selectedType,
      slots: {},
    })
  }

  const totalSelectedSlots = useMemo(() => {
    let count = 0
    relevantDays.forEach((day) => {
      if (Array.isArray(slots[day])) {
        count += slots[day].length
      }
    })
    return count
  }, [relevantDays, slots])

  return (
    <div className={`availability-schedule-picker ${readOnly ? 'availability-schedule-picker--readonly' : ''}`}>
      {label && (
        <div className="availability-schedule-picker__header">
          <label className="availability-schedule-picker__label">
            {required ? <Req required>{label}</Req> : label}
          </label>
          {hint && <span className="availability-schedule-picker__hint">{hint}</span>}
        </div>
      )}

      {/* Availability Dropdown */}
      <div className="availability-schedule-picker__type-select-wrap">
        {readOnly ? (
          <div className="availability-schedule-picker__readonly-badge">
            <span className="availability-type-pill">
              <Calendar size={13} aria-hidden />
              <span>{selectedType || 'Not specified'}</span>
            </span>
            {totalSelectedSlots > 0 && (
              <span className="availability-count-pill">
                {totalSelectedSlots} active time slot{totalSelectedSlots > 1 ? 's' : ''}
              </span>
            )}
          </div>
        ) : (
          <div className="availability-schedule-picker__select-row">
            <div className="availability-schedule-picker__select-field">
              <select
                className="availability-schedule-picker__select"
                value={selectedType}
                onChange={(e) => handleTypeChange(e.target.value)}
              >
                <option value="">Select general availability…</option>
                {AVAILABILITY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {selectedType && relevantDays.length > 0 && (
              <div className="availability-schedule-picker__quick-actions">
                <button
                  type="button"
                  className="availability-action-btn"
                  onClick={selectAllSlots}
                  title="Check all available slots for shown days"
                >
                  <CheckCheck size={13} /> Select All
                </button>
                {totalSelectedSlots > 0 && (
                  <button
                    type="button"
                    className="availability-action-btn availability-action-btn--clear"
                    onClick={clearAllSlots}
                    title="Clear selected slots"
                  >
                    <RotateCcw size={13} /> Clear
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Relevant Days Schedule Grid */}
      {selectedType && relevantDays.length > 0 ? (
        <div className="availability-grid-container">
          <div className="availability-grid-table-wrap">
            <table className="availability-grid-table">
              <thead>
                <tr>
                  <th className="availability-grid-th availability-grid-th--day">
                    <span>Day</span>
                  </th>
                  {TIME_SLOTS.map((slot) => (
                    <th key={slot.id} className="availability-grid-th availability-grid-th--slot">
                      <div className="availability-grid-th__content">
                        <strong>{slot.label}</strong>
                        <small>{slot.time}</small>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {relevantDays.map((day) => {
                  const daySlots = Array.isArray(slots[day]) ? slots[day] : []
                  const isDayFullyChecked =
                    TIME_SLOTS.length > 0 && TIME_SLOTS.every((s) => daySlots.includes(s.id))

                  return (
                    <tr
                      key={day}
                      className={`availability-grid-row ${daySlots.length > 0 ? 'availability-grid-row--active' : ''}`}
                    >
                      {/* Day Label Cell (click to toggle whole row in edit mode) */}
                      <td
                        className={`availability-grid-day-cell ${!readOnly ? 'availability-grid-day-cell--clickable' : ''}`}
                        onClick={() => !readOnly && toggleDayRow(day)}
                        title={!readOnly ? `Click to toggle all slots for ${day}` : ''}
                      >
                        <span className="availability-grid-day-text">{day}</span>
                        {daySlots.length > 0 && (
                          <span
                            className={`availability-grid-day-pill ${isDayFullyChecked ? 'availability-grid-day-pill--full' : ''}`}
                          >
                            {daySlots.length}/{TIME_SLOTS.length}
                          </span>
                        )}
                      </td>

                      {/* Time Slot Checkbox Cells */}
                      {TIME_SLOTS.map((slot) => {
                        const isChecked = daySlots.includes(slot.id)
                        return (
                          <td
                            key={slot.id}
                            className={`availability-grid-slot-cell ${isChecked ? 'availability-grid-slot-cell--checked' : ''} ${!readOnly ? 'availability-grid-slot-cell--clickable' : ''}`}
                            onClick={() => !readOnly && toggleSlot(day, slot.id)}
                            role={!readOnly ? 'checkbox' : undefined}
                            aria-checked={isChecked}
                            tabIndex={!readOnly ? 0 : undefined}
                            onKeyDown={(e) => {
                              if (!readOnly && (e.key === ' ' || e.key === 'Enter')) {
                                e.preventDefault()
                                toggleSlot(day, slot.id)
                              }
                            }}
                          >
                            <span
                              className={`availability-custom-check ${isChecked ? 'availability-custom-check--checked' : ''}`}
                            >
                              {isChecked && (
                                <Check size={12} strokeWidth={3} className="availability-check-icon" />
                              )}
                            </span>
                            <span className="availability-grid-slot-label-mobile">
                              {slot.label}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="availability-grid-footer">
            <span className="availability-grid-legend">
              <Clock size={12} aria-hidden />
              {readOnly ? 'Scheduled volunteer availability slots' : 'Click any day or time slot cell to toggle availability'}
            </span>
            <span className="availability-grid-summary">
              {totalSelectedSlots} slot{totalSelectedSlots === 1 ? '' : 's'} selected across {relevantDays.length} day{relevantDays.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      ) : !readOnly ? (
        <div className="availability-grid-empty-prompt">
          <Calendar size={18} className="availability-grid-empty-icon" />
          <span>Select an availability option above to view and customize your day and time schedule.</span>
        </div>
      ) : (
        <div className="availability-grid-empty-prompt">
          <span>No schedule slots recorded for this profile.</span>
        </div>
      )}
    </div>
  )
}
