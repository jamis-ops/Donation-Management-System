import { useMemo } from 'react'
import { 
  CheckSquare, Calendar, Award, ListTodo, CalendarDays, 
  FileText, CheckCircle, Inbox, TrendingUp, Clock
} from 'lucide-react'
import { Link } from 'react-router-dom'
import StatusBadge from '../../admin/components/shared/StatusBadge'
import ApiState from '../../admin/components/shared/ApiState'
import { getPortalData } from '../../api/resources'
import { useApiObject } from '../../hooks/useApiList'

const activityIconMap = {
  checkCircle: CheckCircle,
  award: Award,
  calendar: Calendar,
  inbox: Inbox,
}

function dateKey(value) {
  if (!value || value === '—') return ''
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const d = new Date(value)
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

  const activityLog = data?.activityLog || []
  const tasks = data?.tasks || []
  const schedule = data?.schedule || []

  const completedTasksCount = useMemo(() => {
    return tasks.filter((t) => t.isDone || t.boardColumn === 'done' || t.status === 'Done' || t.status === 'Completed').length
  }, [tasks])

  const pendingTasksCount = useMemo(() => {
    return tasks.filter((t) => t.status !== 'Done' && t.boardColumn !== 'done' && !t.isDone).length
  }, [tasks])

  const upcomingEventsCount = useMemo(() => {
    return schedule.filter((s) => dateKey(s.date) >= todayKey).length || schedule.length
  }, [schedule, todayKey])

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      {data && (
        <>
          {/* Top Summary Stat Cards */}
          <div className="portal-stats">
            <Link
              to="/volunteer-portal/tasks?status=Completed"
              className="portal-stat-card portal-stat-card--clickable"
              title="View Completed Tasks"
            >
              <div className="portal-stat-card__icon" style={{ background: '#fef2f2', color: '#AF101A' }}>
                <CheckCircle size={20} />
              </div>
              <span className="portal-stat-card__value">{completedTasksCount}</span>
              <span className="portal-stat-card__label">Completed Tasks</span>
            </Link>

            <Link
              to="/volunteer-portal/tasks?status=Ongoing"
              className="portal-stat-card portal-stat-card--clickable"
              title="View Active / Ongoing Tasks"
            >
              <div className="portal-stat-card__icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
                <CheckSquare size={20} />
              </div>
              <span className="portal-stat-card__value">{pendingTasksCount}</span>
              <span className="portal-stat-card__label">Active Tasks</span>
            </Link>

            <Link
              to="/volunteer-portal/tasks?status=Completed"
              className="portal-stat-card portal-stat-card--clickable"
              title="View Verified Activities"
            >
              <div className="portal-stat-card__icon" style={{ background: '#ecfdf5', color: '#059669' }}>
                <TrendingUp size={20} />
              </div>
              <span className="portal-stat-card__value">{activityLog.length || 0}</span>
              <span className="portal-stat-card__label">Verified Activities</span>
            </Link>

            <Link
              to="/volunteer-portal/schedule"
              className="portal-stat-card portal-stat-card--clickable"
              title="View Upcoming Schedule"
            >
              <div className="portal-stat-card__icon" style={{ background: '#fffbeb', color: '#d97706' }}>
                <Calendar size={20} />
              </div>
              <span className="portal-stat-card__value">{upcomingEventsCount}</span>
              <span className="portal-stat-card__label">Upcoming Events</span>
            </Link>
          </div>

          <section className="portal-panel portal-quick-actions">
            <div className="portal-panel__header">
              <h2>Quick Actions</h2>
            </div>
            <div className="portal-quick-actions__grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <Link to="/volunteer-portal/tasks" className="portal-quick-action">
                <ListTodo size={24} />
                <span>View All Tasks</span>
              </Link>
              <Link to="/volunteer-portal/schedule" className="portal-quick-action">
                <CalendarDays size={24} />
                <span>Check Schedule</span>
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
                {tasks
                  .filter((t) => t.status !== 'Done' && t.boardColumn !== 'done' && !t.isDone)
                  .slice(0, 4)
                  .map((t) => (
                    <li key={t.id} className="portal-task-item">
                      <div>
                        <strong>{t.title}</strong>
                        <span>Due: {t.due} · {t.category || 'General'}</span>
                      </div>
                      <StatusBadge status={t.isDone || t.boardColumn === 'done' || t.status === 'Done' || t.status === 'Completed' ? 'Completed' : 'Ongoing'} />
                    </li>
                  ))}
                {tasks.filter((t) => t.status !== 'Done' && t.boardColumn !== 'done' && !t.isDone).length === 0 && (
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
                const schedList = [...(data.schedule || [])].sort((a, b) =>
                  dateKey(a.date).localeCompare(dateKey(b.date))
                )
                const upcoming = schedList.filter((s) => dateKey(s.date) >= todayKey)
                const preview = (upcoming.length ? upcoming : schedList.slice(-3).reverse()).slice(0, 3)

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
