import { Link } from 'react-router-dom'
import { Inbox, CheckCircle, Calendar, Package, Clock, FileText, MapPin, AlertCircle, FileCheck } from 'lucide-react'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import { getPortalData } from '../../api/resources'
import { useApiObject } from '../../hooks/useApiList'

const iconMap = {
  inbox: Inbox,
  checkCircle: CheckCircle,
  calendar: Calendar,
  package: Package,
}

const activityIconMap = {
  inbox: Inbox,
  checkCircle: CheckCircle,
  calendar: Calendar,
  package: Package,
  fileCheck: FileCheck,
}

export default function BeneficiaryDashboard() {
  const { data, loading, error, reload } = useApiObject(() => getPortalData())

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      {data && (
        <>
          {/* Stats Cards */}
          <div className="portal-stats">
            {data.stats.map((item) => {
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

          {/* Quick Actions */}
          <section className="portal-panel portal-quick-actions">
            <div className="portal-panel__header">
              <h2>Quick Actions</h2>
            </div>
            <div className="portal-quick-actions__grid">
              <Link to="/beneficiary/requests" className="portal-quick-action">
                <Inbox size={24} />
                <span>New Request</span>
              </Link>
              <Link to="/beneficiary/distributions" className="portal-quick-action">
                <Calendar size={24} />
                <span>View Schedule</span>
              </Link>
              <Link to="/beneficiary/history" className="portal-quick-action">
                <Package size={24} />
                <span>Assistance History</span>
              </Link>
              <Link to="/beneficiary/proofs" className="portal-quick-action">
                <FileText size={24} />
                <span>Upload Proof</span>
              </Link>
            </div>
          </section>

          {/* Upcoming Schedule */}
          {data.upcomingSchedule && data.upcomingSchedule.length > 0 && (
            <section className="portal-panel beneficiary-schedule-highlight">
              <div className="portal-panel__header">
                <h2>Upcoming Schedule</h2>
                <Link to="/beneficiary/distributions" className="portal-panel__link">View All</Link>
              </div>
              <div className="beneficiary-upcoming-events">
                {data.upcomingSchedule.map((schedule, idx) => (
                  <div key={idx} className="beneficiary-upcoming-event">
                    <div className="beneficiary-upcoming-event__date">
                      <span className="beneficiary-upcoming-event__day">
                        {new Date(schedule.date).getDate()}
                      </span>
                      <span className="beneficiary-upcoming-event__month">
                        {new Date(schedule.date).toLocaleDateString('en-US', { month: 'short' })}
                      </span>
                    </div>
                    <div className="beneficiary-upcoming-event__content">
                      <strong>{schedule.event}</strong>
                      <span className="beneficiary-upcoming-event__location">
                        <MapPin size={14} /> {schedule.location}
                      </span>
                      <span className="beneficiary-upcoming-event__time">
                        <Clock size={14} /> {schedule.time}
                      </span>
                    </div>
                    <div className="beneficiary-upcoming-event__type">
                      <span className="beneficiary-type-badge">{schedule.type}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="beneficiary-reminder">
                <AlertCircle size={16} />
                <span>Please bring a valid ID and proof of residence for pickup.</span>
              </div>
            </section>
          )}

          <div className="portal-dashboard-grid">
            {/* Recent Requests */}
            <section className="portal-panel">
              <div className="portal-panel__header">
                <h2>Recent Requests</h2>
                <Link to="/beneficiary/requests" className="portal-panel__link">View All</Link>
              </div>
              <ul className="portal-task-list">
                {data.requests.slice(0, 4).map((r) => (
                  <li key={r.id} className="portal-task-item">
                    <div>
                      <strong>{r.type}</strong>
                      <span>{r.id} · {r.date}</span>
                      {r.priority && (
                        <span className={`beneficiary-priority-badge beneficiary-priority-badge--${r.priority.toLowerCase()}`}>
                          {r.priority}
                        </span>
                      )}
                    </div>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            </section>

            {/* Recent Activity */}
            <section className="portal-panel">
              <div className="portal-panel__header">
                <h2>Recent Activity</h2>
              </div>
              <ul className="portal-activity-list">
                {(data.recentActivity || []).slice(0, 5).map((activity, idx) => {
                  const Icon = activityIconMap[activity.icon] || CheckCircle
                  return (
                    <li key={idx} className="portal-activity-item">
                      <div className="portal-activity-item__icon">
                        <Icon size={16} />
                      </div>
                      <div className="portal-activity-item__content">
                        <strong>{activity.title}</strong>
                        <span className="portal-activity-item__date">{activity.date}</span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          </div>

          {/* Assistance Summary */}
          <section className="portal-panel">
            <div className="portal-panel__header">
              <h2>Assistance Received Summary</h2>
              <Link to="/beneficiary/history" className="portal-panel__link">Full History</Link>
            </div>
            <div className="beneficiary-summary-grid">
              {(data.benefitsByProgram || []).slice(0, 5).map((program) => (
                <div key={program.program} className="beneficiary-summary-card">
                  <div className="beneficiary-summary-card__header">
                    <strong>{program.program}</strong>
                    <span className="beneficiary-summary-card__count">{program.count}x</span>
                  </div>
                  <div className="beneficiary-summary-card__value">
                    ₱{program.totalValue.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Actions */}
          <div className="portal-actions">
            <Link to="/beneficiary/requests" className="btn btn--primary">
              <Inbox size={16} /> Submit New Request
            </Link>
            <Link to="/beneficiary/proofs" className="btn btn--outline">
              <FileText size={16} /> Upload Proof
            </Link>
          </div>
        </>
      )}
    </ApiState>
  )
}
