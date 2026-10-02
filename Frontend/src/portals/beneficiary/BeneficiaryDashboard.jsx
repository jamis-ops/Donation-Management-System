import { Link } from 'react-router-dom'
import { 
  Inbox, CheckCircle, Calendar, Package, Clock, FileText, MapPin, 
  AlertCircle, FileCheck, Building2, Users, ArrowRight, ShieldCheck, 
  Sparkles, CheckCircle2 
} from 'lucide-react'
import StatusBadge from '../../admin/components/shared/StatusBadge'
import ApiState from '../../admin/components/shared/ApiState'
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

function parseEventDate(dateStr, defaultIndex = 1) {
  if (!dateStr || dateStr === '—' || dateStr === 'TBD' || dateStr === 'Invalid Date') {
    return { day: '—', month: 'TBD' }
  }

  const cleanStr = String(dateStr).trim()
  const match = cleanStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (match) {
    const year = parseInt(match[1], 10)
    const month = parseInt(match[2], 10) - 1
    const day = parseInt(match[3], 10)
    const d = new Date(year, month, day)
    if (!Number.isNaN(d.getTime())) {
      return {
        day: String(d.getDate()),
        month: d.toLocaleDateString('en-US', { month: 'short' }),
      }
    }
  }

  const d = new Date(cleanStr.includes('T') ? cleanStr : cleanStr.replace(/-/g, '/'))
  if (!Number.isNaN(d.getTime())) {
    return {
      day: String(d.getDate()),
      month: d.toLocaleDateString('en-US', { month: 'short' }),
    }
  }

  return { day: '—', month: 'TBD' }
}

export default function BeneficiaryDashboard() {
  const { data, loading, error, reload } = useApiObject(() => getPortalData())

  const profile = data?.profile || {
    name: 'Barangay Beneficiary Portal',
    barangay: 'Barangay Office',
    municipality: '',
    representative: 'Official Representative',
    families: 0,
    status: 'Active',
  }

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      {data && (
        <>
          {/* Barangay Hero Profile Banner */}
          <div className="barangay-hero-banner">
            <div className="barangay-hero-icon">
              <Building2 size={26} />
            </div>
            <div className="barangay-hero-info">
              <div className="barangay-hero-title-row">
                <h2 className="barangay-hero-title">
                  {profile.barangay || profile.name}
                </h2>
                <span className="barangay-partner-badge">
                  <CheckCircle2 size={13} /> Official Beneficiary Partner
                </span>
              </div>
              <p className="barangay-hero-meta">
                {profile.municipality && <span>📍 {profile.municipality}</span>}
                {profile.municipality && <span>•</span>}
                <span>Representative: <strong>{profile.representative || profile.name}</strong></span>
                <span>•</span>
                <span>Registered Families: <strong>{profile.families ?? 0}</strong></span>
              </p>
            </div>
            <Link to="/beneficiary/requests" className="btn btn--primary" style={{ whiteSpace: 'nowrap' }}>
              <Inbox size={15} /> + New Request
            </Link>
          </div>

          {/* KPI Stats Grid */}
          <div className="volunteer-kpi-grid" style={{ marginBottom: '1.5rem' }}>
            {(data.stats || []).map((item) => {
              const Icon = iconMap[item.icon] || Package
              let cardModifier = 'volunteer-kpi-card--total'
              let destination = '/beneficiary/requests'
              if (item.label.includes('Received') || item.label.includes('Completed')) {
                cardModifier = 'volunteer-kpi-card--hours'
                destination = '/beneficiary/requests'
              } else if (item.label.includes('Total Requests')) {
                cardModifier = 'volunteer-kpi-card--total'
                destination = '/beneficiary/requests'
              } else if (item.label.includes('Active Requests') || item.label.includes('Approved') || item.label.includes('Review')) {
                cardModifier = 'volunteer-kpi-card--completed'
                destination = '/beneficiary/requests?status=Under+Review'
              } else if (item.label.includes('Deliveries') || item.label.includes('Schedule')) {
                cardModifier = 'volunteer-kpi-card--ongoing'
                destination = '/beneficiary/requests'
              }

              return (
                <Link
                  key={item.label}
                  to={destination}
                  className={`volunteer-kpi-card volunteer-kpi-card--clickable ${cardModifier}`}
                  title={`View ${item.label}`}
                >
                  <div className="volunteer-kpi-card__icon">
                    <Icon size={20} />
                  </div>
                  <div>
                    <div className="volunteer-kpi-card__value">{item.value ?? 0}</div>
                    <div className="volunteer-kpi-card__label">{item.label}</div>
                  </div>
                </Link>
              )
            })}
          </div>

          {/* Quick Actions */}
          <section className="portal-panel portal-quick-actions">
            <div className="portal-panel__header">
              <h2>Barangay Portal Actions</h2>
            </div>
            <div className="portal-quick-actions__grid">
              <Link to="/beneficiary/requests" className="portal-quick-action">
                <Inbox size={24} />
                <span>Submit Relief Request</span>
              </Link>
              <Link to="/beneficiary/requests" className="portal-quick-action">
                <Calendar size={24} />
                <span>Track Relief Requests</span>
              </Link>
              <Link to="/beneficiary/proofs" className="portal-quick-action">
                <FileText size={24} />
                <span>Upload Turnover Proof</span>
              </Link>
              <Link to="/beneficiary/history" className="portal-quick-action">
                <Package size={24} />
                <span>Assistance History</span>
              </Link>
            </div>
          </section>

          {/* Upcoming Schedule */}
          {(data.upcomingSchedule || []).length > 0 && (
            <section className="portal-panel beneficiary-schedule-highlight">
              <div className="portal-panel__header">
                <div>
                  <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Calendar size={18} style={{ color: '#059669' }} /> Upcoming Relief Deliveries
                  </h2>
                  <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    Scheduled turn-overs and relief assistance for your barangay community.
                  </p>
                </div>
                <Link to="/beneficiary/requests" className="portal-panel__link">View Request Progress</Link>
              </div>
              <div className="beneficiary-upcoming-events">
                {data.upcomingSchedule.slice(0, 3).map((schedule, idx) => {
                  const dateInfo = parseEventDate(schedule.date, idx + 1)
                  return (
                    <div key={idx} className="beneficiary-upcoming-event">
                      <div className="beneficiary-upcoming-event__date" title={schedule.date || 'Scheduled'}>
                        <span className="beneficiary-upcoming-event__day">{dateInfo.day}</span>
                        <span className="beneficiary-upcoming-event__month">{dateInfo.month}</span>
                      </div>
                      <div className="beneficiary-upcoming-event__content">
                        <strong>{schedule.event || 'Relief Goods Distribution'}</strong>
                        <span className="beneficiary-upcoming-event__location">
                          <MapPin size={14} /> {schedule.location || 'Barangay Hall'}
                        </span>
                        <span className="beneficiary-upcoming-event__time">
                          <Clock size={14} /> {schedule.time || '9:00 AM'} · {schedule.items || 'Relief Goods'}
                        </span>
                      </div>
                      <div className="beneficiary-upcoming-event__type">
                        <StatusBadge status={schedule.status || 'Scheduled'} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="beneficiary-reminder">
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>Barangay Representative Reminder: Please prepare the distribution area and have the recipient beneficiary roster ready for verification upon delivery.</span>
              </div>
            </section>
          )}

          <div className="portal-dashboard-grid">
            {/* Recent Requests */}
            <section className="portal-panel">
              <div className="portal-panel__header">
                <h2>Recent Assistance Requests</h2>
                <Link to="/beneficiary/requests" className="portal-panel__link">View All</Link>
              </div>
              <ul className="portal-task-list">
                {(data.requests || []).slice(0, 4).map((r) => (
                  <li key={r.id} className="portal-task-item">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.78rem', color: '#AF101A' }}>
                          {r.id}
                        </span>
                        <strong>{r.type}</strong>
                      </div>
                      <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Submitted on {r.date}</span>
                      <div>
                        <span className={`beneficiary-priority-badge beneficiary-priority-badge--${r.priority?.toLowerCase() || 'unassigned'}`}>
                          {r.priority ? `${r.priority} Priority` : 'Awaiting Admin Assessment'}
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
                {(data.requests || []).length === 0 && (
                  <li className="portal-empty">
                    <Inbox size={24} />
                    <p>No requests yet. Submit a new relief request when assistance is needed.</p>
                  </li>
                )}
              </ul>
            </section>

            {/* Recent Activity */}
            <section className="portal-panel">
              <div className="portal-panel__header">
                <h2>Relief Activity Stream</h2>
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
                {(data.recentActivity || []).length === 0 && (
                  <li className="portal-empty">
                    <Clock size={24} />
                    <p>No activity yet. Activities will appear here as requests and deliveries progress.</p>
                  </li>
                )}
              </ul>
            </section>
          </div>

          {/* Assistance Summary */}
          <section className="portal-panel">
            <div className="portal-panel__header">
              <h2>Assistance Received by Program</h2>
              <Link to="/beneficiary/history" className="portal-panel__link">Full History</Link>
            </div>
            <div className="beneficiary-summary-grid">
              {(data.benefitsByProgram || []).slice(0, 4).map((program) => (
                <div key={program.program} className="beneficiary-summary-card">
                  <div className="beneficiary-summary-card__header">
                    <strong>{program.program}</strong>
                    <span className="beneficiary-summary-card__count">{program.count} distributions</span>
                  </div>
                  <div className="beneficiary-summary-card__value">
                    ₱{program.totalValue.toLocaleString()}
                  </div>
                </div>
              ))}
              {(data.benefitsByProgram || []).length === 0 && (
                <div className="portal-empty" style={{ gridColumn: '1 / -1', padding: '1.5rem 1rem' }}>
                  <Package size={24} />
                  <p>No assistance received yet. Records will appear here once relief is delivered.</p>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </ApiState>
  )
}
