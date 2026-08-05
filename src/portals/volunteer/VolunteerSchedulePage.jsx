import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, MapPin, Clock, Users } from 'lucide-react'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import Pagination from '../../components/admin/shared/Pagination'
import { getPortalData } from '../../api/resources'
import { useApiObject } from '../../hooks/useApiList'
import { usePagination, DEFAULT_PAGE_SIZE } from '../../hooks/usePagination'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const EVENT_TYPE_COLORS = {
  Distribution: 'crimson',
  Inventory: 'blue',
  Programs: 'green',
  Training: 'purple',
  Community: 'orange',
}

function dateKey(value) {
  if (!value || value === '—') return ''
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseLocalDate(value) {
  const key = dateKey(value)
  if (!key) return null
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export default function VolunteerSchedulePage() {
  const { data, loading, error, reload } = useApiObject(() => getPortalData())
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [viewMode, setViewMode] = useState('month')
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [didJump, setDidJump] = useState(false)
  const todayKey = dateKey(new Date())
  const schedule = data?.schedule || []
  const sortedEvents = useMemo(
    () => [...schedule].sort((a, b) => dateKey(a.date).localeCompare(dateKey(b.date))),
    [schedule],
  )
  const listPaging = usePagination(sortedEvents, DEFAULT_PAGE_SIZE, `${viewMode}|${sortedEvents.length}`)

  useEffect(() => {
    if (didJump || !schedule.length) return
    const hasThisMonth = schedule.some((e) => {
      const d = parseLocalDate(e.date)
      return d && d.getFullYear() === currentDate.getFullYear() && d.getMonth() === currentDate.getMonth()
    })
    if (hasThisMonth) {
      setDidJump(true)
      return
    }
    const first = [...schedule]
      .map((e) => parseLocalDate(e.date))
      .filter(Boolean)
      .sort((a, b) => a - b)[0]
    if (first) {
      setCurrentDate(new Date(first.getFullYear(), first.getMonth(), 1))
      setDidJump(true)
    }
  }, [schedule, currentDate, didJump])

  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    return { firstDay, daysInMonth }
  }

  const getEventsForDate = (date) => {
    const key = dateKey(date)
    return schedule.filter((event) => dateKey(event.date) === key)
  }

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const renderMonthView = () => {
    const { firstDay, daysInMonth } = getDaysInMonth(currentDate)
    const days = []

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="portal-calendar-day portal-calendar-day--empty" />)
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
      const events = getEventsForDate(date)
      const isToday = dateKey(date) === todayKey
      const typeColor = (type) => EVENT_TYPE_COLORS[type] || 'crimson'

      days.push(
        <div
          key={day}
          className={`portal-calendar-day ${isToday ? 'portal-calendar-day--today' : ''} ${events.length > 0 ? 'portal-calendar-day--has-events' : ''}`}
        >
          <div className="portal-calendar-day__number">{day}</div>
          <div className="portal-calendar-day__events">
            {events.slice(0, 2).map((event) => (
              <button
                key={event.id || `${event.event}-${event.date}`}
                type="button"
                className={`portal-calendar-event portal-calendar-event--${typeColor(event.type)}`}
                onClick={() => setSelectedEvent(event)}
              >
                <span className="portal-calendar-event__time">{(event.time || 'TBD').split(' - ')[0]}</span>
                <span className="portal-calendar-event__title">{event.event}</span>
              </button>
            ))}
            {events.length > 2 && (
              <div className="portal-calendar-event__more">+{events.length - 2} more</div>
            )}
          </div>
        </div>
      )
    }

    return days
  }

  const renderListView = () => {
    if (!sortedEvents.length) {
      return (
        <div className="portal-empty">
          <CalendarIcon size={36} />
          <p>No scheduled events yet.</p>
        </div>
      )
    }

    return (
      <>
        <div className="portal-event-list">
          {listPaging.pageItems.map((event) => {
            const d = parseLocalDate(event.date)
            const typeColor = EVENT_TYPE_COLORS[event.type] || 'crimson'
            return (
              <div key={event.id || `${event.event}-${event.date}`} className="portal-event-list-item">
                <div className="portal-event-list-item__date">
                  <span className="portal-event-list-item__day">{d ? d.getDate() : '—'}</span>
                  <span className="portal-event-list-item__month">
                    {d ? d.toLocaleDateString('en-US', { month: 'short' }) : '—'}
                  </span>
                  <span className="portal-event-list-item__weekday">
                    {d ? d.toLocaleDateString('en-US', { weekday: 'short' }) : ''}
                  </span>
                </div>
                <div className="portal-event-list-item__content">
                  <div className="portal-event-list-item__header">
                    <h3>{event.event}</h3>
                    {event.type && (
                      <span className={`portal-event-type-badge portal-event-type-badge--${typeColor}`}>
                        {event.type}
                      </span>
                    )}
                  </div>
                  <div className="portal-event-list-item__details">
                    <span><Clock size={14} /> {event.time || 'TBD'}</span>
                    {event.location && <span><MapPin size={14} /> {event.location}</span>}
                    {typeof event.attendees === 'number' && event.attendees > 0 && (
                      <span><Users size={14} /> {event.attendees} attending</span>
                    )}
                  </div>
                  {event.description && (
                    <p className="portal-event-list-item__description">{event.description}</p>
                  )}
                </div>
                <div className="portal-event-list-item__actions">
                  <StatusBadge status={event.status || 'Scheduled'} />
                  <button
                    type="button"
                    className="btn btn--sm btn--outline"
                    onClick={() => setSelectedEvent(event)}
                  >
                    View Details
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        <Pagination
          page={listPaging.page}
          totalPages={listPaging.totalPages}
          total={listPaging.total}
          startIndex={listPaging.startIndex}
          endIndex={listPaging.endIndex}
          onPageChange={listPaging.setPage}
          className="pagination--portal"
          noun="events"
        />
      </>
    )
  }

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      <section className="portal-panel">
        <div className="portal-panel__header">
          <h2>Volunteer Schedule</h2>
          <div className="portal-view-toggle">
            <button
              type="button"
              className={`portal-view-toggle__btn ${viewMode === 'month' ? 'active' : ''}`}
              onClick={() => setViewMode('month')}
            >
              <CalendarIcon size={16} /> Month
            </button>
            <button
              type="button"
              className={`portal-view-toggle__btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              List
            </button>
          </div>
        </div>

        {viewMode === 'month' && (
          <>
            <div className="portal-calendar-header">
              <button type="button" onClick={handlePrevMonth} className="portal-calendar-nav" aria-label="Previous month">
                <ChevronLeft size={20} />
              </button>
              <h3 className="portal-calendar-title">
                {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h3>
              <button type="button" onClick={handleNextMonth} className="portal-calendar-nav" aria-label="Next month">
                <ChevronRight size={20} />
              </button>
            </div>

            <div className="portal-calendar">
              <div className="portal-calendar-weekdays">
                {DAYS.map((day) => (
                  <div key={day} className="portal-calendar-weekday">{day}</div>
                ))}
              </div>
              <div className="portal-calendar-grid">
                {renderMonthView()}
              </div>
            </div>

            <div className="portal-calendar-legend">
              <span className="portal-calendar-legend__title">Event Types:</span>
              {Object.entries(EVENT_TYPE_COLORS).map(([type, color]) => (
                <span key={type} className="portal-calendar-legend__item">
                  <span className={`portal-calendar-legend__dot portal-calendar-legend__dot--${color}`} />
                  {type}
                </span>
              ))}
            </div>
          </>
        )}

        {viewMode === 'list' && renderListView()}
      </section>

      {selectedEvent && (
        <div className="admin-modal-overlay" onClick={() => setSelectedEvent(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal__header">
              <h3>{selectedEvent.event}</h3>
              <button type="button" onClick={() => setSelectedEvent(null)} className="admin-modal__close">×</button>
            </div>
            <div className="admin-modal__body">
              <div className="portal-event-detail">
                <div className="portal-event-detail__header">
                  {selectedEvent.type && (
                    <span className={`portal-event-type-badge portal-event-type-badge--${EVENT_TYPE_COLORS[selectedEvent.type] || 'crimson'}`}>
                      {selectedEvent.type}
                    </span>
                  )}
                  <StatusBadge status={selectedEvent.status || 'Scheduled'} />
                </div>

                <div className="portal-event-detail__section">
                  <h4>Date & Time</h4>
                  <p>
                    <Clock size={16} />{' '}
                    {parseLocalDate(selectedEvent.date)?.toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    }) || selectedEvent.date}
                    <br />
                    {selectedEvent.time || 'TBD'}
                  </p>
                </div>

                {selectedEvent.location && (
                  <div className="portal-event-detail__section">
                    <h4>Location</h4>
                    <p>
                      <MapPin size={16} /> {selectedEvent.location}
                    </p>
                  </div>
                )}

                {typeof selectedEvent.attendees === 'number' && selectedEvent.attendees > 0 && (
                  <div className="portal-event-detail__section">
                    <h4>Attendance</h4>
                    <p>
                      <Users size={16} />{' '}
                      {selectedEvent.attendees} volunteer{selectedEvent.attendees !== 1 ? 's' : ''} registered
                    </p>
                  </div>
                )}

                {selectedEvent.description && (
                  <div className="portal-event-detail__section">
                    <h4>Description</h4>
                    <p>{selectedEvent.description}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="admin-modal__footer">
              <button type="button" className="btn btn--outline" onClick={() => setSelectedEvent(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </ApiState>
  )
}
