import { getReports } from '../../api/resources'
import { useApiObject } from '../../hooks/useApiList'
import PageHeader from '../../components/admin/shared/PageHeader'
import ApiState from '../../components/admin/shared/ApiState'
import LineChart from '../../components/admin/charts/LineChart'
import BarChart from '../../components/admin/charts/BarChart'
import DonutChart from '../../components/admin/charts/DonutChart'

function ChartEmpty({ message }) {
  return <p className="admin-chart__empty">{message}</p>
}

export default function ReportsPage() {
  const { data, loading, error, reload } = useApiObject(() => getReports())

  const summary = data?.summary
  const donationsByMonth = data?.donationsByMonth || []
  const beneficiariesByMonth = data?.beneficiariesByMonth || []
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

  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        description="Live donation, inventory, distribution, volunteer, and beneficiary analytics from the database."
        actions={
          <div className="table-actions">
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
                    title="Donations by Month (₱ thousands)"
                    labels={donationsByMonth.map((d) => d.month)}
                    series={donationsSeries}
                  />
                ) : (
                  <>
                    <h3 className="admin-chart__title">Donations by Month (₱ thousands)</h3>
                    <ChartEmpty message="No monetary donations recorded in the last 6 months." />
                  </>
                )}
              </section>

              <section className="admin-panel admin-panel--chart">
                {beneficiariesByMonth.some((d) => d.count > 0) ? (
                  <LineChart
                    title="Beneficiaries Served by Month"
                    labels={beneficiariesByMonth.map((d) => d.month)}
                    series={beneficiariesSeries}
                  />
                ) : (
                  <>
                    <h3 className="admin-chart__title">Beneficiaries Served by Month</h3>
                    <ChartEmpty message="No completed distributions in the last 6 months." />
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
