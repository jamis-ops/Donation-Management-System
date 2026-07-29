import { useState } from 'react'
import { Calendar, Download, TrendingUp, Package } from 'lucide-react'
import ApiState from '../../components/admin/shared/ApiState'
import { getPortalData } from '../../api/resources'
import { useApiObject } from '../../hooks/useApiList'
import { notify } from '../../utils/toast'

export default function BeneficiaryHistoryPage() {
  const { data, loading, error, reload } = useApiObject(() => getPortalData())
  const [selectedYear] = useState(2026)

  const totalValue = data?.history?.reduce((sum, h) => {
    const value = parseFloat(h.value.replace(/[₱,]/g, ''))
    return sum + value
  }, 0) || 0

  const totalItems = data?.history?.length || 0

  const maxMonthlyValue = Math.max(...(data?.benefitsByMonth?.map(m => m.value) || [0]))

  const handleExportPDF = () => {
    notify.info('Export to PDF functionality - Demo mode')
  }

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      {data && (
        <>
          {/* Summary Cards */}
          <div className="beneficiary-history-summary">
            <div className="beneficiary-history-summary-card">
              <div className="beneficiary-history-summary-card__icon">
                <TrendingUp size={20} />
              </div>
              <div className="beneficiary-history-summary-card__content">
                <span className="beneficiary-history-summary-card__value">₱{totalValue.toLocaleString()}</span>
                <span className="beneficiary-history-summary-card__label">Total Value Received</span>
              </div>
            </div>
            <div className="beneficiary-history-summary-card beneficiary-history-summary-card--blue">
              <div className="beneficiary-history-summary-card__icon">
                <Package size={20} />
              </div>
              <div className="beneficiary-history-summary-card__content">
                <span className="beneficiary-history-summary-card__value">{totalItems}</span>
                <span className="beneficiary-history-summary-card__label">Items Received</span>
              </div>
            </div>
            <div className="beneficiary-history-summary-card beneficiary-history-summary-card--green">
              <div className="beneficiary-history-summary-card__icon">
                <Calendar size={20} />
              </div>
              <div className="beneficiary-history-summary-card__content">
                <span className="beneficiary-history-summary-card__value">{data.benefitsByMonth?.length || 0}</span>
                <span className="beneficiary-history-summary-card__label">Months Active</span>
              </div>
            </div>
          </div>

          {/* Monthly Breakdown Chart */}
          <section className="portal-panel">
            <div className="portal-panel__header">
              <h2>Monthly Assistance - {selectedYear}</h2>
              <button
                type="button"
                className="btn btn--sm btn--outline"
                onClick={handleExportPDF}
              >
                <Download size={14} /> Export PDF
              </button>
            </div>
            <div className="beneficiary-benefits-chart">
              {(data.benefitsByMonth || []).map((month, idx) => (
                <div key={idx} className="beneficiary-benefits-bar">
                  <div className="beneficiary-benefits-bar__wrapper">
                    <div
                      className="beneficiary-benefits-bar__fill"
                      style={{ height: `${(month.value / maxMonthlyValue) * 100}%` }}
                    >
                      <span className="beneficiary-benefits-bar__value">₱{(month.value / 1000).toFixed(1)}k</span>
                    </div>
                  </div>
                  <div className="beneficiary-benefits-bar__label">
                    <span>{month.month.slice(0, 3)}</span>
                    <span className="beneficiary-benefits-bar__sublabel">{month.count} items</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Benefits by Program */}
          <section className="portal-panel">
            <div className="portal-panel__header">
              <h2>Assistance by Program</h2>
            </div>
            <div className="beneficiary-program-breakdown">
              {(data.benefitsByProgram || []).map((program) => (
                <div key={program.program} className="beneficiary-program-row">
                  <div className="beneficiary-program-row__info">
                    <strong>{program.program}</strong>
                    <span>{program.count} times · ₱{program.totalValue.toLocaleString()}</span>
                  </div>
                  <div className="beneficiary-program-row__bar">
                    <div
                      className="beneficiary-program-row__fill"
                      style={{ width: `${(program.totalValue / totalValue) * 100}%` }}
                    />
                  </div>
                  <span className="beneficiary-program-row__percentage">
                    {((program.totalValue / totalValue) * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* History Timeline */}
          <section className="portal-panel">
            <div className="portal-panel__header">
              <h2>Assistance History</h2>
            </div>
            <div className="beneficiary-history-timeline">
              {(data.history || []).map((item, idx) => (
                <div key={idx} className="beneficiary-history-item">
                  <div className="beneficiary-history-item__date">
                    <span className="beneficiary-history-item__day">
                      {new Date(item.date).getDate()}
                    </span>
                    <span className="beneficiary-history-item__month">
                      {new Date(item.date).toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                  </div>
                  <div className="beneficiary-history-item__content">
                    <strong>{item.item}</strong>
                    <span className="beneficiary-history-item__program">{item.program}</span>
                    <div className="beneficiary-history-item__meta">
                      <span>Qty: {item.quantity}</span>
                      <span>·</span>
                      <span>{item.location}</span>
                      <span>·</span>
                      <span className="beneficiary-history-item__value">{item.value}</span>
                    </div>
                  </div>
                  <div className="beneficiary-history-item__status">
                    <span className="beneficiary-status-badge beneficiary-status-badge--received">
                      {item.status}
                    </span>
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
