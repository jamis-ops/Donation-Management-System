import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CheckCircle2, AlertTriangle, Calendar as CalendarIcon, MapPin, Clock,
  Package, Truck, MessageSquare, Camera, ArrowRight, Check, Users,
} from 'lucide-react'
import StatusBadge from '../../admin/components/shared/StatusBadge'
import ApiState from '../../admin/components/shared/ApiState'
import { distributionsApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { usePagination, DEFAULT_PAGE_SIZE } from '../../hooks/usePagination'
import { useHashScroll, useQueryFocus } from '../../hooks/useDeepLinkFocus'
import ModalHeader from '../../admin/components/shared/ModalHeader'
import Pagination from '../../admin/components/shared/Pagination'
import { notify } from '../../utils/toast'
import { useLoading } from '../../context/LoadingContext'

const ACTIVE_STATUSES = ['Planning', 'Preparing', 'In Transit', 'Delivered', 'Awaiting Proof']

const DISTRIBUTION_STAGES = [
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'transit', label: 'In Transit' },
  { key: 'received', label: 'Received' },
  { key: 'completed', label: 'Completed' },
]

function getDistributionStage(d) {
  if (!d) return 0
  const status = String(d.status || '').toLowerCase()
  const receipt = String(d.receiptStatus || '').toLowerCase()
  const proof = String(d.proofStatus || '').toLowerCase()

  if (status === 'completed' || (proof === 'proof verified' && receipt === 'received')) {
    return 3
  }
  if (receipt === 'received' || proof === 'proof submitted' || proof === 'awaiting proof' || status === 'awaiting proof') {
    return 2
  }
  if (status === 'in transit' || status === 'delivered' || status === 'ready for dispatch' || status === 'dispatched') {
    return 1
  }
  return 0
}

function getDistributionHeading(d) {
  const stage = getDistributionStage(d)
  const dateStr = d.date || 'TBD'
  const timeStr = d.scheduleTime ? ` at ${d.scheduleTime}` : ''

  if (stage === 3) {
    return {
      title: 'Your relief assistance has been successfully completed',
      dateLabel: `Completed on ${dateStr}`,
    }
  }
  if (stage === 2) {
    if (d.proofStatus === 'Proof Submitted') {
      return {
        title: 'Turnover proof submitted — under admin review',
        dateLabel: `Proof submitted on ${d.receivedAt || dateStr}`,
      }
    }
    return {
      title: 'Donation received — please submit turnover proof photos',
      dateLabel: `Received on ${d.receivedAt || dateStr}`,
    }
  }
  if (stage === 1) {
    if (d.status === 'Delivered') {
      return {
        title: 'Your donation has arrived — please confirm receipt',
        dateLabel: `Arrived on ${dateStr}${timeStr}`,
      }
    }
    return {
      title: 'Your donation is currently in transit',
      dateLabel: `Dispatched · Expected delivery on ${dateStr}${timeStr}`,
    }
  }
  return {
    title: 'Your relief distribution is currently scheduled',
    dateLabel: `Scheduled for ${dateStr}${timeStr}`,
  }
}

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

function formatDisplayDate(dateStr, options = { month: 'short', day: 'numeric' }, fallback = '—') {
  if (!dateStr || dateStr === '—' || dateStr === 'TBD' || dateStr === 'Invalid Date') return fallback
  const cleanStr = String(dateStr).trim()
  const match = cleanStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (match) {
    const d = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10))
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', options)
    }
  }
  const d = new Date(cleanStr.includes('T') ? cleanStr : cleanStr.replace(/-/g, '/'))
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString('en-US', options)
  }
  return fallback
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
  const { showLoading, hideLoading } = useLoading()
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
    showLoading('Saving…')
    try {
      if (modal.mode === 'receive') {
        await distributionsApi.update(modal.row.dbId, {
          action: 'confirm-receipt',
          receivedQuantity: Number(qty) || 0,
          notes,
        })
        notify.success('Status successfully updated to: Received. Continue to submit proof.')
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
      hideLoading()
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
      <div className="volunteer-kpi-grid" id="dist-summary">
        <div className="volunteer-kpi-card volunteer-kpi-card--total">
          <div className="volunteer-kpi-card__icon">
            <Truck size={20} />
          </div>
          <div>
            <div className="volunteer-kpi-card__value">{upcoming.length}</div>
            <div className="volunteer-kpi-card__label">Active Deliveries</div>
          </div>
        </div>

        <div className="volunteer-kpi-card volunteer-kpi-card--ongoing">
          <div className="volunteer-kpi-card__icon">
            <AlertTriangle size={20} />
          </div>
          <div>
            <div className="volunteer-kpi-card__value">{actionNeeded.length}</div>
            <div className="volunteer-kpi-card__label">Action Required</div>
          </div>
        </div>

        <div className="volunteer-kpi-card volunteer-kpi-card--completed">
          <div className="volunteer-kpi-card__icon">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div className="volunteer-kpi-card__value">{completed.length}</div>
            <div className="volunteer-kpi-card__label">Completed Deliveries</div>
          </div>
        </div>

        <div className="volunteer-kpi-card volunteer-kpi-card--hours">
          <div className="volunteer-kpi-card__icon">
            <CalendarIcon size={20} />
          </div>
          <div>
            <div className="volunteer-kpi-card__value">{(data || []).length}</div>
            <div className="volunteer-kpi-card__label">Total Scheduled</div>
          </div>
        </div>
      </div>

      <section className="portal-panel" id="dist-schedule">
        <div className="portal-panel__header">
          <h2>Distribution Schedule &amp; Tracking</h2>
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

        {viewMode === 'list' ? (
          <>
            {upcoming.length > 0 && (
              <>
                <h3 className="beneficiary-section-title" id="dist-action-needed">Active Deliveries &amp; Progress</h3>
                <div className="beneficiary-dist-trackers">
                  {upcomingPaging.pageItems.map((d) => {
                    const currentStage = getDistributionStage(d)
                    const heading = getDistributionHeading(d)

                    return (
                      <div
                        key={d.id || d.dbId}
                        id={d.dbId ? `dist-card-${d.dbId}` : undefined}
                        className={`dist-tracker-card${canConfirm(d) || needsProof(d) ? ' dist-tracker-card--action' : ''}${String(d.dbId) === String(focusDistId) ? ' deep-link-focus' : ''}`}
                      >
                        <div className="dist-tracker-header">
                          <div className="dist-tracker-title-group">
                            <div className="dist-tracker-badge-row">
                              <span className="dist-tracker-code">{d.id || d.distributionCode}</span>
                              <span className="dist-tracker-type-pill">
                                {d.type === 'Pickup' ? <Package size={13} /> : <Truck size={13} />} {d.type || 'Delivery'}
                              </span>
                              <StatusBadge status={d.status} />
                              {d.receiptStatus && d.receiptStatus !== 'Awaiting Confirmation' && (
                                <StatusBadge status={d.receiptStatus} />
                              )}
                              {d.proofStatus && d.proofStatus !== 'Not Required' && (
                                <StatusBadge status={d.proofStatus} />
                              )}
                            </div>
                            <h3 className="dist-tracker-headline">{heading.title}</h3>
                            <p className="dist-tracker-meta">
                              <span>📅 {heading.dateLabel}</span>
                              <span>•</span>
                              <span>📍 {d.location || 'Barangay Hall'}</span>
                              <span>•</span>
                              <span>📦 {itemsLabel(d)} {qtyLabel(d) !== '—' ? `(Qty: ${qtyLabel(d)})` : ''}</span>
                            </p>
                          </div>
                          <div className="dist-tracker-actions">
                            {canConfirm(d) && (
                              <button type="button" className="btn btn--sm btn--primary" onClick={() => openReceive(d)}>
                                <CheckCircle2 size={13} /> Confirm Received
                              </button>
                            )}
                            {canConfirm(d) && (
                              <button type="button" className="btn btn--sm btn--outline" onClick={() => openMissing(d)}>
                                <MessageSquare size={13} /> Report Issue
                              </button>
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

                        {/* Horizontal Progress Timeline Tracker */}
                        <div className="dist-timeline-tracker">
                          {DISTRIBUTION_STAGES.map((stage, idx) => {
                            const isCompleted = idx < currentStage
                            const isCurrent = idx === currentStage
                            const isUpcoming = idx > currentStage

                            return (
                              <div
                                key={stage.key}
                                className={`dist-timeline-step dist-timeline-step--${isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming'}`}
                              >
                                <div className="dist-timeline-node-container">
                                  {idx > 0 && (
                                    <div className={`dist-timeline-connector ${idx <= currentStage ? 'dist-timeline-connector--filled' : ''}`} />
                                  )}
                                  <div className="dist-timeline-node">
                                    {isCompleted ? (
                                      <Check size={14} strokeWidth={3} />
                                    ) : isCurrent ? (
                                      <span className="dist-timeline-pulse-dot" />
                                    ) : (
                                      <span>{idx + 1}</span>
                                    )}
                                  </div>
                                  {idx < DISTRIBUTION_STAGES.length - 1 && (
                                    <div className={`dist-timeline-connector ${idx < currentStage ? 'dist-timeline-connector--filled' : ''}`} />
                                  )}
                                </div>
                                <div className="dist-timeline-label-group">
                                  <span className="dist-timeline-label">{stage.label}</span>
                                  <span className="dist-timeline-sublabel">
                                    {isCompleted ? 'Done' : isCurrent ? 'Current' : 'Upcoming'}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
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
                          {formatDisplayDate(d.date, { month: 'short', day: 'numeric' }, '—')}
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
                <p>No distribution yet.</p>
              </div>
            )}
          </>
        ) : (
          <div className="beneficiary-calendar-view">
            <p className="portal-note">Calendar view: scheduled pickups and deliveries</p>
            {calendarList.length === 0 ? (
              <div className="portal-empty">
                <Package size={36} />
                <p>No distribution yet.</p>
              </div>
            ) : (
              <>
                {calendarPaging.pageItems.map((d) => (
                  <div key={d.id || d.dbId} className="beneficiary-calendar-item">
                    <div className="beneficiary-calendar-item__date">
                      {formatDisplayDate(d.date, { weekday: 'short', month: 'short', day: 'numeric' }, 'TBD')}
                    </div>
                    <div className="beneficiary-calendar-item__content">
                      <strong>{d.program || d.eventName} — {itemsLabel(d)}</strong>
                      <span>{d.location} · {d.scheduleTime || d.type}</span>
                    </div>
                    <StatusBadge status={d.status} />
                  </div>
                ))}
                {calendarPaging.totalPages > 1 && (
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
                )}
              </>
            )}
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
                  {modal.mode === 'receive'
                    ? 'Confirm & Continue to Proof'
                    : 'Send Report'}
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedDist && (() => {
        const currentStage = getDistributionStage(selectedDist)
        const heading = getDistributionHeading(selectedDist)
        const distCode = selectedDist.distributionCode || selectedDist.code || (selectedDist.id ? `DST-${selectedDist.id}` : 'DST-—')
        const programTitle = selectedDist.program || selectedDist.eventName || heading.title || 'Relief Distribution'
        const isPickup = selectedDist.type === 'Pickup'

        return (
          <div className="admin-modal-overlay" onClick={() => setSelectedDist(null)}>
            <div className="admin-modal admin-modal--wide beneficiary-request-modal" onClick={(e) => e.stopPropagation()}>
              <ModalHeader title={`Distribution Details · ${distCode}`} onClose={() => setSelectedDist(null)} />
              
              <div className="beneficiary-request-modal__body" style={{ padding: '1.25rem' }}>
                {/* Hero Header Strip */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem 1.25rem',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  marginBottom: '1.25rem',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '10px',
                      background: isPickup ? '#ecfdf5' : '#eff6ff',
                      color: isPickup ? '#059669' : '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `1px solid ${isPickup ? '#a7f3d0' : '#bfdbfe'}`,
                      flexShrink: 0,
                    }}>
                      {isPickup ? <Package size={22} /> : <Truck size={22} />}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                        {programTitle}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#AF101A', fontSize: '0.82rem' }}>
                          {distCode}
                        </span>
                        <span className="dist-tracker-type-pill" style={{ margin: 0 }}>
                          {isPickup ? <Package size={12} /> : <Truck size={12} />} {selectedDist.type || 'Delivery'}
                        </span>
                        <StatusBadge status={selectedDist.status} />
                        {selectedDist.receiptStatus && selectedDist.receiptStatus !== 'Awaiting Confirmation' && (
                          <StatusBadge status={selectedDist.receiptStatus} />
                        )}
                        {selectedDist.proofStatus && selectedDist.proofStatus !== 'Not Required' && (
                          <StatusBadge status={selectedDist.proofStatus} />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info Grid (4 Structured Cards) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '0.85rem',
                  marginBottom: '1.25rem',
                }}>
                  <div style={{ padding: '0.85rem 1rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem', letterSpacing: '0.04em' }}>
                      <CalendarIcon size={13} style={{ color: '#AF101A' }} /> Schedule Date &amp; Time
                    </span>
                    <strong style={{ fontSize: '0.9rem', color: '#0f172a', display: 'block', marginTop: '0.3rem' }}>
                      {formatDisplayDate(selectedDist.date, { month: 'short', day: 'numeric', year: 'numeric' }, selectedDist.date || 'To be scheduled')}
                    </strong>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      {selectedDist.scheduleTime || selectedDist.time || 'Standard Delivery Hours (9:00 AM - 5:00 PM)'}
                    </span>
                  </div>

                  <div style={{ padding: '0.85rem 1rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem', letterSpacing: '0.04em' }}>
                      <MapPin size={13} style={{ color: '#AF101A' }} /> Destination Location
                    </span>
                    <strong style={{ fontSize: '0.9rem', color: '#0f172a', display: 'block', marginTop: '0.3rem' }}>
                      {selectedDist.location || 'Barangay Hall'}
                    </strong>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      Designated drop-off point
                    </span>
                  </div>

                  <div style={{ padding: '0.85rem 1rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem', letterSpacing: '0.04em' }}>
                      <Package size={13} style={{ color: '#AF101A' }} /> Quantity &amp; Beneficiaries
                    </span>
                    <strong style={{ fontSize: '0.9rem', color: '#0f172a', display: 'block', marginTop: '0.3rem' }}>
                      {qtyLabel(selectedDist) !== '—' ? `${qtyLabel(selectedDist)} packs` : (selectedDist.quantity || selectedDist.beneficiaries ? `${selectedDist.quantity || selectedDist.beneficiaries} beneficiaries` : 'Batch Allocation')}
                    </strong>
                    {selectedDist.receivedQuantity != null && (
                      <span style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 600 }}>
                        Confirmed Received: {selectedDist.receivedQuantity}
                      </span>
                    )}
                  </div>

                  <div style={{ padding: '0.85rem 1rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem', letterSpacing: '0.04em' }}>
                      <Truck size={13} style={{ color: '#AF101A' }} /> Fulfillment Type
                    </span>
                    <strong style={{ fontSize: '0.9rem', color: '#0f172a', display: 'block', marginTop: '0.3rem' }}>
                      {selectedDist.type || 'Relief Goods Delivery'}
                    </strong>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      Coordinator: {selectedDist.coordinator || 'Operations Team'}
                    </span>
                  </div>
                </div>

                {/* Items Summary Card */}
                <div style={{ padding: '1rem 1.15rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', marginBottom: '1.25rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.45rem', letterSpacing: '0.04em' }}>
                    <Package size={14} style={{ color: '#AF101A' }} /> Relief Goods &amp; Package Contents
                  </span>
                  <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#1e293b' }}>
                    {itemsLabel(selectedDist)}
                  </div>
                </div>

                {/* Lifecycle Progress Timeline Tracker */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.25rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '0.75rem', letterSpacing: '0.04em' }}>
                    Delivery Lifecycle Status
                  </span>
                  <div className="dist-timeline-tracker" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
                    {DISTRIBUTION_STAGES.map((stage, idx) => {
                      const isCompleted = idx < currentStage
                      const isCurrent = idx === currentStage

                      return (
                        <div
                          key={stage.key}
                          className={`dist-timeline-step dist-timeline-step--${isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming'}`}
                        >
                          <div className="dist-timeline-node-container">
                            {idx > 0 && (
                              <div className={`dist-timeline-connector ${idx <= currentStage ? 'dist-timeline-connector--filled' : ''}`} />
                            )}
                            <div className="dist-timeline-node">
                              {isCompleted ? (
                                <Check size={14} strokeWidth={3} />
                              ) : isCurrent ? (
                                <span className="dist-timeline-pulse-dot" />
                              ) : (
                                <span>{idx + 1}</span>
                              )}
                            </div>
                            {idx < DISTRIBUTION_STAGES.length - 1 && (
                              <div className={`dist-timeline-connector ${idx < currentStage ? 'dist-timeline-connector--filled' : ''}`} />
                            )}
                          </div>
                          <div className="dist-timeline-label-group">
                            <span className="dist-timeline-label">{stage.label}</span>
                            <span className="dist-timeline-sublabel">
                              {isCompleted ? 'Done' : isCurrent ? 'Current' : 'Upcoming'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Remarks / Message Notes Block if any */}
                {(selectedDist.receiptNotes || selectedDist.notes) && (
                  <div style={{ padding: '1rem 1.15rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', marginBottom: '1.25rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#92400e', display: 'block', marginBottom: '0.35rem', letterSpacing: '0.04em' }}>
                      Turnover Remarks &amp; Feedback Notes
                    </span>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#78350f', lineHeight: 1.55 }}>
                      {selectedDist.receiptNotes || selectedDist.notes}
                    </p>
                  </div>
                )}

                {/* Actions Footer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.65rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem' }}>
                  {canConfirm(selectedDist) && (
                    <button type="button" className="btn btn--primary" onClick={() => { const d = selectedDist; setSelectedDist(null); openReceive(d) }}>
                      <CheckCircle2 size={14} /> Confirm Received
                    </button>
                  )}
                  {canConfirm(selectedDist) && (
                    <button type="button" className="btn btn--outline" onClick={() => { const d = selectedDist; setSelectedDist(null); openMissing(d) }}>
                      <MessageSquare size={14} /> Report Issue
                    </button>
                  )}
                  {needsProof(selectedDist) && (
                    <button type="button" className="btn btn--primary" onClick={() => { const d = selectedDist; setSelectedDist(null); goToProof(d) }}>
                      <Camera size={14} /> Submit Proof <ArrowRight size={14} />
                    </button>
                  )}
                  <button type="button" className="btn btn--ghost" onClick={() => setSelectedDist(null)}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </ApiState>
  )
}
