import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { HeartHandshake, UserCheck, Users, Package, Truck, UserCog } from 'lucide-react'
import { getDashboard, needsStockApi } from '../../api/resources'
import { useApiObject } from '../../hooks/useApiList'
import PageHeader from '../../components/admin/shared/PageHeader'
import ApiState from '../../components/admin/shared/ApiState'
import LineChart from '../../components/admin/charts/LineChart'
import DonutChart from '../../components/admin/charts/DonutChart'
import BarChart from '../../components/admin/charts/BarChart'
import StockLevelBar from '../../components/admin/shared/StockLevelBar'
import { useSeeMore } from '../../hooks/useSeeMore'
import { SeeMoreToggle } from '../../components/admin/shared/SeeMoreList'

const GRANULARITIES = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
]

const NEEDS_POLL_MS = 45000

const INDICATOR_LABEL = {
  shortage: 'Shortage',
  sufficient: 'Sufficient',
  excess: 'Surplus',
}

const quickActions = [
  { to: '/admin/donations', icon: HeartHandshake, title: 'Verify Donations' },
  { to: '/admin/volunteers', icon: UserCheck, title: 'Review Volunteers' },
  { to: '/admin/beneficiaries', icon: Users, title: 'Approve Beneficiaries' },
  { to: '/admin/inventory', icon: Package, title: 'Check Inventory' },
  { to: '/admin/distributions', icon: Truck, title: 'Plan Distribution' },
  { to: '/admin/staff', icon: UserCog, title: 'Manage Staff' },
]

function ChartEmpty({ message }) {
  return <p className="admin-chart__empty">{message}</p>
}

function NeedsVsStockRow({ row }) {
  const max = Math.max(row.requested || 0, row.available || 0, 1)
  const needPct = Math.round(((row.requested || 0) / max) * 100)
  const stockPct = Math.round(((row.available || 0) / max) * 100)
  const unit = row.unit || 'packs'
  const indicator = INDICATOR_LABEL[row.indicator] || row.indicator

  return (
    <li className={`needs-vs-stock-list__item needs-vs-stock-list__item--${row.indicator}`}>
      <div className="needs-vs-stock-list__head">
        <strong>{row.label}</strong>
        <span className={`needs-vs-stock-list__badge needs-vs-stock-list__badge--${row.indicator}`}>
          {indicator}
        </span>
      </div>
      <div className="needs-vs-stock-list__bars" aria-hidden="true">
        <div className="needs-vs-stock-list__bar-row">
          <span className="needs-vs-stock-list__bar-label">Need</span>
          <div className="needs-vs-stock-list__track">
            <div
              className="needs-vs-stock-list__fill needs-vs-stock-list__fill--need"
              style={{ width: `${needPct}%` }}
            />
          </div>
          <span className="needs-vs-stock-list__bar-value">
            {Number(row.requested || 0).toLocaleString()}
          </span>
        </div>
        <div className="needs-vs-stock-list__bar-row">
          <span className="needs-vs-stock-list__bar-label">Stock</span>
          <div className="needs-vs-stock-list__track">
            <div
              className="needs-vs-stock-list__fill needs-vs-stock-list__fill--stock"
              style={{ width: `${stockPct}%` }}
            />
          </div>
          <span className="needs-vs-stock-list__bar-value">
            {Number(row.available || 0).toLocaleString()}
          </span>
        </div>
      </div>
      <div className="needs-vs-stock-list__meta">
        <span>
          Gap {row.gap > 0 ? '+' : ''}
          {Number(row.gap || 0).toLocaleString()} {unit}
        </span>
        {row.requests > 0 && (
          <span>
            {row.requests} request{row.requests === 1 ? '' : 's'}
            {row.barangays > 0
              ? ` · ${row.barangays} barangay${row.barangays === 1 ? '' : 's'}`
              : ''}
          </span>
        )}
        {row.coverage != null && row.requested > 0 && (
          <span>{row.coverage}% covered</span>
        )}
      </div>
    </li>
  )
}

export default function DashboardPage() {
  const { data, loading, error, reload } = useApiObject(() => getDashboard())
  const [gran, setGran] = useState('month')
  const [needs, setNeeds] = useState(null)
  const [needsError, setNeedsError] = useState('')

  const loadNeeds = useCallback(() => {
    needsStockApi.get()
      .then((res) => {
        setNeeds(res.data || null)
        setNeedsError('')
      })
      .catch((err) => {
        setNeeds(null)
        setNeedsError(err?.message || 'Could not load needs vs stock.')
      })
  }, [])

  useEffect(() => {
    loadNeeds()
  }, [data, loadNeeds])

  useEffect(() => {
    const id = window.setInterval(loadNeeds, NEEDS_POLL_MS)
    const onFocus = () => loadNeeds()
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [loadNeeds])

  const charts = data?.charts || {}
  const trend = charts.trend?.[gran] || charts.monthlyTrend || []
  const granLabel = { week: 'Week', month: 'Month', year: 'Year' }[gran]
  const donationTypes = (charts.donationTypes || []).filter((d) => d.value > 0)
  const distributionStatus = (charts.distributionStatus || []).filter((d) => d.value > 0)
  const inventoryLevels = charts.inventoryLevels || []
  const beneficiaryTypes = (charts.beneficiaryTypes || []).filter((d) => d.value > 0)
  const flowComparison = (charts.flowComparison || []).filter((d) => d.value > 0)
  const forecast = charts.forecast || []
  const stockSeeMore = useSeeMore(inventoryLevels, 3)
  const needsComparison = needs?.comparison || []
  const needsSeeMore = useSeeMore(needsComparison, 4)
  const needsSummary = needs?.summary || null
  const forecastSeeMore = useSeeMore(forecast, 3)
  const activitySeeMore = useSeeMore(data?.recentActivity || [], 3)

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
      <ApiState
        loading={loading}
        error={error}
        onRetry={() => {
          reload()
          loadNeeds()
        }}
      >
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
                <div className="admin-chart__toolbar">
                  <h3 className="admin-chart__title admin-chart__title--inline">Donation Trend by {granLabel}</h3>
                  <div className="report-period" role="group" aria-label="Group trend by">
                    {GRANULARITIES.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        className={`report-period__btn${gran === p.value ? ' report-period__btn--active' : ''}`}
                        onClick={() => setGran(p.value)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                {trend.some((m) => m.count > 0 || m.amount > 0) ? (
                  <LineChart
                    labels={trend.map((m) => m.month)}
                    series={trendSeries}
                  />
                ) : (
                  <ChartEmpty message="No donation data for this period yet." />
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
                  <div className="see-more-wrap">
                    <div className="dashboard-stock-list">
                      {stockSeeMore.visible.map((item) => (
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
                    {stockSeeMore.needsToggle && (
                      <SeeMoreToggle
                        expanded={stockSeeMore.expanded}
                        onToggle={stockSeeMore.toggle}
                        hiddenCount={stockSeeMore.hiddenCount}
                      />
                    )}
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

            <div className="admin-charts-grid admin-charts-grid--3">
              <section className="admin-panel admin-panel--chart">
                {beneficiaryTypes.length > 0 ? (
                  <DonutChart title="Active Beneficiaries by Type" data={beneficiaryTypes} />
                ) : (
                  <>
                    <h3 className="admin-chart__title">Active Beneficiaries by Type</h3>
                    <ChartEmpty message="No approved barangays with a type set yet." />
                  </>
                )}
              </section>

              <section className="admin-panel admin-panel--chart">
                {flowComparison.length > 0 ? (
                  <BarChart title="Available vs Allocated vs Distributed (packs)" data={flowComparison} />
                ) : (
                  <>
                    <h3 className="admin-chart__title">Available vs Allocated vs Distributed</h3>
                    <ChartEmpty message="No inventory movement recorded yet." />
                  </>
                )}
              </section>

              <section className="admin-panel admin-panel--chart">
                <h3 className="admin-chart__title">Needs vs Available Stock</h3>
                <p className="needs-vs-stock-list__hint">
                  Open request needs vs matching inventory by category/item. Live from MySQL.
                </p>
                {needsSummary && (
                  <div className="needs-vs-stock-summary" aria-label="Needs summary">
                    <span className="needs-chip needs-chip--shortage">{needsSummary.shortage} shortage</span>
                    <span className="needs-chip needs-chip--ok">{needsSummary.sufficient} sufficient</span>
                    <span className="needs-chip needs-chip--excess">{needsSummary.excess} surplus</span>
                    {needsSummary.openRequests != null && (
                      <span className="needs-vs-stock-summary__meta">
                        {needsSummary.openRequests} open request{needsSummary.openRequests === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                )}
                {needsComparison.length > 0 ? (
                  <div className="see-more-wrap">
                    <ul className="needs-vs-stock-list">
                      {needsSeeMore.visible.map((row) => (
                        <NeedsVsStockRow key={row.key} row={row} />
                      ))}
                    </ul>
                    {needsSeeMore.needsToggle && (
                      <SeeMoreToggle
                        expanded={needsSeeMore.expanded}
                        onToggle={needsSeeMore.toggle}
                        hiddenCount={needsSeeMore.hiddenCount}
                      />
                    )}
                  </div>
                ) : (
                  <ChartEmpty message={needsError || 'No open request needs or inventory to compare yet.'} />
                )}
                <div className="needs-vs-stock-list__actions">
                  <Link to="/admin/allocation" className="btn btn--sm btn--outline">
                    Open Allocation
                  </Link>
                  <button type="button" className="btn btn--sm btn--ghost" onClick={loadNeeds}>
                    Refresh
                  </button>
                </div>
              </section>

              <section className="admin-panel admin-panel--chart">
                <h3 className="admin-chart__title">Inventory Forecast</h3>
                {forecast.length > 0 ? (
                  <div className="see-more-wrap">
                    <ul className="forecast-list">
                      {forecastSeeMore.visible.map((f) => (
                        <li key={f.item} className={`forecast-list__item forecast-list__item--${f.status}`}>
                          <div className="forecast-list__head">
                            <span className="forecast-list__name">{f.item}</span>
                            <span className="forecast-list__qty">{f.quantity.toLocaleString()} {f.unit}</span>
                          </div>
                          <span className="forecast-list__eta">
                            {f.daysLeft === null
                              ? 'No recent outflow — stable'
                              : f.daysLeft < 14
                                ? `≈ ${f.daysLeft} days left — reorder now`
                                : f.daysLeft < 30
                                  ? `≈ ${f.daysLeft} days left — monitor`
                                  : `≈ ${f.daysLeft} days of stock`}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {forecastSeeMore.needsToggle && (
                      <SeeMoreToggle
                        expanded={forecastSeeMore.expanded}
                        onToggle={forecastSeeMore.toggle}
                        hiddenCount={forecastSeeMore.hiddenCount}
                      />
                    )}
                  </div>
                ) : (
                  <ChartEmpty message="No inventory items to forecast yet." />
                )}
              </section>
            </div>

            <div className="admin-dashboard-grid">
              <section className="admin-panel">
                <h2>Recent Activity</h2>
                <ul className="activity-feed">
                  {activitySeeMore.visible.map((item) => (
                    <li key={item.id} className={`activity-feed__item activity-feed__item--${item.type}`}>
                      <div className="activity-feed__content">
                        <strong>{item.action}</strong>
                        <span>{item.detail}</span>
                      </div>
                      <time>{item.time}</time>
                    </li>
                  ))}
                </ul>
                {activitySeeMore.needsToggle && (
                  <SeeMoreToggle
                    expanded={activitySeeMore.expanded}
                    onToggle={activitySeeMore.toggle}
                    hiddenCount={activitySeeMore.hiddenCount}
                  />
                )}
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
