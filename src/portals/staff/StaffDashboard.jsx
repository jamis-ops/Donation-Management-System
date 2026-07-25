import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardCheck, Package, Truck, CheckSquare, AlertTriangle, Clock, TrendingUp, ChevronRight, Inbox } from 'lucide-react'
import ApiState from '../../components/admin/shared/ApiState'
import { getPortalData } from '../../api/resources'
import { useApiObject } from '../../hooks/useApiList'

const iconMap = {
  clipboardCheck: ClipboardCheck,
  alertTriangle: AlertTriangle,
  checkSquare: CheckSquare,
  truck: Truck,
  package: Package,
  listChecks: CheckSquare,
}

const emptyMetrics = {
  donationsVerified: 0,
  inventoryUpdates: 0,
  distributionsCompleted: 0,
  tasksCompleted: 0,
}

export default function StaffDashboard() {
  const { data, loading, error, reload } = useApiObject(() => getPortalData())
  const [metricPeriod, setMetricPeriod] = useState('thisWeek')

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High': return '#dc2626'
      case 'Medium': return '#f59e0b'
      case 'Low': return '#6b7280'
      default: return '#6b7280'
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'In Progress': return '#3b82f6'
      case 'Assigned': return '#f59e0b'
      case 'Pending': return '#6b7280'
      case 'Completed': return '#16a34a'
      default: return '#6b7280'
    }
  }

  const metrics = data?.performanceMetrics?.[metricPeriod] || emptyMetrics
  const priorityTasks = (data?.tasks || []).filter((t) => t.priority === 'High' && t.status !== 'Completed').slice(0, 5)
  const pendingVerify = (data?.donationsToVerify || []).slice(0, 4)
  const todayDists = (data?.distributions || [])
    .filter((d) => ['Scheduled', 'In Progress', 'Planning', 'Preparing'].includes(d.status))
    .slice(0, 3)

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      {data && (
        <div className="staff-dashboard">
          <div className="portal-stats">
            {(data.stats || []).map((item) => {
              const Icon = iconMap[item.icon]
              return (
                <div key={item.label} className="portal-stat-card staff-stat-card">
                  <div className="portal-stat-card__icon" style={{ backgroundColor: `${item.color || '#d97706'}15`, color: item.color || '#d97706' }}>
                    {Icon && <Icon size={24} />}
                  </div>
                  <div className="portal-stat-card__content">
                    <span className="portal-stat-card__value">{item.value}</span>
                    <span className="portal-stat-card__label">{item.label}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <section className="portal-panel staff-quick-actions">
            <div className="portal-panel__header">
              <h2>Quick Actions</h2>
            </div>
            <div className="staff-action-grid">
              {(data.quickActions || []).map((action) => {
                const Icon = iconMap[action.icon]
                return (
                  <Link key={action.id} to={action.route} className="staff-action-card">
                    <div className="staff-action-card__icon">
                      {Icon && <Icon size={20} />}
                    </div>
                    <div className="staff-action-card__content">
                      <strong>{action.label}</strong>
                      {action.count > 0 && <span className="staff-action-card__badge">{action.count}</span>}
                    </div>
                    <ChevronRight size={16} className="staff-action-card__arrow" />
                  </Link>
                )
              })}
            </div>
          </section>

          <div className="portal-grid">
            <section className="portal-panel">
              <div className="portal-panel__header">
                <h2>Priority Tasks</h2>
                <Link to="/staff/tasks" className="portal-panel__link">View All</Link>
              </div>
              <div className="staff-priority-tasks">
                {priorityTasks.length === 0 ? (
                  <div className="portal-empty">
                    <CheckSquare size={24} />
                    <p>No high-priority open tasks.</p>
                  </div>
                ) : priorityTasks.map((task) => (
                  <div key={task.id} className="staff-task-priority-card">
                    <div className="staff-task-priority-card__header">
                      <span className="staff-task-priority-card__category" style={{ backgroundColor: '#d9770615', color: '#d97706' }}>
                        {task.category}
                      </span>
                      <span className="staff-task-priority-card__priority" style={{ backgroundColor: `${getPriorityColor(task.priority)}15`, color: getPriorityColor(task.priority) }}>
                        {task.priority}
                      </span>
                    </div>
                    <h4>{task.title}</h4>
                    <div className="staff-task-priority-card__footer">
                      <span><Clock size={14} /> Due: {task.dueDate || task.due || '—'}</span>
                      <span style={{ color: getStatusColor(task.status) }}>{task.status}</span>
                    </div>
                    {task.completionRate > 0 && (
                      <div className="staff-task-progress">
                        <div className="staff-task-progress__bar" style={{ width: `${task.completionRate}%` }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="portal-panel">
              <div className="portal-panel__header">
                <h2>Inventory Alerts</h2>
                <Link to="/staff/inventory" className="portal-panel__link">Manage</Link>
              </div>
              <div className="staff-inventory-alerts">
                {(data.inventoryAlerts || []).length === 0 ? (
                  <div className="portal-empty">
                    <Package size={24} />
                    <p>No low-stock alerts right now.</p>
                  </div>
                ) : (data.inventoryAlerts || []).slice(0, 6).map((alert) => (
                  <Link
                    key={`${alert.item}-${alert.dbId || ''}`}
                    to="/staff/inventory"
                    className={`staff-alert-item staff-alert-item--${String(alert.severity || 'low').toLowerCase()}`}
                  >
                    <AlertTriangle size={16} />
                    <div className="staff-alert-item__content">
                      <strong>{alert.item}</strong>
                      <span>{alert.currentStock} / {alert.minStock} units</span>
                    </div>
                    <span className="staff-alert-item__badge">{alert.severity}</span>
                  </Link>
                ))}
              </div>
            </section>
          </div>

          <div className="portal-grid">
            <section className="portal-panel">
              <div className="portal-panel__header">
                <h2>Pending Verifications</h2>
                <Link to="/staff/verification" className="portal-panel__link">View All</Link>
              </div>
              <div className="staff-verification-list">
                {pendingVerify.length === 0 ? (
                  <div className="portal-empty">
                    <ClipboardCheck size={24} />
                    <p>No donations waiting for verification.</p>
                  </div>
                ) : pendingVerify.map((donation) => (
                  <Link key={donation.id} to="/staff/verification" className="staff-verification-card">
                    <div className="staff-verification-card__header">
                      <strong>{donation.donor}</strong>
                      <span className="staff-verification-card__badge" style={{
                        backgroundColor: donation.priority === 'High' ? '#dc262615' : '#f59e0b15',
                        color: donation.priority === 'High' ? '#dc2626' : '#f59e0b',
                      }}>
                        {donation.priority}
                      </span>
                    </div>
                    <div className="staff-verification-card__details">
                      <span>{donation.amount}</span>
                      <span>•</span>
                      <span>{donation.program}</span>
                    </div>
                    <div className="staff-verification-card__status">
                      <span style={{ color: '#6b7280' }}>{donation.status}</span>
                      <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>{donation.submittedDate}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            <section className="portal-panel">
              <div className="portal-panel__header">
                <h2>Upcoming Distributions</h2>
                <Link to="/staff/distributions" className="portal-panel__link">Schedule</Link>
              </div>
              <div className="staff-distribution-schedule">
                {todayDists.length === 0 ? (
                  <div className="portal-empty">
                    <Truck size={24} />
                    <p>No upcoming distributions scheduled.</p>
                  </div>
                ) : todayDists.map((dist) => (
                  <div key={dist.id} className="staff-distribution-item">
                    <div className="staff-distribution-item__time">
                      <Clock size={16} />
                      <span>{dist.time || dist.date}</span>
                    </div>
                    <div className="staff-distribution-item__content">
                      <strong>{dist.program}</strong>
                      <span>{dist.location}</span>
                      <span className="staff-distribution-item__beneficiaries">
                        {dist.beneficiaries || 0} beneficiaries • {dist.items}
                      </span>
                    </div>
                    <span className={`staff-distribution-item__status staff-distribution-item__status--${String(dist.status).toLowerCase().replace(/\s+/g, '-')}`}>
                      {dist.status}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="portal-panel">
            <div className="portal-panel__header">
              <h2>Performance Overview</h2>
              <div className="staff-metrics-toggle">
                <button
                  type="button"
                  className={`staff-metrics-toggle__btn${metricPeriod === 'thisWeek' ? ' staff-metrics-toggle__btn--active' : ''}`}
                  onClick={() => setMetricPeriod('thisWeek')}
                >
                  This Week
                </button>
                <button
                  type="button"
                  className={`staff-metrics-toggle__btn${metricPeriod === 'thisMonth' ? ' staff-metrics-toggle__btn--active' : ''}`}
                  onClick={() => setMetricPeriod('thisMonth')}
                >
                  This Month
                </button>
              </div>
            </div>
            <div className="staff-metrics-grid">
              <div className="staff-metric-card">
                <TrendingUp size={20} style={{ color: '#16a34a' }} />
                <div className="staff-metric-card__content">
                  <span className="staff-metric-card__value">{metrics.donationsVerified}</span>
                  <span className="staff-metric-card__label">Donations Verified</span>
                </div>
              </div>
              <div className="staff-metric-card">
                <Package size={20} style={{ color: '#0891b2' }} />
                <div className="staff-metric-card__content">
                  <span className="staff-metric-card__value">{metrics.inventoryUpdates}</span>
                  <span className="staff-metric-card__label">Low Stock Items</span>
                </div>
              </div>
              <div className="staff-metric-card">
                <Truck size={20} style={{ color: '#16a34a' }} />
                <div className="staff-metric-card__content">
                  <span className="staff-metric-card__value">{metrics.distributionsCompleted}</span>
                  <span className="staff-metric-card__label">Distributions</span>
                </div>
              </div>
              <div className="staff-metric-card">
                <CheckSquare size={20} style={{ color: '#d97706' }} />
                <div className="staff-metric-card__content">
                  <span className="staff-metric-card__value">{metrics.tasksCompleted}</span>
                  <span className="staff-metric-card__label">Tasks Completed</span>
                </div>
              </div>
            </div>
          </section>

          <section className="portal-panel">
            <div className="portal-panel__header">
              <h2>Recent Activity</h2>
            </div>
            <div className="staff-activity-feed">
              {(data.recentActivity || []).length === 0 ? (
                <div className="portal-empty">
                  <Inbox size={24} />
                  <p>No recent activity yet.</p>
                </div>
              ) : (data.recentActivity || []).slice(0, 8).map((activity, index) => (
                <div key={`${activity.title}-${index}`} className="staff-activity-item">
                  <div className={`staff-activity-item__icon staff-activity-item__icon--${String(activity.type || '').split('_')[0]}`}>
                    {String(activity.type || '').includes('alert') && <AlertTriangle size={14} />}
                    {String(activity.type || '').includes('verification') && <ClipboardCheck size={14} />}
                    {String(activity.type || '').includes('distribution') && <Truck size={14} />}
                    {String(activity.type || '').includes('inventory') && <Package size={14} />}
                    {String(activity.type || '').includes('task') && <CheckSquare size={14} />}
                    {String(activity.type || '').includes('donation') && <ClipboardCheck size={14} />}
                    {!activity.type && <Inbox size={14} />}
                  </div>
                  <div className="staff-activity-item__content">
                    <p>{activity.title}</p>
                    <span>{activity.date}{activity.time ? ` • ${activity.time}` : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </ApiState>
  )
}
