import { useState } from 'react'
import { CheckCircle2, AlertTriangle, Calendar as CalendarIcon, MapPin, Clock, Package, Truck } from 'lucide-react'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import { distributionsApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import ModalHeader from '../../components/admin/shared/ModalHeader'
import { notify } from '../../utils/toast'

export default function BeneficiaryDistributionsPage() {
  const { data, loading, error, reload } = useApiList(() => distributionsApi.list())
  const [modal, setModal] = useState(null) // { row, mode: 'receive' | 'missing' }
  const [selectedDist, setSelectedDist] = useState(null)
  const [qty, setQty] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState('list') // list or calendar

  const openReceive = (row) => { setModal({ row, mode: 'receive' }); setQty(row.quantity || ''); setNotes('') }
  const openMissing = (row) => { setModal({ row, mode: 'missing' }); setNotes('') }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (modal.mode === 'receive') {
        await distributionsApi.update(modal.row.dbId, {
          action: 'confirm-receipt',
          receivedQuantity: Number(qty) || 0,
          notes,
        })
        notify.success('Receipt confirmed.')
      } else {
        await distributionsApi.update(modal.row.dbId, { action: 'report-missing', notes })
        notify.success('Issue reported.')
      }
      setModal(null)
      reload()
    } catch (err) {
      notify.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const canAct = (d) => d.beneficiaryId && d.receiptStatus !== 'Received'

  const upcomingDistributions = data.filter(d => d.status === 'Scheduled')
  const completedDistributions = data.filter(d => d.status === 'Completed')

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      {/* Summary Cards */}
      <div className="beneficiary-dist-summary">
        <div className="beneficiary-dist-summary-card">
          <div className="beneficiary-dist-summary-card__icon">
            <CalendarIcon size={20} />
          </div>
          <div className="beneficiary-dist-summary-card__content">
            <span className="beneficiary-dist-summary-card__value">{upcomingDistributions.length}</span>
            <span className="beneficiary-dist-summary-card__label">Scheduled</span>
          </div>
        </div>
        <div className="beneficiary-dist-summary-card beneficiary-dist-summary-card--completed">
          <div className="beneficiary-dist-summary-card__icon">
            <CheckCircle2 size={20} />
          </div>
          <div className="beneficiary-dist-summary-card__content">
            <span className="beneficiary-dist-summary-card__value">{completedDistributions.length}</span>
            <span className="beneficiary-dist-summary-card__label">Completed</span>
          </div>
        </div>
      </div>

      <section className="portal-panel">
        <div className="portal-panel__header">
          <h2>Distribution Schedule</h2>
          <div className="portal-view-toggle">
            <button
              className={`portal-view-toggle__btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              List
            </button>
            <button
              className={`portal-view-toggle__btn ${viewMode === 'calendar' ? 'active' : ''}`}
              onClick={() => setViewMode('calendar')}
            >
              <CalendarIcon size={16} /> Calendar
            </button>
          </div>
        </div>

        <p className="portal-hint">Confirm receipt and record the quantity received, or report if a scheduled donation has not arrived.</p>

        {viewMode === 'list' ? (
          <>
            {/* Upcoming Distributions */}
            {upcomingDistributions.length > 0 && (
              <>
                <h3 className="beneficiary-section-title">Upcoming Pickups & Deliveries</h3>
                <div className="beneficiary-dist-grid">
                  {upcomingDistributions.map((d) => (
                    <div key={d.id} className="beneficiary-dist-card beneficiary-dist-card--upcoming">
                      <div className="beneficiary-dist-card__header">
                        <div className="beneficiary-dist-card__date">
                          <span className="beneficiary-dist-card__day">
                            {new Date(d.date).getDate()}
                          </span>
                          <span className="beneficiary-dist-card__month">
                            {new Date(d.date).toLocaleDateString('en-US', { month: 'short' })}
                          </span>
                        </div>
                        <div className="beneficiary-dist-card__type-badge">
                          {d.type === 'Pickup' ? <Package size={16} /> : <Truck size={16} />}
                          {d.type}
                        </div>
                      </div>
                      <div className="beneficiary-dist-card__body">
                        <strong>{d.program}</strong>
                        <span className="beneficiary-dist-card__items">{d.items} (Qty: {d.quantity})</span>
                        <span className="beneficiary-dist-card__location">
                          <MapPin size={14} /> {d.location}
                        </span>
                        <span className="beneficiary-dist-card__time">
                          <Clock size={14} /> {d.scheduleTime}
                        </span>
                      </div>
                      <div className="beneficiary-dist-card__actions">
                        <StatusBadge status={d.receiptStatus} />
                        {canAct(d) && (
                          <>
                            <button type="button" className="btn btn--sm btn--primary" onClick={() => openReceive(d)}>
                              <CheckCircle2 size={13} /> Confirm Receipt
                            </button>
                            <button type="button" className="btn btn--sm btn--outline" onClick={() => openMissing(d)}>
                              <AlertTriangle size={13} /> Report Issue
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Completed Distributions */}
            {completedDistributions.length > 0 && (
              <>
                <h3 className="beneficiary-section-title">Completed Distributions</h3>
                <div className="beneficiary-dist-list">
                  {completedDistributions.map((d) => (
                    <div key={d.id} className="beneficiary-dist-list-item">
                      <div className="beneficiary-dist-list-item__date">
                        <span>{new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                      <div className="beneficiary-dist-list-item__content">
                        <strong>{d.program}</strong>
                        <span>{d.items} - {d.location}</span>
                      </div>
                      <div className="beneficiary-dist-list-item__status">
                        <StatusBadge status={d.receiptStatus} />
                        {d.receivedQuantity && (
                          <span className="beneficiary-dist-list-item__qty">Qty: {d.receivedQuantity}</span>
                        )}
                      </div>
                      <button 
                        type="button" 
                        className="btn btn--sm btn--ghost"
                        onClick={() => setSelectedDist(d)}
                      >
                        Details
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {data.length === 0 && (
              <div className="portal-empty">
                <Package size={36} />
                <p>No distributions scheduled yet.</p>
              </div>
            )}
          </>
        ) : (
          <div className="beneficiary-calendar-view">
            <p className="portal-note">Calendar view: See all scheduled pickups and deliveries</p>
            {data.map((d) => (
              <div key={d.id} className="beneficiary-calendar-item">
                <div className="beneficiary-calendar-item__date">
                  {new Date(d.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
                <div className="beneficiary-calendar-item__content">
                  <strong>{d.program} - {d.items}</strong>
                  <span>{d.location} · {d.scheduleTime || d.type}</span>
                </div>
                <StatusBadge status={d.status} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Receive/Report Modal */}
      {modal && (
        <div className="admin-modal-overlay" onClick={() => setModal(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title={modal.mode === 'receive' ? 'Confirm Receipt' : 'Report Not Received'}
              onClose={() => setModal(null)}
            />
            <p className="portal-hint">{modal.row.location} — {modal.row.date}</p>
            <form onSubmit={submit}>
              {modal.mode === 'receive' && (
                <label>Quantity Received
                  <input type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 5" />
                </label>
              )}
              <label>{modal.mode === 'receive' ? 'Notes (optional)' : 'Describe the issue'}
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder={modal.mode === 'receive' ? 'Condition of goods, remarks...' : 'e.g. Delivery has not arrived as of today.'} />
              </label>
              <div className="admin-modal__actions">
                <button type="submit" className={`btn ${modal.mode === 'receive' ? 'btn--primary' : 'btn--danger'}`} disabled={saving}>
                  {saving ? 'Submitting...' : modal.mode === 'receive' ? 'Confirm Receipt' : 'Report Issue'}
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {selectedDist && (
        <div className="admin-modal-overlay" onClick={() => setSelectedDist(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title="Distribution Details" onClose={() => setSelectedDist(null)} />
            <div className="beneficiary-request-detail">
              <div className="beneficiary-request-detail__row">
                <label>Program:</label>
                <span>{selectedDist.program}</span>
              </div>
              <div className="beneficiary-request-detail__row">
                <label>Items:</label>
                <span>{selectedDist.items}</span>
              </div>
              <div className="beneficiary-request-detail__row">
                <label>Date:</label>
                <span>{selectedDist.date}</span>
              </div>
              <div className="beneficiary-request-detail__row">
                <label>Location:</label>
                <span>{selectedDist.location}</span>
              </div>
              <div className="beneficiary-request-detail__row">
                <label>Type:</label>
                <span>{selectedDist.type}</span>
              </div>
              <div className="beneficiary-request-detail__row">
                <label>Status:</label>
                <StatusBadge status={selectedDist.status} />
              </div>
              {selectedDist.receivedQuantity && (
                <div className="beneficiary-request-detail__row">
                  <label>Received Quantity:</label>
                  <span>{selectedDist.receivedQuantity}</span>
                </div>
              )}
            </div>
            <div className="admin-modal__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setSelectedDist(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </ApiState>
  )
}
