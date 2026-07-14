import { Link } from 'react-router-dom'
import {
  HeartHandshake,
  UserCheck,
  Users,
  Package,
  Truck,
  ListTodo,
} from 'lucide-react'
import { dashboardStats, recentActivity } from '../../data/adminMockData'
import PageHeader from '../../components/admin/shared/PageHeader'

const quickActions = [
  { to: '/admin/donations', icon: HeartHandshake, title: 'Verify Donations', meta: '12 pending' },
  { to: '/admin/volunteers', icon: UserCheck, title: 'Review Volunteers', meta: '15 pending' },
  { to: '/admin/beneficiaries', icon: Users, title: 'Approve Beneficiaries', meta: '2 pending' },
  { to: '/admin/inventory', icon: Package, title: 'Check Inventory', meta: '18 low stock' },
  { to: '/admin/distributions', icon: Truck, title: 'Plan Distribution', meta: '8 scheduled' },
  { to: '/admin/tasks', icon: ListTodo, title: 'View Tasks', meta: '23 open' },
]

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="System overview and key metrics."
      />

      <div className="admin-stats-grid">
        {dashboardStats.map((stat) => (
          <div key={stat.label} className={`admin-stat-card admin-stat-card--${stat.trend}`}>
            <span className="admin-stat-card__value">{stat.value}</span>
            <span className="admin-stat-card__label">{stat.label}</span>
            <span className="admin-stat-card__change">{stat.change}</span>
          </div>
        ))}
      </div>

      <div className="admin-dashboard-grid">
        <section className="admin-panel">
          <h2>Recent Activity</h2>
          <ul className="activity-feed">
            {recentActivity.map((item) => (
              <li key={item.id} className={`activity-feed__item activity-feed__item--${item.type}`}>
                <div className="activity-feed__content">
                  <strong>{item.action}</strong>
                  <span>{item.detail}</span>
                </div>
                <time>{item.time}</time>
              </li>
            ))}
          </ul>
        </section>

        <section className="admin-panel">
          <h2>Quick Actions</h2>
          <div className="quick-actions">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <Link key={action.to} to={action.to} className="quick-action">
                  <Icon size={20} strokeWidth={2} />
                  <div>
                    <strong>{action.title}</strong>
                    <span>{action.meta}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      </div>
    </>
  )
}
