import { useState } from 'react'
import { Calendar, Download, TrendingUp, Package, Printer, CheckCircle2, MapPin, Layers } from 'lucide-react'
import ApiState from '../../components/admin/shared/ApiState'
import { getPortalData } from '../../api/resources'
import { useApiObject } from '../../hooks/useApiList'
import { usePagination, DEFAULT_PAGE_SIZE } from '../../hooks/usePagination'
import Pagination from '../../components/admin/shared/Pagination'
import { notify } from '../../utils/toast'

function parseDateBits(dateStr) {
  if (!dateStr) return { day: '—', month: '—', year: '—' }
  const d = new Date(dateStr)
  if (!Number.isNaN(d.getTime())) {
    return {
      day: d.getDate(),
      month: d.toLocaleDateString('en-US', { month: 'short' }),
      year: d.getFullYear(),
    }
  }
  return { day: '1', month: String(dateStr).slice(0, 3), year: '2026' }
}

export default function BeneficiaryHistoryPage() {
  const { data, loading, error, reload } = useApiObject(() => getPortalData())
  const currentYear = new Date().getFullYear()
  const [selectedYear] = useState(currentYear)

  const history = data?.history || []
  const paging = usePagination(history, DEFAULT_PAGE_SIZE, String(history.length))

  const totalValue = history.reduce((sum, h) => {
    const value = parseFloat(String(h.value || '').replace(/[₱,]/g, '')) || 0
    return sum + value
  }, 0)

  const totalItems = history.length
  const maxMonthlyValue = Math.max(...(data?.benefitsByMonth?.map((m) => m.value) || [0]), 1)

  const handlePrint = () => {
    window.print()
  }

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      {data && (
        <>
          {/* Summary Cards */}
          <div className="volunteer-kpi-grid">
            <div className="volunteer-kpi-card volunteer-kpi-card--hours">
              <div className="volunteer-kpi-card__icon">
                <TrendingUp size={20} />
              </div>
              <div>
                <div className="volunteer-kpi-card__value">₱{totalValue.toLocaleString()}</div>
                <div className="volunteer-kpi-card__label">Total Aid Value Received</div>
              </div>
            </div>

            <div className="volunteer-kpi-card volunteer-kpi-card--total">
              <div className="volunteer-kpi-card__icon">
                <Package size={20} />
              </div>
              <div>
                <div className="volunteer-kpi-card__value">{totalItems}</div>
                <div className="volunteer-kpi-card__label">Relief Turn-overs</div>
              </div>
            </div>

            <div className="volunteer-kpi-card volunteer-kpi-card--completed">
              <div className="volunteer-kpi-card__icon">
                <Calendar size={20} />
              </div>
              <div>
                <div className="volunteer-kpi-card__value">{data.benefitsByMonth?.length || 0}</div>
                <div className="volunteer-kpi-card__label">Active Service Months</div>
              </div>
            </div>

            <div className="volunteer-kpi-card volunteer-kpi-card--ongoing">
              <div className="volunteer-kpi-card__icon">
                <Layers size={20} />
              </div>
              <div>
                <div className="volunteer-kpi-card__value">{data?.profile?.families || 150}</div>
                <div className="volunteer-kpi-card__label">Beneficiary Families</div>
              </div>
            </div>
          </div>

          {/* Monthly Breakdown Chart */}
          <section className="portal-panel">
            <div className="portal-panel__header">
              <div>
                <h2>Monthly Assistance Received — {selectedYear}</h2>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                  Value of humanitarian relief and program aid delivered to your barangay.
                </p>
              </div>
              <button
                type="button"
                className="btn btn--sm btn--outline"
                onClick={handlePrint}
              >
                <Printer size={14} /> Print Summary
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
              <h2>Assistance Received by Program Category</h2>
            </div>
            <div className="beneficiary-program-breakdown">
              {(data.benefitsByProgram || []).map((program) => (
                <div key={program.program} className="beneficiary-program-row">
                  <div className="beneficiary-program-row__info">
                    <strong>{program.program}</strong>
                    <span>{program.count} distributions · ₱{program.totalValue.toLocaleString()}</span>
                  </div>
                  <div className="beneficiary-program-row__bar">
                    <div
                      className="beneficiary-program-row__fill"
                      style={{ width: `${totalValue > 0 ? (program.totalValue / totalValue) * 100 : 25}%` }}
                    />
                  </div>
                  <span className="beneficiary-program-row__percentage">
                    {totalValue > 0 ? ((program.totalValue / totalValue) * 100).toFixed(0) : '0'}%
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* History Timeline */}
          <section className="portal-panel">
            <div className="portal-panel__header">
              <div>
                <h2>Turnover & Assistance History Log</h2>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                  Verified record of aid packages and humanitarian items delivered.
                </p>
              </div>
            </div>
            <div className="beneficiary-history-timeline">
              {paging.pageItems.map((item, idx) => {
                const bits = parseDateBits(item.date)
                return (
                  <div key={`${item.date}-${item.item}-${idx}`} className="beneficiary-history-item">
                    <div className="beneficiary-history-item__date">
                      <span className="beneficiary-history-item__day">{bits.day}</span>
                      <span className="beneficiary-history-item__month">{bits.month}</span>
                    </div>
                    <div className="beneficiary-history-item__content">
                      <strong>{item.item}</strong>
                      <span className="beneficiary-history-item__program">{item.program}</span>
                      <div className="beneficiary-history-item__meta">
                        <span>📦 Qty: {item.quantity}</span>
                        <span>·</span>
                        <span>📍 {item.location}</span>
                        <span>·</span>
                        <span className="beneficiary-history-item__value">Est. {item.value}</span>
                      </div>
                    </div>
                    <div className="beneficiary-history-item__status">
                      <span className="beneficiary-status-badge beneficiary-status-badge--received">
                        <CheckCircle2 size={13} style={{ display: 'inline', marginRight: '3px' }} />
                        {item.status}
                      </span>
                    </div>
                  </div>
                )
              })}
              {paging.pageItems.length === 0 && (
                <div className="portal-empty">
                  <Package size={28} />
                  <p>No historical assistance records logged yet.</p>
                </div>
              )}
            </div>
            {paging.totalPages > 1 && (
              <Pagination
                page={paging.page}
                totalPages={paging.totalPages}
                total={paging.total}
                startIndex={paging.startIndex}
                endIndex={paging.endIndex}
                onPageChange={paging.setPage}
                className="pagination--portal"
                noun="records"
              />
            )}
          </section>
        </>
      )}
    </ApiState>
  )
}
