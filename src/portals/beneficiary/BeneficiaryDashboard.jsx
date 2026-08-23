import { Link } from 'react-router-dom'
import { 
  Inbox, CheckCircle, Calendar, Package, Clock, FileText, MapPin, 
  AlertCircle, FileCheck, Building2, Users, ArrowRight, ShieldCheck, 
  Sparkles, CheckCircle2 
} from 'lucide-react'
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

  const profile = data?.profile || {
    name: 'Barangay Beneficiary Portal',
    barangay: 'Barangay Office',
    municipality: 'Cebu Province',
    representative: 'Official Representative',
    families: 150,
    status: 'Active',
  }

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      {data && (
        <>
          {/* Barangay Hero Profile Banner */}
          <div className="volunteer-kpi-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.25rem', background: 'linear-gradient(135deg, #fff7f7 0%, #fff 100%)', border: '1px solid #fecaca' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #AF101A, #800000)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(175, 16, 26, 0.25)' }}>
              <Building2 size={24} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#0f172a' }}>
                  {profile.barangay || profile.name}
                </h2>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '999px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
                  ✓ Official Beneficiary Partner
                </span>
              </div>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.84rem', color: '#64748b' }}>
                {profile.municipality} • Representative: <strong>{profile.representative}</strong> • Registered Families: <strong>{profile.families}</strong>
              </p>
            </div>
            <Link to="/beneficiary/requests" className="btn btn--sm btn--primary" style={{ whiteSpace: 'nowrap' }}>
              <Inbox size={14} /> + New Request
            </Link>
          </div>

          {/* Stats Cards */}
          <div className="portal-stats">
            {(data.stats || []).map((item) => {
              const Icon = iconMap[item.icon] || Package
              let cardClass = ''
              if (item.label.includes('Active Requests')) cardClass = 'volunteer-kpi-card--total'
              else if (item.label.includes('Approved')) cardClass = 'volunteer-kpi-card--completed'
              else if (item.label.includes('Deliveries') || item.label.includes('Schedule')) cardClass = 'volunteer-kpi-card--ongoing'
              else cardClass = 'volunteer-kpi-card--hours'

              return (
                <div key={item.label} className="portal-stat-card">
                  <div className="portal-stat-card__icon">
                    <Icon size={20} />
                  </div>
                  <span className="portal-stat-card__value">{item.value}</span>
                  <span className="portal-stat-card__label">{item.label}</span>
                </div>
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
              <Link to="/beneficiary/distributions" className="portal-quick-action">
                <Calendar size={24} />
                <span>Distribution Schedule</span>
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
                <Link to="/beneficiary/distributions" className="portal-panel__link">View All Schedule</Link>
              </div>
              <div className="beneficiary-upcoming-events">
                {data.upcomingSchedule.slice(0, 3).map((schedule, idx) => (
                  <div key={idx} className="beneficiary-upcoming-event">
                    <div className="beneficiary-upcoming-event__date">
                      <span className="beneficiary-upcoming-event__day">
                        {new Date(schedule.date).getDate() || idx + 1}
                      </span>
                      <span className="beneficiary-upcoming-event__month">
                        {new Date(schedule.date).toLocaleDateString('en-US', { month: 'short' }) || 'Aug'}
                      </span>
                    </div>
                    <div className="beneficiary-upcoming-event__content">
                      <strong>{schedule.event}</strong>
                      <span className="beneficiary-upcoming-event__location">
                        <MapPin size={14} /> {schedule.location}
                      </span>
                      <span className="beneficiary-upcoming-event__time">
                        <Clock size={14} /> {schedule.time || '9:00 AM'} · {schedule.items || 'Relief Goods'}
                      </span>
                    </div>
                    <div className="beneficiary-upcoming-event__type">
                      <StatusBadge status={schedule.status || 'Scheduled'} />
                    </div>
                  </div>
                ))}
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
                      {r.priority && (
                        <div>
                          <span className={`beneficiary-priority-badge beneficiary-priority-badge--${r.priority.toLowerCase()}`}>
                            {r.priority} Priority
                          </span>
                        </div>
                      )}
                    </div>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
                {(data.requests || []).length === 0 && (
                  <li className="portal-empty">
                    <Inbox size={24} />
                    <p>No active requests. Submit a new relief request when assistance is needed.</p>
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
            </div>
          </section>
        </>
      )}
    </ApiState>
  )
}
