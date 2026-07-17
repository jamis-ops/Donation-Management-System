import {
  dashboardStats,
  dashboardLineChart,
  dashboardCategoryChart,
  pendingTasks,
  recentActivity,
} from '../../data/adminMockData'
import PageHeader from '../../components/admin/shared/PageHeader'
import StatCard from '../../components/admin/charts/StatCard'
import LineChart from '../../components/admin/charts/LineChart'
import BarChart from '../../components/admin/charts/BarChart'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="System overview and key metrics."
      />

      <div className="admin-metrics-grid">
        {dashboardStats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="admin-charts-grid">
        <section className="admin-panel admin-panel--chart">
          <LineChart
            title="Donations vs. Distributions"
            labels={dashboardLineChart.labels}
            series={dashboardLineChart.series}
          />
        </section>

        <section className="admin-panel admin-panel--chart">
          <BarChart
            title="By Category"
            data={dashboardCategoryChart}
            valueKey="value"
            labelKey="label"
          />
        </section>
      </div>

      <div className="admin-dashboard-grid">
        <section className="admin-panel">
          <h2>Pending Tasks</h2>
          <ul className="admin-task-list">
            {pendingTasks.map((task) => (
              <li key={task.id} className="admin-task-list__item">
                <div className="admin-task-list__content">
                  {task.icon === 'alert' ? (
                    <AlertCircle size={18} className="admin-task-list__icon admin-task-list__icon--alert" />
                  ) : (
                    <CheckCircle2 size={18} className="admin-task-list__icon" />
                  )}
                  <span>{task.title}</span>
                </div>
                <span className={`admin-priority admin-priority--${task.priority.toLowerCase()}`}>
                  {task.priority}
                </span>
              </li>
            ))}
          </ul>
        </section>

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
      </div>
    </>
  )
}
