import { useState } from 'react'
import { getReports } from '../../api/resources'
import { useApiObject } from '../../hooks/useApiList'
import PageHeader from '../../components/admin/shared/PageHeader'
import ApiState from '../../components/admin/shared/ApiState'
import LineChart from '../../components/admin/charts/LineChart'
import BarChart from '../../components/admin/charts/BarChart'
import DonutChart from '../../components/admin/charts/DonutChart'

const GRANULARITIES = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
]

function ChartEmpty({ message }) {
  return <p className="admin-chart__empty">{message}</p>
}

export default function ReportsPage() {
  const { data, loading, error, reload } = useApiObject(() => getReports())
  const [gran, setGran] = useState('month')

  const summary = data?.summary
  const donationsByMonth = data?.trends?.donations?.[gran] || data?.donationsByMonth || []
  const beneficiariesByMonth = data?.trends?.beneficiaries?.[gran] || data?.beneficiariesByMonth || []
  const beneficiariesByCategory = (data?.beneficiariesByCategory || []).filter((d) => d.value > 0)
  const distributionByLocation = (data?.distributionByLocation || []).filter((d) => d.value > 0)
  const programFulfillment = data?.programFulfillment || []

  const donationsSeries = [
    {
      key: 'donations',
      label: 'Donations (₱K)',
      color: '#AF101A',
      values: donationsByMonth.map((d) => d.amount),
    },
  ]

  const beneficiariesSeries = [
    {
      key: 'served',
      label: 'Beneficiaries served',
      color: '#16a34a',
      values: beneficiariesByMonth.map((d) => d.count),
    },
  ]

  const changePct = summary?.donationsChangePct ?? 0
  const changeLabel =
    changePct > 0 ? `▲ ${changePct}% vs last month`
    : changePct < 0 ? `▼ ${Math.abs(changePct)}% vs last month`
    : 'No change vs last month'

  const granLabel = { week: 'Week', month: 'Month', year: 'Year' }[gran]
  const granEmpty = { week: 'the last 8 weeks', month: 'the last 6 months', year: 'the last 4 years' }[gran]

  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        description="Live donation, inventory, distribution, volunteer, and beneficiary analytics from the database."
        actions={
          <div className="table-actions">
            <div className="report-period" role="group" aria-label="Group trends by">
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
            <button type="button" className="btn btn--admin-outline" onClick={reload}>Refresh</button>
          </div>
        }
      />

      <ApiState loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            <div className="admin-stats-grid admin-stats-grid--compact">
              <div className="admin-stat-card">
                <span className="admin-stat-card__value">{summary.donationsThisMonth}</span>
                <span className="admin-stat-card__label">Donations This Month</span>
                <span className="admin-stat-card__change">{changeLabel}</span>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-card__value">{summary.beneficiariesServed.toLocaleString()}</span>
                <span className="admin-stat-card__label">Beneficiaries Served (YTD)</span>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-card__value">{summary.distributionsCompleted}</span>
                <span className="admin-stat-card__label">Distributions Completed (YTD)</span>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-card__value">{summary.volunteerHours.toLocaleString()}</span>
                <span className="admin-stat-card__label">Volunteer Hours</span>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-card__value">{summary.inventoryTurnover}</span>
                <span className="admin-stat-card__label">Inventory Turnover</span>
              </div>
            </div>

            <div className="admin-charts-grid">
              <section className="admin-panel admin-panel--chart">
                {donationsByMonth.some((d) => d.amount > 0) ? (
                  <LineChart
                    title={`Donations by ${granLabel} (₱ thousands)`}
                    labels={donationsByMonth.map((d) => d.month)}
                    series={donationsSeries}
                  />
                ) : (
                  <>
                    <h3 className="admin-chart__title">Donations by {granLabel} (₱ thousands)</h3>
                    <ChartEmpty message={`No monetary donations recorded in ${granEmpty}.`} />
                  </>
                )}
              </section>

              <section className="admin-panel admin-panel--chart">
                {beneficiariesByMonth.some((d) => d.count > 0) ? (
                  <LineChart
                    title={`Beneficiaries Served by ${granLabel}`}
                    labels={beneficiariesByMonth.map((d) => d.month)}
                    series={beneficiariesSeries}
                  />
                ) : (
                  <>
                    <h3 className="admin-chart__title">Beneficiaries Served by {granLabel}</h3>
                    <ChartEmpty message={`No completed distributions in ${granEmpty}.`} />
                  </>
                )}
              </section>
            </div>

            <div className="admin-charts-grid admin-charts-grid--3">
              <section className="admin-panel admin-panel--chart">
                {beneficiariesByCategory.length > 0 ? (
                  <DonutChart title="Beneficiaries by Category" data={beneficiariesByCategory} />
                ) : (
                  <>
                    <h3 className="admin-chart__title">Beneficiaries by Category</h3>
                    <ChartEmpty message="No approved beneficiaries yet." />
                  </>
                )}
              </section>

              <section className="admin-panel admin-panel--chart">
                {distributionByLocation.length > 0 ? (
                  <BarChart title="Distribution Reach by Location" data={distributionByLocation} />
                ) : (
                  <>
                    <h3 className="admin-chart__title">Distribution Reach by Location</h3>
                    <ChartEmpty message="No distributions recorded yet." />
                  </>
                )}
              </section>

              <section className="admin-panel admin-panel--chart">
                <h3 className="admin-chart__title">Allocated vs. Distributed by Program</h3>
                {programFulfillment.length > 0 ? (
                  <div className="demand-supply-grid demand-supply-grid--vertical">
                    {programFulfillment.map((item) => (
                      <div key={item.program} className="demand-supply-card">
                        <strong>{item.program}</strong>
                        <div className="demand-supply-dual">
                          <div>
                            <span>Allocated ({item.allocated.toLocaleString()})</span>
                            <div className="demand-supply-bar">
                              <div className="demand-supply-bar__fill" style={{ width: `${item.demand}%` }} />
                            </div>
                          </div>
                          <div>
                            <span>Distributed ({item.distributed.toLocaleString()})</span>
                            <div className="demand-supply-bar">
                              <div
                                className={`demand-supply-bar__fill${item.supply >= item.demand && item.demand > 0 ? ' demand-supply-bar__fill--good' : ''}`}
                                style={{ width: `${item.supply}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ChartEmpty message="No allocations recorded yet." />
                )}
              </section>
            </div>
          </>
        )}
      </ApiState>
    </>
  )
}
