import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Pencil, Mail, Trash2, FileText, Truck, Package,
  User, Calendar, Check, Eye, X, Shield, Plus, Upload,
} from 'lucide-react'
import {
  beneficiariesApi,
  assistanceRequestsApi,
  distributionsApi,
  allocationsApi,
} from '../../api/resources'
import { BARANGAY_TYPES, NEEDS } from '../../constants/options'
import { useApiList } from '../../hooks/useApiList'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import ModalHeader from '../../components/admin/shared/ModalHeader'
import Req from '../../components/shared/Req'
import { useSeeMore } from '../../hooks/useSeeMore'
import { SeeMoreToggle } from '../../components/admin/shared/SeeMoreList'
import { notifyBeneficiariesChanged } from '../../utils/beneficiariesSync'

function normalizeNeeds(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((n) => n.trim()).filter(Boolean)
  }
  return []
}

function toggleNeed(list, need) {
  return list.includes(need) ? list.filter((n) => n !== need) : [...list, need]
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

  const [activeTab, setActiveTab] = useState('overview')
  const [reqFilter, setReqFilter] = useState('All')
  const tabKey = (tab) => tab.toLowerCase().replace(/\s+/g, '-')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isReqModalOpen, setIsReqModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({})

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

  const loading = benLoading || reqLoading || distLoading || allocLoading

  const filteredRequests = reqFilter === 'All'
    ? requests
    : requests.filter((r) => {
      if (reqFilter === 'Pending') {
        return ['Pending', 'Pending Verification', 'Pending Review', 'Under Review'].includes(r.status)
      }
      return r.status === reqFilter
    })

  const requestsSeeMore = useSeeMore(filteredRequests, 3)
  const distributionsSeeMore = useSeeMore(bDistributions, 3)

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
    setSaving(true)
    try {
      await beneficiariesApi.update(beneficiary.dbId, editForm)
      await reloadBen()
      setIsEditModalOpen(false)
    } catch (err) {
      alert(err.message)
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
      navigate('/admin/beneficiaries', { replace: true, state: { beneficiariesRefresh: Date.now() } })
    } catch (err) {
      alert(err.message || 'Failed to delete barangay')
    }
  }

  const handleSendInvite = async () => {
    if (!beneficiary.representativeEmail) {
      alert('Add a representative email before sending an invite.')
      return
    }
    try {
      await beneficiariesApi.update(beneficiary.dbId, { status: 'Pending Approval' })
      alert(`Invitation marked for ${beneficiary.representativeEmail}.`)
      await reloadBen()
    } catch (err) {
      alert(err.message)
    }
  }

  const completedDistributions = bDistributions.filter((d) => ['Completed', 'Done', 'Distributed'].includes(d.status)).length
  const pendingRequestsCount = requests.filter((r) => !CLOSED_STATUSES.includes(r.status)).length
  const pendingDistCount = bDistributions.filter((d) => !['Completed', 'Done', 'Distributed'].includes(d.status)).length
  const pendingItems = pendingRequestsCount + pendingDistCount
  const highestPriority = derivePriority(requests)

  const needs = normalizeNeeds(beneficiary.needs)

  return (
    <div className="barangay-details">
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
            {highestPriority && <StatusBadge status={highestPriority} />}
          </div>
        </div>

        <div className="barangay-details__actions">
          <button type="button" className="btn btn--outline btn--sm" onClick={() => setIsEditModalOpen(true)}>
            <Pencil size={14} /> Edit
          </button>
          <button type="button" className="btn btn--outline btn--sm" onClick={handleSendInvite}>
            <Mail size={14} /> Invite
          </button>
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
              onClick={() => setActiveTab(key)}
            >
              {tab}
            </button>
          )
        })}
      </div>

      {activeTab === 'overview' && (
        <div className="barangay-overview">
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
            <div className="see-more-wrap">
            <div className="barangay-card-list">
              {requestsSeeMore.visible.map((req) => (
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
            {requestsSeeMore.needsToggle && (
              <SeeMoreToggle
                expanded={requestsSeeMore.expanded}
                onToggle={requestsSeeMore.toggle}
                hiddenCount={requestsSeeMore.hiddenCount}
              />
            )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'distributions' && (
        <div>
          {bDistributions.length === 0 ? (
            <p className="barangay-empty">No distributions found for this beneficiary.</p>
          ) : (
            <div className="see-more-wrap">
            <div className="barangay-card-list">
              {distributionsSeeMore.visible.map((dist) => (
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
            {distributionsSeeMore.needsToggle && (
              <SeeMoreToggle
                expanded={distributionsSeeMore.expanded}
                onToggle={distributionsSeeMore.toggle}
                hiddenCount={distributionsSeeMore.hiddenCount}
              />
            )}
            </div>
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

      {isEditModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setIsEditModalOpen(false)}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title="Edit Beneficiary" onClose={() => setIsEditModalOpen(false)} />
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
                  Barangay Type
                  <select value={editForm.barangayType || ''} onChange={(e) => setEditForm({ ...editForm, barangayType: e.target.value })}>
                    <option value="">Select type…</option>
                    {BARANGAY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    {editForm.barangayType && !BARANGAY_TYPES.includes(editForm.barangayType) && (
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
              <fieldset>
                <legend>Type of Needs</legend>
                <div className="checkbox-grid">
                  {NEEDS.map((need) => (
                    <label key={need} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={(editForm.needs || []).includes(need)}
                        onChange={() => setEditForm({
                          ...editForm,
                          needs: toggleNeed(editForm.needs || [], need),
                        })}
                      />
                      {need}
                    </label>
                  ))}
                  {(editForm.needs || [])
                    .filter((n) => !NEEDS.includes(n))
                    .map((need) => (
                      <label key={need} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked
                          onChange={() => setEditForm({
                            ...editForm,
                            needs: toggleNeed(editForm.needs || [], need),
                          })}
                        />
                        {need}
                      </label>
                    ))}
                </div>
              </fieldset>
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
                  Phone
                  <input value={editForm.representativePhone} onChange={(e) => setEditForm({ ...editForm, representativePhone: e.target.value })} />
                </label>
                <label>
                  Email
                  <input type="email" value={editForm.representativeEmail} onChange={(e) => setEditForm({ ...editForm, representativeEmail: e.target.value })} />
                </label>
              </div>
              <label>
                Status
                <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                  <option value="Active">Active</option>
                  <option value="Approved">Approved</option>
                  <option value="Pending Approval">Pending Approval</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </label>
              <label>
                Notes
                <textarea rows={3} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
              </label>
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
