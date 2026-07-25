import { Clock, CheckSquare, Calendar, Award, ListTodo, CalendarDays, FileText, CheckCircle, Inbox } from 'lucide-react'
import { Link } from 'react-router-dom'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import { getPortalData } from '../../api/resources'
import { useApiObject } from '../../hooks/useApiList'

const iconMap = {
  clock: Clock,
  checkSquare: CheckSquare,
  calendar: Calendar,
  award: Award,
}

const activityIconMap = {
  checkCircle: CheckCircle,
  award: Award,
  calendar: Calendar,
  inbox: Inbox,
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

export default function VolunteerDashboard() {
  const { data, loading, error, reload } = useApiObject(() => getPortalData())
  const todayKey = dateKey(new Date())

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      {data && (
        <>
          <div className="portal-stats">
            {(data.stats || []).map((item) => {
              const Icon = iconMap[item.icon]
              return (
                <div key={item.label} className="portal-stat-card">
                  {Icon && (
                    <div className="portal-stat-card__icon">
                      <Icon size={20} />
                    </div>
                  )}
                  <span className="portal-stat-card__value">{item.value}</span>
                  <span className="portal-stat-card__label">{item.label}</span>
                </div>
              )
            })}
          </div>

          <section className="portal-panel portal-quick-actions">
            <div className="portal-panel__header">
              <h2>Quick Actions</h2>
            </div>
            <div className="portal-quick-actions__grid">
              <Link to="/volunteer-portal/tasks" className="portal-quick-action">
                <ListTodo size={24} />
                <span>View All Tasks</span>
              </Link>
              <Link to="/volunteer-portal/schedule" className="portal-quick-action">
                <CalendarDays size={24} />
                <span>Check Schedule</span>
              </Link>
              <Link to="/volunteer-portal/hours" className="portal-quick-action">
                <Clock size={24} />
                <span>Log Hours</span>
              </Link>
              <Link to="/volunteer-portal/certificates" className="portal-quick-action">
                <FileText size={24} />
                <span>My Certificates</span>
              </Link>
            </div>
          </section>

          <div className="portal-dashboard-grid">
            <section className="portal-panel">
              <div className="portal-panel__header">
                <h2>Upcoming Tasks</h2>
                <Link to="/volunteer-portal/tasks" className="portal-panel__link">View All</Link>
              </div>
              <ul className="portal-task-list">
                {(data.tasks || [])
                  .filter((t) => t.status !== 'Done' && t.boardColumn !== 'done')
                  .slice(0, 4)
                  .map((t) => (
                    <li key={t.id} className="portal-task-item">
                      <div>
                        <strong>{t.title}</strong>
                        <span>Due: {t.due} · {t.category || 'General'}</span>
                      </div>
                      <StatusBadge status={t.status} />
                    </li>
                  ))}
                {(data.tasks || []).filter((t) => t.status !== 'Done' && t.boardColumn !== 'done').length === 0 && (
                  <li className="portal-empty">
                    <CheckSquare size={24} />
                    <p>All caught up! No pending tasks.</p>
                  </li>
                )}
              </ul>
            </section>

            <section className="portal-panel">
              <div className="portal-panel__header">
                <h2>Recent Activity</h2>
              </div>
              <ul className="portal-activity-list">
                {(data.recentActivity || []).length === 0 ? (
                  <li className="portal-empty">
                    <Inbox size={24} />
                    <p>No recent activity yet.</p>
                  </li>
                ) : (
                  (data.recentActivity || []).slice(0, 5).map((activity, idx) => {
                    const Icon = activityIconMap[activity.icon] || CheckCircle
                    return (
                      <li key={`${activity.title}-${idx}`} className="portal-activity-item">
                        <div className="portal-activity-item__icon">
                          <Icon size={16} />
                        </div>
                        <div className="portal-activity-item__content">
                          <strong>{activity.title}</strong>
                          <span className="portal-activity-item__date">{activity.date}</span>
                        </div>
                      </li>
                    )
                  })
                )}
              </ul>
            </section>
          </div>

          <section className="portal-panel">
            <div className="portal-panel__header">
              <h2>Upcoming Events</h2>
              <Link to="/volunteer-portal/schedule" className="portal-panel__link">View Calendar</Link>
            </div>
            <div className="portal-event-preview">
              {(() => {
                const schedule = [...(data.schedule || [])].sort((a, b) =>
                  dateKey(a.date).localeCompare(dateKey(b.date))
                )
                const upcoming = schedule.filter((s) => dateKey(s.date) >= todayKey)
                const preview = (upcoming.length ? upcoming : schedule.slice(-3).reverse()).slice(0, 3)

                if (!preview.length) {
                  return (
                    <div className="portal-empty">
                      <Calendar size={24} />
                      <p>No events on your schedule yet.</p>
                    </div>
                  )
                }

                return preview.map((event) => {
                  const d = parseLocalDate(event.date)
                  const isPast = dateKey(event.date) < todayKey
                  return (
                    <div key={event.id || event.event} className="portal-event-card">
                      <div className="portal-event-card__date">
                        <span className="portal-event-card__day">{d ? d.getDate() : '—'}</span>
                        <span className="portal-event-card__month">
                          {d ? d.toLocaleDateString('en-US', { month: 'short' }) : '—'}
                        </span>
                      </div>
                      <div className="portal-event-card__content">
                        <strong>{event.event}</strong>
                        <span className="portal-event-card__time">
                          <Clock size={14} /> {event.time || 'TBD'}
                        </span>
                        {event.location && (
                          <span className="portal-event-card__location">{event.location}</span>
                        )}
                      </div>
                      <div className="portal-event-card__status">
                        <StatusBadge status={isPast ? 'Completed' : (event.status || 'Scheduled')} />
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </section>
        </>
      )}
    </ApiState>
  )
}
