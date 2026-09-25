import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  MapPin,
  Clock,
  Users,
  Tag,
  ShieldCheck,
  Check,
  ExternalLink,
  Briefcase,
} from 'lucide-react'
import StatusBadge from '../../admin/components/shared/StatusBadge'
import ModalHeader from '../../admin/components/shared/ModalHeader'
import ApiState from '../../admin/components/shared/ApiState'
import Pagination from '../../admin/components/shared/Pagination'
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
  const navigate = useNavigate()
  const { data, loading, error, reload } = useApiObject(() => getPortalData())
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [viewMode, setViewMode] = useState('month')
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [didJump, setDidJump] = useState(false)
  const todayKey = dateKey(new Date())

  // Consolidate both scheduled duties and assigned tasks into unified schedule
  const schedule = useMemo(() => {
    const list = [...(data?.schedule || [])]
    const existingCodes = new Set(list.map((e) => String(e.code || e.id || '')))

    if (Array.isArray(data?.tasks)) {
      data.tasks.forEach((t) => {
        const taskId = String(t.code || t.id || '')
        const targetDate = t.dueDate || t.due_date || t.due || t.target_date
        if (taskId && !existingCodes.has(taskId) && targetDate && targetDate !== '—') {
          const mod = t.module || t.category || t.program || 'Volunteer Program'
          const lower = `${mod} ${t.title || ''}`.toLowerCase()
          let type = 'Community'
          if (lower.includes('distribut') || lower.includes('relief') || lower.includes('repack')) type = 'Distribution'
          else if (lower.includes('inventor') || lower.includes('warehouse')) type = 'Inventory'
          else if (lower.includes('feed') || lower.includes('program') || lower.includes('mission')) type = 'Programs'
          else if (lower.includes('train') || lower.includes('orient')) type = 'Training'

          const isTaskDone = Boolean(t.isDone || t.boardColumn === 'done' || t.status === 'Done' || t.status === 'Completed')

          const timeStr = t.dutyStart && t.dutyEnd
            ? `${t.dutyStart} - ${t.dutyEnd}`
            : (t.dutyHours ? `${t.dutyHours} hrs` : (t.duty_hours ? `${t.duty_hours} hrs` : 'Scheduled Duty'))

          list.push({
            id: taskId,
            code: taskId,
            date: targetDate,
            rawDate: targetDate,
            event: t.title || 'Assigned Duty',
            time: timeStr,
            location: t.location || 'Rise Above Foundation Cebu',
            type,
            status: isTaskDone ? 'Completed' : 'Scheduled',
            priority: t.priority || 'Low',
            module: mod,
            description: t.description || t.instructions || `Operational volunteer duty assigned under ${mod}.`,
            isTask: true,
            attendees: 1,
            rawTask: t,
          })
          existingCodes.add(taskId)
        }
      })
    }
    return list
  }, [data?.schedule, data?.tasks])

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
      const isPast = dateKey(date) < todayKey
      const typeColor = (type) => EVENT_TYPE_COLORS[type] || 'crimson'

      days.push(
        <div
          key={day}
          className={`portal-calendar-day ${isToday ? 'portal-calendar-day--today' : ''} ${isPast ? 'portal-calendar-day--past' : ''} ${events.length > 0 ? 'portal-calendar-day--has-events' : ''}`}
        >
          <div className="portal-calendar-day__number">{day}</div>
          <div className="portal-calendar-day__events">
            {events.slice(0, 3).map((event) => (
              <button
                key={event.id || `${event.event}-${event.date}`}
                type="button"
                className={`portal-calendar-event portal-calendar-event--${typeColor(event.type)}`}
                onClick={() => setSelectedEvent(event)}
                title={`${event.code ? `[${event.code}] ` : ''}${event.event} • ${event.time || 'Scheduled'}`}
              >
                <div className="portal-calendar-event__top">
                  <span className="portal-calendar-event__time">
                    <Clock size={10} style={{ display: 'inline', verticalAlign: '-1px', marginRight: '3px' }} />
                    {(event.time || 'Duty').split(' - ')[0]}
                  </span>
                  {event.status === 'Completed' ? (
                    <span className="portal-calendar-event__badge portal-calendar-event__badge--completed">Done</span>
                  ) : (
                    <span className="portal-calendar-event__badge portal-calendar-event__badge--scheduled">Assigned</span>
                  )}
                </div>
                <strong className="portal-calendar-event__title">{event.event}</strong>
                {event.module && (
                  <span className="portal-calendar-event__sub">{event.module}</span>
                )}
              </button>
            ))}
            {events.length > 3 && (
              <div className="portal-calendar-event__more">+{events.length - 3} more</div>
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
            <ModalHeader
              title={selectedEvent.event}
              onClose={() => setSelectedEvent(null)}
            />
            <div className="admin-modal__body">
              <div className="portal-event-detail">
                <div className="portal-event-detail__header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {selectedEvent.code && (
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}>
                        {selectedEvent.code}
                      </span>
                    )}
                    {selectedEvent.type && (
                      <span className={`portal-event-type-badge portal-event-type-badge--${EVENT_TYPE_COLORS[selectedEvent.type] || 'crimson'}`}>
                        {selectedEvent.type}
                      </span>
                    )}
                    {selectedEvent.priority && (
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 7px', borderRadius: '4px', background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>
                        <Tag size={11} style={{ display: 'inline', marginRight: '3px', verticalAlign: '-1px' }} />
                        {selectedEvent.priority} Priority
                      </span>
                    )}
                  </div>
                  <StatusBadge status={selectedEvent.status || 'Scheduled'} />
                </div>

                {selectedEvent.module && (
                  <div className="portal-event-detail__section" style={{ marginTop: '0.5rem' }}>
                    <h4>Program / Foundation Module</h4>
                    <p style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: '#0f766e' }}>
                      <Briefcase size={16} /> {selectedEvent.module}
                    </p>
                  </div>
                )}

                <div className="portal-event-detail__section">
                  <h4>Schedule & Timing</h4>
                  <p>
                    <Clock size={16} />{' '}
                    {parseLocalDate(selectedEvent.date)?.toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    }) || selectedEvent.date}
                    <br />
                    <strong>Duty Hours:</strong> {selectedEvent.time || 'Scheduled Operation'}
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

                {selectedEvent.rawTask?.requiredSkills && selectedEvent.rawTask.requiredSkills.length > 0 && (
                  <div className="portal-event-detail__section">
                    <h4>Required Skills & Focus</h4>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                      {selectedEvent.rawTask.requiredSkills.map((sk) => (
                        <span key={sk} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '2px 7px', color: '#475569' }}>
                          <Check size={11} color="#16a34a" /> {sk}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedEvent.description && (
                  <div className="portal-event-detail__section">
                    <h4>Activity Instructions & Details</h4>
                    <p style={{ lineHeight: 1.5 }}>{selectedEvent.description}</p>
                  </div>
                )}

                {selectedEvent.status === 'Completed' ? (
                  <div style={{ marginTop: '0.75rem', padding: '0.65rem 0.85rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', fontSize: '0.8rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <ShieldCheck size={16} color="#16a34a" />
                    <span><strong>Duty Verified & Completed:</strong> This volunteer service is completed and eligible for certificate request.</span>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="admin-modal__footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button type="button" className="btn btn--outline" onClick={() => setSelectedEvent(null)}>
                Close
              </button>
              {selectedEvent.isTask && (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => {
                    setSelectedEvent(null)
                    navigate('/volunteer-portal/tasks')
                  }}
                >
                  <ExternalLink size={14} /> View in My Tasks
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </ApiState>
  )
}
