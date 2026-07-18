import { Link } from 'react-router-dom'
import { HeartHandshake, UserCheck, Users, Package, Truck, ListTodo } from 'lucide-react'
import { getDashboard } from '../../api/resources'
import { useApiObject } from '../../hooks/useApiList'
import PageHeader from '../../components/admin/shared/PageHeader'
import ApiState from '../../components/admin/shared/ApiState'
import LineChart from '../../components/admin/charts/LineChart'
import DonutChart from '../../components/admin/charts/DonutChart'
import StockLevelBar from '../../components/admin/shared/StockLevelBar'

const quickActions = [
  { to: '/admin/donations', icon: HeartHandshake, title: 'Verify Donations' },
  { to: '/admin/volunteers', icon: UserCheck, title: 'Review Volunteers' },
  { to: '/admin/beneficiaries', icon: Users, title: 'Approve Beneficiaries' },
  { to: '/admin/inventory', icon: Package, title: 'Check Inventory' },
  { to: '/admin/distributions', icon: Truck, title: 'Plan Distribution' },
  { to: '/admin/tasks', icon: ListTodo, title: 'View Tasks' },
]

function ChartEmpty({ message }) {
  return <p className="admin-chart__empty">{message}</p>
}

export default function DashboardPage() {
  const { data, loading, error, reload } = useApiObject(() => getDashboard())

  const charts = data?.charts || {}
  const trend = charts.monthlyTrend || []
  const donationTypes = (charts.donationTypes || []).filter((d) => d.value > 0)
  const distributionStatus = (charts.distributionStatus || []).filter((d) => d.value > 0)
  const inventoryLevels = charts.inventoryLevels || []

  const trendSeries = [
    {
      key: 'count',
      label: 'Donations received',
      color: '#AF101A',
      values: trend.map((m) => m.count),
    },
    {
      key: 'amount',
      label: 'Monetary (₱ thousands)',
      color: '#d97706',
      values: trend.map((m) => Math.round(m.amount / 1000)),
    },
  ]

  return (
    <>
      <PageHeader title="Dashboard" description="System overview and key metrics from MySQL." />
      <ApiState loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            <div className="admin-stats-grid">
              {data.stats.map((stat) => (
                <div key={stat.label} className={`admin-stat-card admin-stat-card--${stat.trend}`}>
                  <span className="admin-stat-card__value">{stat.value}</span>
                  <span className="admin-stat-card__label">{stat.label}</span>
                  <span className="admin-stat-card__change">{stat.change}</span>
                </div>
              ))}
            </div>

            <div className="admin-charts-grid">
              <section className="admin-panel admin-panel--chart">
                {trend.length > 0 ? (
                  <LineChart
                    title="Monthly Donation Trend (last 6 months)"
                    labels={trend.map((m) => m.month)}
                    series={trendSeries}
                  />
                ) : (
                  <>
                    <h3 className="admin-chart__title">Monthly Donation Trend</h3>
                    <ChartEmpty message="No donation data yet." />
                  </>
                )}
              </section>

              <section className="admin-panel admin-panel--chart">
                {donationTypes.length > 0 ? (
                  <DonutChart title="Donations by Type" data={donationTypes} />
                ) : (
                  <>
                    <h3 className="admin-chart__title">Donations by Type</h3>
                    <ChartEmpty message="No donations recorded yet." />
                  </>
                )}
              </section>
            </div>

            <div className="admin-charts-grid">
              <section className="admin-panel admin-panel--chart">
                <h3 className="admin-chart__title">Inventory Stock Levels</h3>
                {inventoryLevels.length > 0 ? (
                  <div className="dashboard-stock-list">
                    {inventoryLevels.map((item) => (
                      <div key={item.item} className="dashboard-stock-list__item">
                        <span className="dashboard-stock-list__name">{item.item}</span>
                        <StockLevelBar
                          level={item.level}
                          percent={item.percent}
                          quantity={item.quantity.toLocaleString()}
                          unit={item.unit}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <ChartEmpty message="No inventory items yet." />
                )}
                <Link to="/admin/inventory" className="admin-panel__footer-link">
                  View full inventory
                </Link>
              </section>

              <section className="admin-panel admin-panel--chart">
                {distributionStatus.length > 0 ? (
                  <DonutChart title="Distributions by Status" data={distributionStatus} />
                ) : (
                  <>
                    <h3 className="admin-chart__title">Distributions by Status</h3>
                    <ChartEmpty message="No distributions recorded yet." />
                  </>
                )}
              </section>
            </div>

            <div className="admin-dashboard-grid">
              <section className="admin-panel">
                <h2>Recent Activity</h2>
                <ul className="activity-feed">
                  {(data.recentActivity || []).map((item) => (
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
                  {quickActions.map((action, i) => {
                    const Icon = action.icon
                    const meta = data.quickActions?.[i]?.meta
                    return (
                      <Link key={action.to} to={action.to} className="quick-action">
                        <Icon size={20} strokeWidth={2} />
                        <div>
                          <strong>{action.title}</strong>
                          {meta && <span>{meta}</span>}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </section>
            </div>
          </>
        )}
      </ApiState>
    </>
  )
}
