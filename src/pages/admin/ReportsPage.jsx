import { reportSummary, chartData } from '../../data/adminMockData'
import PageHeader from '../../components/admin/shared/PageHeader'

function BarChart({ data, valueKey, labelKey, unit = '' }) {
  const max = Math.max(...data.map((d) => d[valueKey]))
  return (
    <div className="bar-chart">
      {data.map((item) => (
        <div key={item[labelKey]} className="bar-chart__item">
          <span className="bar-chart__label">{item[labelKey]}</span>
          <div className="bar-chart__track">
            <div
              className="bar-chart__fill"
              style={{ width: `${(item[valueKey] / max) * 100}%` }}
            />
          </div>
          <span className="bar-chart__value">
            {unit}{typeof item[valueKey] === 'number' && item[valueKey] > 100 ? (item[valueKey] / 1000).toFixed(1) + 'K' : item[valueKey]}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function ReportsPage() {
  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        description="Donation, inventory, distribution, volunteer, and beneficiary analytics."
        actions={
          <div className="table-actions">
            <button type="button" className="btn btn--outline">Export CSV</button>
            <button type="button" className="btn btn--outline">Export Excel</button>
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

      <div className="admin-dashboard-grid">
        <section className="admin-panel">
          <h2>Donations by Month (₱ thousands)</h2>
          <BarChart data={chartData.donationsByMonth} valueKey="amount" labelKey="month" />
        </section>

        <section className="admin-panel">
          <h2>Demand vs. Supply by Program (%)</h2>
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
