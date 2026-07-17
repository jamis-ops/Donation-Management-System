import { chartData, reportSummary } from '../../data/adminMockData'
import PageHeader from '../../components/admin/shared/PageHeader'
import LineChart from '../../components/admin/charts/LineChart'
import BarChart from '../../components/admin/charts/BarChart'
import DonutChart from '../../components/admin/charts/DonutChart'

const donationsSeries = [
  {
    key: 'donations',
    label: 'Donations (₱K)',
    color: '#AF101A',
    values: chartData.donationsByMonth.map((d) => d.amount),
  },
]

const volunteerSeries = [
  {
    key: 'hours',
    label: 'Volunteer Hours',
    color: '#AF101A',
    values: chartData.volunteerHoursByMonth.map((d) => d.hours),
  },
]

export default function ReportsPage() {
  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        description="Donation, inventory, distribution, volunteer, and beneficiary analytics."
        actions={
          <div className="table-actions">
            <button type="button" className="btn btn--admin-outline">Export CSV</button>
            <button type="button" className="btn btn--admin-outline">Export Excel</button>
          </div>
        }
      />

      <div className="admin-stats-grid admin-stats-grid--compact">
        <div className="admin-stat-card">
          <span className="admin-stat-card__value">{reportSummary.donationsThisMonth}</span>
          <span className="admin-stat-card__label">Donations This Month</span>
          <span className="admin-stat-card__change">vs {reportSummary.donationsLastMonth} last month</span>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-card__value">{reportSummary.beneficiariesServed.toLocaleString()}</span>
          <span className="admin-stat-card__label">Beneficiaries Served (YTD)</span>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-card__value">{reportSummary.distributionsCompleted}</span>
          <span className="admin-stat-card__label">Distributions Completed</span>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-card__value">{reportSummary.volunteerHours.toLocaleString()}</span>
          <span className="admin-stat-card__label">Volunteer Hours (YTD)</span>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-card__value">{reportSummary.inventoryTurnover}</span>
          <span className="admin-stat-card__label">Inventory Turnover</span>
        </div>
      </div>

      <div className="admin-charts-grid">
        <section className="admin-panel admin-panel--chart">
          <LineChart
            title="Donations by Month (₱ thousands)"
            labels={chartData.donationsByMonth.map((d) => d.month)}
            series={donationsSeries}
          />
        </section>

        <section className="admin-panel admin-panel--chart">
          <LineChart
            title="Volunteer Hours by Month"
            labels={chartData.volunteerHoursByMonth.map((d) => d.month)}
            series={volunteerSeries}
          />
        </section>
      </div>

      <div className="admin-charts-grid admin-charts-grid--3">
        <section className="admin-panel admin-panel--chart">
          <DonutChart
            title="Beneficiaries by Program"
            data={chartData.beneficiariesByProgram}
            labelKey="program"
            valueKey="count"
          />
        </section>

        <section className="admin-panel admin-panel--chart">
          <BarChart
            title="Distribution by Location"
            data={chartData.distributionByLocation}
            valueKey="count"
            labelKey="location"
          />
        </section>

        <section className="admin-panel admin-panel--chart">
          <h3 className="admin-chart__title">Demand vs. Supply by Program (%)</h3>
          <div className="demand-supply-grid demand-supply-grid--vertical">
            {chartData.demandVsSupply.map((item) => (
              <div key={item.program} className="demand-supply-card">
                <strong>{item.program}</strong>
                <div className="demand-supply-dual">
                  <div>
                    <span>Demand</span>
                    <div className="demand-supply-bar">
                      <div className="demand-supply-bar__fill" style={{ width: `${item.demand}%` }} />
                    </div>
                  </div>
                  <div>
                    <span>Supply</span>
                    <div className="demand-supply-bar">
                      <div
                        className={`demand-supply-bar__fill${item.supply >= item.demand ? ' demand-supply-bar__fill--good' : ''}`}
                        style={{ width: `${item.supply}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
