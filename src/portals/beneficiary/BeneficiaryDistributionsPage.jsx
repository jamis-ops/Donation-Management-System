import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CheckCircle2, AlertTriangle, Calendar as CalendarIcon, MapPin, Clock,
  Package, Truck, MessageSquare, Camera, ArrowRight,
} from 'lucide-react'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import { distributionsApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { usePagination, DEFAULT_PAGE_SIZE } from '../../hooks/usePagination'
import { useHashScroll, useQueryFocus } from '../../hooks/useDeepLinkFocus'
import ModalHeader from '../../components/admin/shared/ModalHeader'
import Pagination from '../../components/admin/shared/Pagination'
import { notify } from '../../utils/toast'

const ACTIVE_STATUSES = ['Planning', 'Preparing', 'In Transit', 'Delivered', 'Awaiting Proof']

function itemsLabel(d) {
  return d.itemsSummary || d.items || 'Relief goods'
}

function qtyLabel(d) {
  if (d.receivedQuantity != null) return d.receivedQuantity
  if (d.quantity != null) return d.quantity
  if (d.beneficiaries != null) return d.beneficiaries
  return '—'
}

/** Confirm receipt only after volunteers/staff mark the delivery Delivered. */
function canConfirm(d) {
  return Boolean(d.beneficiaryId)
    && d.status === 'Delivered'
    && d.receiptStatus !== 'Received'
}

function needsProof(d) {
  return d.receiptStatus === 'Received' && d.proofStatus !== 'Proof Verified'
}

export default function BeneficiaryDistributionsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [deepLink, setDeepLink] = useState(() => ({
    distributionId: searchParams.get('distributionId') || searchParams.get('id') || '',
    focus: searchParams.get('focus') || '',
  }))
  const focusDistId = deepLink.distributionId
  const { data, loading, error, reload } = useApiList(() => distributionsApi.list())
  const [modal, setModal] = useState(null) // { row, mode: 'receive' | 'missing' }
  const [selectedDist, setSelectedDist] = useState(null)
  const [qty, setQty] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState('list')

  const openReceive = (row) => {
    setModal({ row, mode: 'receive' })
    setQty(row.quantity || row.beneficiaries || '')
    setNotes('')
  }
  const openMissing = (row) => {
    setModal({ row, mode: 'missing' })
    setNotes(row.receiptNotes || '')
  }

  const goToProof = (row) => {
    navigate(`/beneficiary/proofs?distributionId=${row.dbId}#proof-submit-form`)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (modal.mode === 'missing' && !String(notes || '').trim()) {
      notify.warning('Please describe the issue for Admin/Staff.')
      return
    }
    setSaving(true)
    try {
      if (modal.mode === 'receive') {
        await distributionsApi.update(modal.row.dbId, {
          action: 'confirm-receipt',
          receivedQuantity: Number(qty) || 0,
          notes,
        })
        notify.success('Receipt confirmed. Continue to submit proof.')
        const distId = modal.row.dbId
        setModal(null)
        reload()
        navigate(`/beneficiary/proofs?distributionId=${distId}#proof-submit-form`)
      } else {
        await distributionsApi.update(modal.row.dbId, { action: 'report-missing', notes: notes.trim() })
        notify.success('Issue reported to Admin/Staff. They will follow up.')
        setModal(null)
        reload()
      }
    } catch (err) {
      notify.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const { upcoming, completed, actionNeeded } = useMemo(() => {
    const list = Array.isArray(data) ? data : []
    const upcomingList = list.filter((d) => ACTIVE_STATUSES.includes(d.status) || canConfirm(d) || needsProof(d))
    const completedList = list.filter((d) => d.status === 'Completed' && d.proofStatus === 'Proof Verified')
    const action = upcomingList.filter((d) => canConfirm(d) || needsProof(d))
    return { upcoming: upcomingList, completed: completedList, actionNeeded: action }
  }, [data])

  const upcomingPaging = usePagination(upcoming, DEFAULT_PAGE_SIZE, `upcoming|${viewMode}|${upcoming.length}`)
  const completedPaging = usePagination(completed, DEFAULT_PAGE_SIZE, `completed|${completed.length}`)
  const calendarList = Array.isArray(data) ? data : []
  const calendarPaging = usePagination(calendarList, DEFAULT_PAGE_SIZE, `calendar|${calendarList.length}`)

  useEffect(() => {
    const distributionId = searchParams.get('distributionId') || searchParams.get('id') || ''
    const focus = searchParams.get('focus') || ''
    if (distributionId || focus) {
      setDeepLink({ distributionId, focus })
    }
  }, [searchParams])

  const contentReady = !loading && Array.isArray(data)
  const shouldFocusSection = Boolean(focusDistId) || deepLink.focus === 'actions'
  const focusTargetId = focusDistId
    ? `dist-card-${focusDistId}`
    : 'dist-action-needed'

  useHashScroll({ enabled: contentReady, deps: [data?.length] })
  useQueryFocus(contentReady && shouldFocusSection, focusTargetId)

  useEffect(() => {
    if (!contentReady || !focusDistId) return
    const row = (data || []).find((d) => String(d.dbId) === String(focusDistId))
    if (row) setSelectedDist(row)
  }, [contentReady, focusDistId, data])

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      <div className="beneficiary-dist-summary" id="dist-summary">
        <div className="beneficiary-dist-summary-card">
          <div className="beneficiary-dist-summary-card__icon">
            <CalendarIcon size={20} />
          </div>
          <div className="beneficiary-dist-summary-card__content">
            <span className="beneficiary-dist-summary-card__value">{upcoming.length}</span>
            <span className="beneficiary-dist-summary-card__label">Active Deliveries</span>
          </div>
        </div>
        <div className="beneficiary-dist-summary-card beneficiary-dist-summary-card--action">
          <div className="beneficiary-dist-summary-card__icon">
            <MessageSquare size={20} />
          </div>
          <div className="beneficiary-dist-summary-card__content">
            <span className="beneficiary-dist-summary-card__value">{actionNeeded.length}</span>
            <span className="beneficiary-dist-summary-card__label">Needs your action</span>
          </div>
        </div>
        <div className="beneficiary-dist-summary-card beneficiary-dist-summary-card--completed">
          <div className="beneficiary-dist-summary-card__icon">
            <CheckCircle2 size={20} />
          </div>
          <div className="beneficiary-dist-summary-card__content">
            <span className="beneficiary-dist-summary-card__value">{completed.length}</span>
            <span className="beneficiary-dist-summary-card__label">Completed</span>
          </div>
        </div>
      </div>

      <section className="portal-panel" id="dist-schedule">
        <div className="portal-panel__header">
          <h2>Distribution Schedule</h2>
          <div className="portal-view-toggle">
            <button
              type="button"
              className={`portal-view-toggle__btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              List
            </button>
            <button
              type="button"
              className={`portal-view-toggle__btn ${viewMode === 'calendar' ? 'active' : ''}`}
              onClick={() => setViewMode('calendar')}
            >
              <CalendarIcon size={16} /> Calendar
            </button>
          </div>
        </div>

        <div className="beneficiary-dist-steps">
          <div className="beneficiary-dist-steps__item">
            <span>1</span>
            <p>Wait for delivery / pickup</p>
          </div>
          <div className="beneficiary-dist-steps__item">
            <span>2</span>
            <p>Confirm received or report an issue</p>
          </div>
          <div className="beneficiary-dist-steps__item">
            <span>3</span>
            <p>Submit photos &amp; acknowledgment proof</p>
          </div>
        </div>

        <p className="portal-hint">
          If donations have arrived, click <strong>Confirm Received</strong> to continue to Submit Proof.
          If they have not arrived, message Admin/Staff with <strong>Report Issue</strong>.
        </p>

        {viewMode === 'list' ? (
          <>
            {upcoming.length > 0 && (
              <>
                <h3 className="beneficiary-section-title" id="dist-action-needed">Active Distributions</h3>
                <div className="beneficiary-dist-grid">
                  {upcomingPaging.pageItems.map((d) => (
                    <div
                      key={d.id || d.dbId}
                      id={d.dbId ? `dist-card-${d.dbId}` : undefined}
                      className={`beneficiary-dist-card beneficiary-dist-card--upcoming${canConfirm(d) || needsProof(d) ? ' beneficiary-dist-card--action' : ''}${String(d.dbId) === String(focusDistId) ? ' deep-link-focus' : ''}`}
                    >
                      <div className="beneficiary-dist-card__header">
                        <div className="beneficiary-dist-card__date">
                          <span className="beneficiary-dist-card__day">
                            {d.date ? new Date(d.date).getDate() : '—'}
                          </span>
                          <span className="beneficiary-dist-card__month">
                            {d.date
                              ? new Date(d.date).toLocaleDateString('en-US', { month: 'short' })
                              : 'TBD'}
                          </span>
                        </div>
                        <div className="beneficiary-dist-card__type-badge">
                          {d.type === 'Pickup' ? <Package size={16} /> : <Truck size={16} />}
                          {d.type || 'Delivery'}
                        </div>
                      </div>
                      <div className="beneficiary-dist-card__body">
                        <strong>{d.program || d.eventName || d.id}</strong>
                        <span className="beneficiary-dist-card__items">
                          {itemsLabel(d)} {qtyLabel(d) !== '—' ? `(Qty: ${qtyLabel(d)})` : ''}
                        </span>
                        <span className="beneficiary-dist-card__location">
                          <MapPin size={14} /> {d.location || '—'}
                        </span>
                        <span className="beneficiary-dist-card__time">
                          <Clock size={14} /> {d.scheduleTime || 'Schedule TBD'}
                        </span>
                        <div className="beneficiary-dist-card__badges">
                          <StatusBadge status={d.status} />
                          <StatusBadge status={d.receiptStatus} />
                          {d.proofStatus && d.proofStatus !== 'Not Required' && (
                            <StatusBadge status={d.proofStatus} />
                          )}
                        </div>
                        {d.receiptStatus === 'Not Received' && d.receiptNotes && (
                          <p className="beneficiary-dist-card__issue">
                            <AlertTriangle size={13} /> Reported: {d.receiptNotes}
                          </p>
                        )}
                      </div>
                      <div className="beneficiary-dist-card__actions">
                        {canConfirm(d) && (
                          <>
                            <button type="button" className="btn btn--sm btn--primary" onClick={() => openReceive(d)}>
                              <CheckCircle2 size={13} /> Confirm Received
                            </button>
                            <button type="button" className="btn btn--sm btn--outline" onClick={() => openMissing(d)}>
                              <MessageSquare size={13} /> Report Issue
                            </button>
                          </>
                        )}
                        {needsProof(d) && (
                          <button type="button" className="btn btn--sm btn--primary" onClick={() => goToProof(d)}>
                            <Camera size={13} /> Submit Proof <ArrowRight size={13} />
                          </button>
                        )}
                        <button type="button" className="btn btn--sm btn--ghost" onClick={() => setSelectedDist(d)}>
                          Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <Pagination
                  page={upcomingPaging.page}
                  totalPages={upcomingPaging.totalPages}
                  total={upcomingPaging.total}
                  startIndex={upcomingPaging.startIndex}
                  endIndex={upcomingPaging.endIndex}
                  onPageChange={upcomingPaging.setPage}
                  className="pagination--portal"
                  noun="distributions"
                />
              </>
            )}

            {completed.length > 0 && (
              <>
                <h3 className="beneficiary-section-title">Completed Distributions</h3>
                <div className="beneficiary-dist-list">
                  {completedPaging.pageItems.map((d) => (
                    <div key={d.id || d.dbId} className="beneficiary-dist-list-item">
                      <div className="beneficiary-dist-list-item__date">
                        <span>
                          {d.date
                            ? new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : '—'}
                        </span>
                      </div>
                      <div className="beneficiary-dist-list-item__content">
                        <strong>{d.program || d.eventName || d.id}</strong>
                        <span>{itemsLabel(d)} — {d.location || '—'}</span>
                      </div>
                      <div className="beneficiary-dist-list-item__status">
                        <StatusBadge status={d.receiptStatus || d.status} />
                        {d.receivedQuantity != null && (
                          <span className="beneficiary-dist-list-item__qty">Qty: {d.receivedQuantity}</span>
                        )}
                      </div>
                      <button type="button" className="btn btn--sm btn--ghost" onClick={() => setSelectedDist(d)}>
                        Details
                      </button>
                    </div>
                  ))}
                </div>
                <Pagination
                  page={completedPaging.page}
                  totalPages={completedPaging.totalPages}
                  total={completedPaging.total}
                  startIndex={completedPaging.startIndex}
                  endIndex={completedPaging.endIndex}
                  onPageChange={completedPaging.setPage}
                  className="pagination--portal"
                  noun="distributions"
                />
              </>
            )}

            {(data || []).length === 0 && (
              <div className="portal-empty">
                <Package size={36} />
                <p>No distributions scheduled yet.</p>
              </div>
            )}
          </>
        ) : (
          <div className="beneficiary-calendar-view">
            <p className="portal-note">Calendar view: scheduled pickups and deliveries</p>
            {calendarPaging.pageItems.map((d) => (
              <div key={d.id || d.dbId} className="beneficiary-calendar-item">
                <div className="beneficiary-calendar-item__date">
                  {d.date
                    ? new Date(d.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                    : 'TBD'}
                </div>
                <div className="beneficiary-calendar-item__content">
                  <strong>{d.program || d.eventName} — {itemsLabel(d)}</strong>
                  <span>{d.location} · {d.scheduleTime || d.type}</span>
                </div>
                <StatusBadge status={d.status} />
              </div>
            ))}
            <Pagination
              page={calendarPaging.page}
              totalPages={calendarPaging.totalPages}
              total={calendarPaging.total}
              startIndex={calendarPaging.startIndex}
              endIndex={calendarPaging.endIndex}
              onPageChange={calendarPaging.setPage}
              className="pagination--portal"
              noun="distributions"
            />
          </div>
        )}
      </section>

      {modal && (
        <div className="admin-modal-overlay" onClick={() => setModal(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title={modal.mode === 'receive' ? 'Confirm Received' : 'Report Issue to Admin/Staff'}
              onClose={() => setModal(null)}
            />
            <p className="portal-hint">
              {modal.row.location || 'Distribution'} — {modal.row.date || 'schedule TBD'}
            </p>
            <form onSubmit={submit}>
              {modal.mode === 'receive' ? (
                <>
                  <p className="portal-note">
                    Confirm that your barangay received the donations. You will then upload proof photos and documents.
                  </p>
                  <label>
                    Quantity Received
                    <input
                      type="number"
                      min="0"
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      placeholder="e.g. 5"
                    />
                  </label>
                  <label>
                    Remarks <span className="req-optional">(optional)</span>
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Condition of goods, remarks…"
                    />
                  </label>
                </>
              ) : (
                <>
                  <p className="portal-note">
                    Tell Admin/Staff why the donation has not been received yet. They will get a notification with your message.
                  </p>
                  <label>
                    Message to Admin/Staff <span className="proof-required">*</span>
                    <textarea
                      rows={4}
                      required
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Delivery has not arrived as of today. Driver unreachable…"
                    />
                  </label>
                </>
              )}
              <div className="admin-modal__actions">
                <button
                  type="submit"
                  className={`btn ${modal.mode === 'receive' ? 'btn--primary' : 'btn--danger'}`}
                  disabled={saving}
                >
                  {saving
                    ? 'Submitting…'
                    : modal.mode === 'receive'
                      ? 'Confirm & Continue to Proof'
                      : 'Send Report'}
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedDist && (
        <div className="admin-modal-overlay" onClick={() => setSelectedDist(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title="Distribution Details" onClose={() => setSelectedDist(null)} />
            <div className="beneficiary-request-detail">
              <div className="beneficiary-request-detail__row">
                <label>Program:</label>
                <span>{selectedDist.program || selectedDist.eventName || '—'}</span>
              </div>
              <div className="beneficiary-request-detail__row">
                <label>Items:</label>
                <span>{itemsLabel(selectedDist)}</span>
              </div>
              <div className="beneficiary-request-detail__row">
                <label>Date:</label>
                <span>{selectedDist.date || '—'}</span>
              </div>
              <div className="beneficiary-request-detail__row">
                <label>Location:</label>
                <span>{selectedDist.location || '—'}</span>
              </div>
              <div className="beneficiary-request-detail__row">
                <label>Type:</label>
                <span>{selectedDist.type || '—'}</span>
              </div>
              <div className="beneficiary-request-detail__row">
                <label>Status:</label>
                <StatusBadge status={selectedDist.status} />
              </div>
              <div className="beneficiary-request-detail__row">
                <label>Receipt:</label>
                <StatusBadge status={selectedDist.receiptStatus} />
              </div>
              {selectedDist.receiptNotes && (
                <div className="beneficiary-request-detail__row">
                  <label>Message / notes:</label>
                  <span>{selectedDist.receiptNotes}</span>
                </div>
              )}
              {selectedDist.receivedQuantity != null && (
                <div className="beneficiary-request-detail__row">
                  <label>Received Quantity:</label>
                  <span>{selectedDist.receivedQuantity}</span>
                </div>
              )}
            </div>
            <div className="admin-modal__actions">
              {needsProof(selectedDist) && (
                <button type="button" className="btn btn--primary" onClick={() => { setSelectedDist(null); goToProof(selectedDist) }}>
                  <Camera size={14} /> Submit Proof
                </button>
              )}
              {canConfirm(selectedDist) && (
                <button type="button" className="btn btn--primary" onClick={() => { setSelectedDist(null); openReceive(selectedDist) }}>
                  Confirm Received
                </button>
              )}
              <button type="button" className="btn btn--ghost" onClick={() => setSelectedDist(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </ApiState>
  )
}
