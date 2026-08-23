import { useMemo } from 'react'
import { 
  Clock, CheckSquare, Calendar, Award, ListTodo, CalendarDays, 
  FileText, CheckCircle, Inbox, TrendingUp, Sparkles, ShieldCheck 
} from 'lucide-react'
import { Link } from 'react-router-dom'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
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
  const currentYear = new Date().getFullYear()
  const currentMonthIndex = new Date().getMonth()
  const currentMonthName = new Date().toLocaleString('en-US', { month: 'short' })

  const activityLog = data?.activityLog || []
  
  const { totalYearHours, currentMonthHours } = useMemo(() => {
    let yearSum = 0
    let monthSum = 0
    activityLog.forEach((log) => {
      const k = dateKey(log.rawDate || log.date)
      if (!k) return
      const [y, m] = k.split('-').map(Number)
      if (y === currentYear) {
        yearSum += Number(log.hours || 0)
        if (m === currentMonthIndex + 1) {
          monthSum += Number(log.hours || 0)
        }
      }
    })
    if (yearSum === 0 && (data?.hoursBreakdown || []).length === 12) {
      yearSum = data.hoursBreakdown.reduce((sum, b) => sum + Number(b.hours || 0), 0)
      monthSum = Number(data.hoursBreakdown[currentMonthIndex]?.hours || 0)
    }
    // Fallback to stats array if available
    if (yearSum === 0 && data?.stats) {
      const clockStat = data.stats.find((s) => s.icon === 'clock')
      if (clockStat) yearSum = parseFloat(String(clockStat.value).replace(/[^0-9.]/g, '')) || 0
    }
    return { totalYearHours: yearSum, currentMonthHours: monthSum }
  }, [activityLog, currentYear, currentMonthIndex, data?.hoursBreakdown, data?.stats])

  const pendingTasksCount = (data?.tasks || []).filter(
    (t) => t.status !== 'Done' && t.boardColumn !== 'done' && !t.isDone
  ).length

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      {data && (
        <>
          {/* Top Summary Stat Cards */}
          <div className="portal-stats">
            <div className="portal-stat-card">
              <div className="portal-stat-card__icon" style={{ background: '#fef2f2', color: '#AF101A' }}>
                <Clock size={20} />
              </div>
              <span className="portal-stat-card__value">{totalYearHours} hrs</span>
              <span className="portal-stat-card__label">Total Rendered ({currentYear})</span>
            </div>

            <div className="portal-stat-card">
              <div className="portal-stat-card__icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
                <Calendar size={20} />
              </div>
              <span className="portal-stat-card__value">{currentMonthHours} hrs</span>
              <span className="portal-stat-card__label">This Month ({currentMonthName})</span>
            </div>

            <div className="portal-stat-card">
              <div className="portal-stat-card__icon" style={{ background: '#ecfdf5', color: '#059669' }}>
                <TrendingUp size={20} />
              </div>
              <span className="portal-stat-card__value">{activityLog.length || 0}</span>
              <span className="portal-stat-card__label">Verified Activities</span>
            </div>

            <div className="portal-stat-card">
              <div className="portal-stat-card__icon" style={{ background: '#fffbeb', color: '#d97706' }}>
                <CheckSquare size={20} />
              </div>
              <span className="portal-stat-card__value">{pendingTasksCount}</span>
              <span className="portal-stat-card__label">Active Tasks</span>
            </div>
          </div>

          {/* Annual Volunteer Target Progress */}
          <section className="portal-panel" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Award size={18} style={{ color: '#AF101A' }} />
                Annual Volunteer Target ({currentYear})
              </h3>
              <span style={{ fontWeight: 800, color: '#AF101A', fontSize: '0.95rem' }}>
                {totalYearHours} / 200 hours
              </span>
            </div>
            <div style={{ height: '10px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, #AF101A 0%, #059669 100%)',
                  borderRadius: '999px',
                  width: `${Math.min((totalYearHours / 200) * 100, 100)}%`,
                  transition: 'width 0.5s ease',
                }}
              />
            </div>
            <p style={{ margin: '0.55rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              {totalYearHours >= 200
                ? `🎉 Congratulations! You have achieved your annual target for ${currentYear}.`
                : `${Math.max(200 - totalYearHours, 0)} hours remaining to reach the 200-hour goal for ${currentYear}.`}
            </p>
          </section>

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
                      <StatusBadge status={t.isDone || t.boardColumn === 'done' || t.status === 'Done' || t.status === 'Completed' ? 'Completed' : 'Ongoing'} />
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
