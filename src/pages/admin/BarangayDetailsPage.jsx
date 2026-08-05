import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Pencil, Mail, Trash2, FileText, Truck, Package,
  User, Calendar, Check, Eye, X, Shield, Plus, Upload, CheckCircle2, XCircle,
} from 'lucide-react'
import {
  beneficiariesApi,
  assistanceRequestsApi,
  distributionsApi,
  allocationsApi,
} from '../../api/resources'
import { BARANGAY_TYPES as FALLBACK_BARANGAY_TYPES } from '../../constants/options'
import { useCatalogOptions } from '../../hooks/useCatalogOptions'
import { CatalogFieldLabel } from '../../components/admin/shared/CatalogQuickAdd'
import { NEEDS as FALLBACK_NEEDS } from '../../constants/options'
import { useApiList } from '../../hooks/useApiList'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import ModalHeader from '../../components/admin/shared/ModalHeader'
import Req from '../../components/shared/Req'
import NeedsPicker from '../../components/shared/NeedsPicker'
import { usePagination, DEFAULT_PAGE_SIZE } from '../../hooks/usePagination'
import Pagination from '../../components/admin/shared/Pagination'
import { notifyBeneficiariesChanged } from '../../utils/beneficiariesSync'
import { canInviteBarangay, isAwaitingBarangayApproval } from '../../utils/barangayInvite'
import { notify, suppressNotificationToast } from '../../utils/toast'
import { useHashScroll, useQueryFocus } from '../../hooks/useDeepLinkFocus'
import PhoneInput from '../../components/shared/PhoneInput'
import { phoneError } from '../../utils/validation'

function normalizeNeeds(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((n) => n.trim()).filter(Boolean)
  }
  return []
}

const TABS = ['Overview', 'Relief Requests', 'Distributions', 'Tracker', 'Documents']
const CLOSED_STATUSES = ['Completed', 'Done', 'Rejected', 'Cancelled']

function derivePriority(requests) {
  let highest = null
  let rank = 0
  const order = { Critical: 4, High: 3, Medium: 2, Low: 1 }
  requests.forEach((r) => {
    if (CLOSED_STATUSES.includes(r.status)) return
    const next = order[r.priority] || 0
    if (next > rank) {
      rank = next
      highest = r.priority
    }
  })
  return highest
}

export default function BarangayDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: beneficiaries, loading: benLoading, reload: reloadBen } = useApiList(() => beneficiariesApi.list())
  const beneficiary = useMemo(
    () => beneficiaries.find((b) => Number(b.dbId) === Number(id) || String(b.id) === String(id)),
    [beneficiaries, id],
  )

  const { data: assistanceRequests, loading: reqLoading } = useApiList(() => assistanceRequestsApi.list())
  const requests = useMemo(() => {
    if (!beneficiary) return []
    return assistanceRequests.filter((r) => Number(r.beneficiaryId) === Number(beneficiary.dbId))
  }, [assistanceRequests, beneficiary])

  const { data: distributions, loading: distLoading } = useApiList(() => distributionsApi.list())
  const bDistributions = useMemo(() => {
    if (!beneficiary) return []
    return distributions.filter((d) => Number(d.beneficiaryId) === Number(beneficiary.dbId))
  }, [distributions, beneficiary])

  const { data: allocations, loading: allocLoading } = useApiList(() => allocationsApi.list())
  const bAllocations = useMemo(() => {
    if (!beneficiary) return []
    return allocations.filter((a) => Number(a.beneficiaryId) === Number(beneficiary.dbId))
  }, [allocations, beneficiary])

  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = (searchParams.get('tab') || '').toLowerCase().replace(/\s+/g, '-')
  const [activeTab, setActiveTab] = useState(tabFromUrl || 'overview')
  const [reqFilter, setReqFilter] = useState('All')
  const tabKey = (tab) => tab.toLowerCase().replace(/\s+/g, '-')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isReqModalOpen, setIsReqModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [approveConfirm, setApproveConfirm] = useState(false)
  const [rejectConfirm, setRejectConfirm] = useState(false)
  const [editForm, setEditForm] = useState({})
  const { options: barangayTypeOptions, applyList: applyBarangayTypes } = useCatalogOptions(
    'barangay_types',
    FALLBACK_BARANGAY_TYPES,
  )
  const { options: needOptions, applyList: applyNeeds } = useCatalogOptions('needs', FALLBACK_NEEDS)

  useEffect(() => {
    if (!beneficiary) return
    setEditForm({
      barangay: beneficiary.barangay || beneficiary.name || '',
      municipality: beneficiary.municipality || '',
      barangayType: beneficiary.barangayType || '',
      address: beneficiary.address || '',
      affectedFamilies: beneficiary.affectedFamilies || 0,
      needs: normalizeNeeds(beneficiary.needs),
      representativeName: beneficiary.representativeName || '',
      representativePosition: beneficiary.representativePosition || '',
      representativePhone: beneficiary.representativePhone || '',
      representativeEmail: beneficiary.representativeEmail || '',
      notes: beneficiary.notes || '',
      status: beneficiary.status || 'Pending Approval',
    })
  }, [beneficiary])

  useEffect(() => {
    if (tabFromUrl) {
      const allowed = TABS.map(tabKey)
      if (allowed.includes(tabFromUrl)) setActiveTab(tabFromUrl)
    } else if (beneficiary && isAwaitingBarangayApproval(beneficiary)) {
      setActiveTab('overview')
    }
  }, [beneficiary, tabFromUrl])

  const pageReady = Boolean(beneficiary) && !benLoading
  const focusReview = searchParams.get('focus') === 'review'
    || (!tabFromUrl && Boolean(beneficiary && isAwaitingBarangayApproval(beneficiary)))
  useHashScroll({ enabled: pageReady })
  useQueryFocus(pageReady && focusReview && activeTab === 'overview', 'barangay-overview-review')

  const selectTab = (key) => {
    setActiveTab(key)
    const next = new URLSearchParams(searchParams)
    next.set('tab', key)
    if (key !== 'overview') next.delete('focus')
    setSearchParams(next, { replace: true })
  }

  const loading = benLoading || reqLoading || distLoading || allocLoading

  const filteredRequests = reqFilter === 'All'
    ? requests
    : requests.filter((r) => {
      if (reqFilter === 'Pending') {
        return ['Pending', 'Pending Verification', 'Pending Review', 'Under Review'].includes(r.status)
      }
      return r.status === reqFilter
    })

  const requestsPaging = usePagination(filteredRequests, DEFAULT_PAGE_SIZE, `req|${reqFilter}`)
  const distributionsPaging = usePagination(bDistributions, DEFAULT_PAGE_SIZE, 'dist')

  if (loading && !beneficiary) {
    return <ApiState loading />
  }

  if (!beneficiary) {
    return (
      <div className="barangay-details">
        <button type="button" className="btn btn--ghost" onClick={() => navigate('/admin/beneficiaries')}>
          <ArrowLeft size={16} /> Back to Beneficiaries
        </button>
        <p className="barangay-empty">Beneficiary not found.</p>
      </div>
    )
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    if (!editForm.barangay?.trim() || !editForm.municipality?.trim()) {
      notify.warning('Barangay name and municipality/city are required.')
      return
    }
    const phoneMsg = phoneError(editForm.representativePhone, { required: true })
    if (phoneMsg) {
      notify.warning(phoneMsg)
      return
    }
    setSaving(true)
    try {
      // Status is not editable here — Approve / Reject on Overview controls partnership status.
      const { status: _status, ...profileFields } = editForm
      await beneficiariesApi.update(beneficiary.dbId, {
        ...profileFields,
        status: beneficiary.status,
      })
      await reloadBen()
      notify.success('Beneficiary updated.')
      setIsEditModalOpen(false)
    } catch (err) {
      notify.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    const name = beneficiary.barangay || beneficiary.name || 'this barangay'
    if (!window.confirm(`Permanently delete "${name}"? This removes the barangay and its linked requests. This cannot be undone.`)) return
    try {
      const removedId = beneficiary.dbId
      await beneficiariesApi.remove(removedId)
      notifyBeneficiariesChanged({ removedId })
      notify.success('Barangay deleted.')
      navigate('/admin/beneficiaries', { replace: true, state: { beneficiariesRefresh: Date.now() } })
    } catch (err) {
      notify.error(err.message || 'Failed to delete barangay')
    }
  }

  const handleSendInvite = async () => {
    if (!beneficiary.representativeEmail) {
      notify.warning('Add a representative email before sending an invite.')
      return
    }
    try {
      const res = await beneficiariesApi.reinvite(beneficiary.dbId, {
        email: beneficiary.representativeEmail,
        barangay: beneficiary.barangay || beneficiary.name,
        municipality: beneficiary.municipality || '',
      })
      if (res?.invitationSent) {
        notify.success(res?.message || `Invitation emailed to ${beneficiary.representativeEmail}.`)
      } else {
        notify.warning(res?.mailError || res?.message || 'Invitation saved, but email could not be delivered.')
        if (res?.inviteUrl) notify.info(`Invite link: ${res.inviteUrl}`, 8000)
      }
      await reloadBen()
    } catch (err) {
      notify.error(err.message || 'Failed to send invitation')
    }
  }

  const handleApprove = async () => {
    setApproveConfirm(false)
    setActionBusy(true)
    try {
      const res = await beneficiariesApi.approve(beneficiary.dbId)
      if (res?.credentialsSent) {
        suppressNotificationToast('beneficiary_credentials')
        notify.success(res?.message || 'Login credentials have been successfully sent to the approved Barangay.')
      } else if (res?.accountCreated) {
        notify.warning(
          [
            res?.message || 'Barangay approved and account was created.',
            res?.temporaryPassword ? `Temporary password (share securely): ${res.temporaryPassword}` : '',
            res?.mailError ? `Email note: ${res.mailError}` : 'Credential email was not delivered.',
          ].filter(Boolean).join(' '),
        )
      } else {
        notify.success(res?.message || 'Barangay approved.')
        if (res?.mailError) notify.warning(res.mailError)
      }
      notifyBeneficiariesChanged()
      await reloadBen()
    } catch (err) {
      notify.error(err.message || 'Failed to approve barangay')
    } finally {
      setActionBusy(false)
    }
  }

  const handleReject = async () => {
    setRejectConfirm(false)
    setActionBusy(true)
    try {
      const res = await beneficiariesApi.reject(beneficiary.dbId)
      notify.success(res?.message || 'Application rejected.')
      notifyBeneficiariesChanged()
      await reloadBen()
    } catch (err) {
      notify.error(err.message || 'Failed to reject application')
    } finally {
      setActionBusy(false)
    }
  }

  const completedDistributions = bDistributions.filter((d) => ['Completed', 'Done', 'Distributed'].includes(d.status)).length
  const pendingRequestsCount = requests.filter((r) => !CLOSED_STATUSES.includes(r.status)).length
  const pendingDistCount = bDistributions.filter((d) => !['Completed', 'Done', 'Distributed'].includes(d.status)).length
  const pendingItems = pendingRequestsCount + pendingDistCount
  const highestPriority = derivePriority(requests)

  const needs = normalizeNeeds(beneficiary.needs)
  const isPending = isAwaitingBarangayApproval(beneficiary)
  const barangayName = beneficiary.barangay || beneficiary.name || 'this barangay'

  return (
    <div className="barangay-details">

      {/* ── Approve Confirmation Dialog ── */}
      {approveConfirm && (
        <div className="approval-confirm-overlay" role="dialog" aria-modal="true" aria-label="Confirm approval">
          <div className="approval-confirm__card">
            <div className="approval-confirm__icon approval-confirm__icon--approve">
              <CheckCircle2 size={24} />
            </div>
            <h3 className="approval-confirm__title">Approve Partnership?</h3>
            <p className="approval-confirm__body">
              This will create a Barangay account for <strong>{barangayName}</strong> and email their login credentials.
              This action cannot be undone.
            </p>
            <div className="approval-confirm__actions">
              <button
                type="button"
                className="btn approval-overlay__btn-approve"
                onClick={handleApprove}
                disabled={actionBusy}
              >
                {actionBusy ? 'Approving…' : 'Yes, Approve'}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setApproveConfirm(false)}
                disabled={actionBusy}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Confirmation Dialog ── */}
      {rejectConfirm && (
        <div className="approval-confirm-overlay" role="dialog" aria-modal="true" aria-label="Confirm rejection">
          <div className="approval-confirm__card">
            <div className="approval-confirm__icon approval-confirm__icon--reject">
              <XCircle size={24} />
            </div>
            <h3 className="approval-confirm__title">Reject Application?</h3>
            <p className="approval-confirm__body">
              The partnership application for <strong>{barangayName}</strong> will be rejected.
              You can re-invite them later if needed.
            </p>
            <div className="approval-confirm__actions">
              <button
                type="button"
                className="btn approval-overlay__btn-reject"
                onClick={handleReject}
                disabled={actionBusy}
              >
                {actionBusy ? 'Rejecting…' : 'Yes, Reject'}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setRejectConfirm(false)}
                disabled={actionBusy}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="barangay-details__content">

      <div className="barangay-details__top">
        <div className="barangay-details__identity">
          <button
            type="button"
            className="btn btn--ghost btn--sm barangay-details__back"
            onClick={() => navigate('/admin/beneficiaries')}
            aria-label="Back to barangay overview"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="barangay-details__heading">
            <h1 className="barangay-details__title">{beneficiary.barangay || beneficiary.name}</h1>
            <span className="barangay-details__subtitle">{beneficiary.municipality || 'Cebu'}</span>
            <StatusBadge status={beneficiary.status} />
            {isPending && (
              <span className="beneficiaries-review-pill">Awaiting approval</span>
            )}
            {highestPriority && <StatusBadge status={highestPriority} />}
          </div>
        </div>

        <div className="barangay-details__actions">
          <button type="button" className="btn btn--outline btn--sm" onClick={() => setIsEditModalOpen(true)}>
            <Pencil size={14} /> Edit profile
          </button>
          {canInviteBarangay(beneficiary) && (
            <button type="button" className="btn btn--outline btn--sm" onClick={handleSendInvite}>
              <Mail size={14} /> Resend Invite
            </button>
          )}
          <button type="button" className="btn btn--danger btn--sm" onClick={handleDelete}>
            <Trash2 size={14} /> Remove
          </button>
        </div>
      </div>

      <div className="barangay-metrics">
        <div className="barangay-metric">
          <span className="barangay-metric__value">{Number(beneficiary.affectedFamilies || 0).toLocaleString()}</span>
          <span className="barangay-metric__label">Families</span>
        </div>
        <div className="barangay-metric">
          <span className="barangay-metric__value">{requests.length}</span>
          <span className="barangay-metric__label">Requests</span>
        </div>
        <div className="barangay-metric">
          <span className="barangay-metric__value">{completedDistributions}</span>
          <span className="barangay-metric__label">Delivered</span>
        </div>
        <div className="barangay-metric">
          <span className="barangay-metric__value">{pendingItems}</span>
          <span className="barangay-metric__label">Pending</span>
        </div>
      </div>

      <div className="barangay-tabs" role="tablist" aria-label="Beneficiary sections">
        {TABS.map((tab) => {
          const key = tabKey(tab)
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === key}
              className={`barangay-tab${activeTab === key ? ' barangay-tab--active' : ''}`}
              onClick={() => selectTab(key)}
            >
              {tab}
            </button>
          )
        })}
      </div>

      {activeTab === 'overview' && (
        <div className="barangay-overview">
          {isPending && (
            <div
              id="barangay-overview-review"
              className="barangay-overview-review"
              role="region"
              aria-label="Partnership application review"
            >
              <div className="barangay-overview-review__icon" aria-hidden="true">
                <Shield size={22} />
              </div>
              <div className="barangay-overview-review__copy">
                <span className="barangay-overview-review__eyebrow">Registration submitted</span>
                <strong>Partnership application awaiting approval</strong>
                <p>
                  Review the representative details below, then approve to create their account and email login credentials,
                  or reject the application.
                </p>
              </div>
              <div className="barangay-overview-review__actions">
                <button
                  type="button"
                  className="btn approval-overlay__btn-approve"
                  onClick={() => setApproveConfirm(true)}
                  disabled={actionBusy}
                >
                  <CheckCircle2 size={16} /> Approve
                </button>
                <button
                  type="button"
                  className="btn approval-overlay__btn-reject"
                  onClick={() => setRejectConfirm(true)}
                  disabled={actionBusy}
                >
                  <XCircle size={16} /> Reject
                </button>
              </div>
            </div>
          )}
          <dl className="barangay-facts">
            <div>
              <dt>Representative</dt>
              <dd>{beneficiary.representativeName || '—'}</dd>
            </div>
            <div>
              <dt>Position</dt>
              <dd>{beneficiary.representativePosition || '—'}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{beneficiary.representativePhone || '—'}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{beneficiary.representativeEmail || '—'}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>{beneficiary.address || '—'}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{beneficiary.barangayType || '—'}</dd>
            </div>
            <div>
              <dt>Notes</dt>
              <dd>{beneficiary.notes || '—'}</dd>
            </div>
            <div className="barangay-facts__full">
              <dt>Type of Needs</dt>
              <dd>
                {needs.length > 0 ? (
                  <div className="barangay-pills">
                    {needs.map((n) => <span key={n} className="barangay-pill">{n}</span>)}
                  </div>
                ) : '—'}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {activeTab === 'relief-requests' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.65rem', marginBottom: '0.65rem', flexWrap: 'wrap' }}>
            <div className="barangay-chip-filters">
              {['All', 'Pending', 'Approved', 'Completed', 'Rejected'].map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`barangay-chip${reqFilter === f ? ' barangay-chip--active' : ''}`}
                  onClick={() => setReqFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => setIsReqModalOpen(true)}>
              <Plus size={14} /> New Request
            </button>
          </div>

          {filteredRequests.length === 0 ? (
            <p className="barangay-empty">No requests found for this beneficiary.</p>
          ) : (
            <>
              <div className="barangay-card-list">
                {requestsPaging.pageItems.map((req) => (
                  <div
                    key={req.dbId || req.id}
                    className="barangay-item-card"
                    onClick={() => navigate('/admin/requests')}
                    onKeyDown={(e) => { if (e.key === 'Enter') navigate('/admin/requests') }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="barangay-item-card__header">
                      <div>
                        <h4 className="barangay-item-card__title">{req.id} — {req.type}</h4>
                        <div className="barangay-item-card__meta">
                          <span><Calendar size={12} /> {req.date || '—'}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {req.priority && <StatusBadge status={req.priority} />}
                        <StatusBadge status={req.status} />
                      </div>
                    </div>
                    {req.notes && <p className="barangay-item-card__notes">{req.notes}</p>}
                  </div>
                ))}
              </div>
              <Pagination
                page={requestsPaging.page}
                totalPages={requestsPaging.totalPages}
                total={requestsPaging.total}
                startIndex={requestsPaging.startIndex}
                endIndex={requestsPaging.endIndex}
                onPageChange={requestsPaging.setPage}
                className="pagination--portal"
                noun="requests"
              />
            </>
          )}
        </div>
      )}

      {activeTab === 'distributions' && (
        <div>
          {bDistributions.length === 0 ? (
            <p className="barangay-empty">No distributions found for this beneficiary.</p>
          ) : (
            <>
              <div className="barangay-card-list">
                {distributionsPaging.pageItems.map((dist) => (
                  <div
                    key={dist.dbId || dist.id}
                    className="barangay-item-card"
                    onClick={() => navigate('/admin/distributions')}
                    onKeyDown={(e) => { if (e.key === 'Enter') navigate('/admin/distributions') }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="barangay-item-card__header">
                      <div>
                        <h4 className="barangay-item-card__title">{dist.eventName || dist.id}</h4>
                        <div className="barangay-item-card__meta">
                          <span><Calendar size={12} /> {dist.date || dist.distributionDate || '—'}</span>
                          <span><Package size={12} /> {dist.program || 'General'}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <StatusBadge status={dist.status} />
                        {dist.proofStatus && <StatusBadge status={dist.proofStatus} />}
                      </div>
                    </div>
                    {dist.itemsSummary && <p className="barangay-item-card__notes">{dist.itemsSummary}</p>}
                  </div>
                ))}
              </div>
              <Pagination
                page={distributionsPaging.page}
                totalPages={distributionsPaging.totalPages}
                total={distributionsPaging.total}
                startIndex={distributionsPaging.startIndex}
                endIndex={distributionsPaging.endIndex}
                onPageChange={distributionsPaging.setPage}
                className="pagination--portal"
                noun="distributions"
              />
            </>
          )}
        </div>
      )}

      {activeTab === 'tracker' && (
        <div>
          {requests.filter((r) => !['Completed', 'Done'].includes(r.status)).length === 0 ? (
            <p className="barangay-empty">No active requests to track.</p>
          ) : (
            requests.filter((r) => !['Completed', 'Done'].includes(r.status)).map((req) => {
              const isRejected = req.status === 'Rejected'
              const reqAllocations = bAllocations.filter((a) => (
                Number(a.assistanceRequestId) === Number(req.dbId)
                || Number(a.beneficiaryId) === Number(req.beneficiaryId)
              ))
              const reqDists = bDistributions.filter((d) => Number(d.beneficiaryId) === Number(req.beneficiaryId))

              let stage = 1
              if (['Pending Review', 'Under Review'].includes(req.status)) stage = 2
              if (req.status === 'Approved') stage = 3
              if (reqAllocations.length > 0) stage = 4

              const activeDist = reqDists[0]
              if (activeDist) {
                if (['Scheduled', 'Planning', 'Preparing'].includes(activeDist.status)) stage = 5
                if (['In Transit', 'Dispatched', 'In Progress'].includes(activeDist.status)) stage = 6
                if (['Delivered', 'Received', 'Awaiting Proof'].includes(activeDist.status)) stage = 7
                if (['Verified', 'Proof Verified', 'Approved'].includes(activeDist.proofStatus)) stage = 8
                if (['Completed', 'Done'].includes(activeDist.status)) stage = 9
              }

              const stages = [
                { id: 1, label: 'Submitted', icon: FileText },
                { id: 2, label: 'Reviewed', icon: Eye, admin: true },
                { id: 3, label: 'Approved', icon: Check, admin: true },
                { id: 4, label: 'Allocated', icon: Package },
                { id: 5, label: 'Scheduled', icon: Calendar },
                { id: 6, label: 'Dispatched', icon: Truck },
                { id: 7, label: 'Confirmed', icon: User },
                { id: 8, label: 'Verified', icon: Shield, admin: true },
                { id: 9, label: 'Completed', icon: Check },
              ]

              return (
                <div key={req.dbId || req.id} className="barangay-tracker">
                  <h3 className="barangay-tracker__title">Request tracker: {req.id}</h3>
                  <div className="barangay-tracker__timeline">
                    {stages.map((s) => {
                      if (isRejected && s.id > stage) return null
                      const Icon = s.icon
                      let nodeClass = 'barangay-tracker__node'
                      if (s.id < stage && !isRejected) nodeClass += ' barangay-tracker__node--done'
                      if (s.id === stage && !isRejected) nodeClass += ' barangay-tracker__node--current'
                      if (s.id === stage && isRejected) nodeClass += ' barangay-tracker__node--rejected'

                      return (
                        <div key={s.id} className={nodeClass}>
                          <div className="barangay-tracker__icon">
                            {isRejected && s.id === stage ? <X size={14} /> : <Icon size={14} />}
                          </div>
                          {s.admin && <Shield size={10} className="barangay-tracker__gate" aria-label="Admin gate" />}
                          <span className="barangay-tracker__label">{s.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="barangay-docs">
          <Upload size={18} />
          <h3>Documents & proofs</h3>
          <p>
            Proofs submitted: {beneficiary.proofsSubmitted || 0}. Uploads will show here when available.
          </p>
        </div>
      )}

      </div>{/* end .barangay-details__content */}

      {isEditModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setIsEditModalOpen(false)}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title="Edit Barangay" onClose={() => setIsEditModalOpen(false)} />
            <form onSubmit={handleEditSubmit}>
              <div className="form-row">
                <label>
                  <Req required>Barangay Name</Req>
                  <input required value={editForm.barangay} onChange={(e) => setEditForm({ ...editForm, barangay: e.target.value })} />
                </label>
                <label>
                  <Req required>Municipality</Req>
                  <input required value={editForm.municipality} onChange={(e) => setEditForm({ ...editForm, municipality: e.target.value })} />
                </label>
              </div>
              <div className="form-row">
                <label>
                  <CatalogFieldLabel catalog="barangay_types" onUpdated={applyBarangayTypes}>
                    Barangay Type
                  </CatalogFieldLabel>
                  <select value={editForm.barangayType || ''} onChange={(e) => setEditForm({ ...editForm, barangayType: e.target.value })}>
                    <option value="">Select type…</option>
                    {barangayTypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                    {editForm.barangayType && !barangayTypeOptions.includes(editForm.barangayType) && (
                      <option value={editForm.barangayType}>{editForm.barangayType}</option>
                    )}
                  </select>
                </label>
                <label>
                  Affected Families
                  <input type="number" min="0" value={editForm.affectedFamilies} onChange={(e) => setEditForm({ ...editForm, affectedFamilies: e.target.value })} />
                </label>
              </div>
              <label>
                <Req required>Complete Address</Req>
                <input required value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
              </label>
              <NeedsPicker
                value={editForm.needs || []}
                onChange={(needs) => setEditForm({ ...editForm, needs })}
                note={editForm.notes || ''}
                onNoteChange={(notes) => setEditForm({ ...editForm, notes })}
                options={needOptions}
                showQuickAdd
                onCatalogUpdated={applyNeeds}
                initialVisible={6}
              />
              <p className="form-section-title" style={{ margin: '1.25rem 0 0.85rem', fontWeight: 650 }}>Representative</p>
              <div className="form-row">
                <label>
                  Name
                  <input value={editForm.representativeName} onChange={(e) => setEditForm({ ...editForm, representativeName: e.target.value })} />
                </label>
                <label>
                  Position
                  <input value={editForm.representativePosition} onChange={(e) => setEditForm({ ...editForm, representativePosition: e.target.value })} />
                </label>
              </div>
              <div className="form-row">
                <label>
                  <Req required>Phone</Req>
                  <PhoneInput
                    required
                    value={editForm.representativePhone}
                    onChange={(representativePhone) => setEditForm({ ...editForm, representativePhone })}
                  />
                </label>
                <label>
                  Email
                  <input type="email" value={editForm.representativeEmail} onChange={(e) => setEditForm({ ...editForm, representativeEmail: e.target.value })} />
                </label>
              </div>
              <div className="admin-modal__actions" style={{ marginTop: '1.25rem' }}>
                <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
                <button type="button" className="btn btn--ghost" onClick={() => setIsEditModalOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isReqModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setIsReqModalOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title="New Relief Request" onClose={() => setIsReqModalOpen(false)} />
            <p style={{ color: 'var(--admin-text-muted)', margin: 0 }}>
              Create and prioritize requests from the Relief Requests module.
            </p>
            <div className="admin-modal__actions" style={{ marginTop: '1.25rem' }}>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  setIsReqModalOpen(false)
                  navigate('/admin/requests')
                }}
              >
                Go to Relief Requests
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setIsReqModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
