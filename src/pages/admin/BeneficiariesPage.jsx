import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Mail, Plus, Users, Activity, Clock, AlertCircle, Eye, Pencil, Trash2, Send, CheckCircle2, XCircle } from 'lucide-react'
import { beneficiariesApi, assistanceRequestsApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { useFilters } from '../../hooks/useFilters'
import { MUNICIPALITIES, barangaysForMunicipality } from '../../constants/locations'
import { BARANGAY_TYPES, REPRESENTATIVE_POSITIONS } from '../../constants/options'
import PageHeader from '../../components/admin/shared/PageHeader'
import DataTable from '../../components/admin/shared/DataTable'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import FilterBar from '../../components/admin/shared/FilterBar'
import ModalHeader from '../../components/admin/shared/ModalHeader'
import Req from '../../components/shared/Req'
import NameFields from '../../components/shared/NameFields'
import NeedsPicker from '../../components/shared/NeedsPicker'
import ApiState from '../../components/admin/shared/ApiState'
import { emptyNameParts, formatFullName, parseFullName } from '../../utils/personName'
import { BENEFICIARIES_CHANGED, notifyBeneficiariesChanged } from '../../utils/beneficiariesSync'
import { canInviteBarangay, canStartOrRefreshInvite, isAwaitingBarangayApproval } from '../../utils/barangayInvite'
import { notify, suppressNotificationToast } from '../../utils/toast'

const STATUS_OPTIONS = ['Active', 'Approved', 'Pending Approval', 'Suspended', 'Rejected']
/** Create-only statuses — Edit never changes partnership status. */
const CREATE_STATUS_OPTIONS = ['Active', 'Pending Approval', 'Suspended']
const PRIORITY_RANK = { Critical: 4, High: 3, Medium: 2, Low: 1 }

const filterConfig = {
  searchKeys: ['barangay', 'municipality', 'representativeName', 'name', 'representativeEmail'],
  filters: [
    { key: 'status', label: 'Status', options: STATUS_OPTIONS },
  ],
  sorts: [
    { key: 'barangay', label: 'Name' },
    { key: 'affectedFamilies', label: 'Affected Families' },
    { key: 'municipality', label: 'Municipality' },
  ],
}

const emptyCreateForm = {
  barangay: '',
  municipality: '',
  barangayType: '',
  address: '',
  affectedFamilies: '',
  needs: [],
  nameParts: emptyNameParts(),
  representativePosition: '',
  representativePhone: '',
  representativeEmail: '',
  notes: '',
  status: 'Active',
}

function normalizeNeeds(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((n) => n.trim()).filter(Boolean)
  }
  return []
}

const emptyInviteForm = {
  email: '',
  barangay: '',
  municipality: '',
  province: 'Cebu',
}

function formFromRow(row) {
  const hasParts = Boolean(row.representativeLastName || row.representativeFirstName)
  const nameParts = hasParts
    ? {
        lastName: row.representativeLastName || '',
        firstName: row.representativeFirstName || '',
        middleInitial: row.representativeMiddleInitial || '',
      }
    : parseFullName(row.representativeName || '')

  return {
    barangay: row.barangay || row.name || '',
    barangayType: row.barangayType || '',
    municipality: row.municipality || '',
    address: row.address || '',
    affectedFamilies: row.affectedFamilies ?? '',
    needs: normalizeNeeds(row.needs),
    nameParts,
    representativePosition: row.representativePosition || '',
    representativePhone: row.representativePhone || '',
    representativeEmail: row.representativeEmail || '',
    notes: row.notes || '',
    status: row.status || 'Active',
  }
}

function toastInviteResult(res, email) {
  if (res?.invitationSent) {
    notify.success(res?.message || `Invitation emailed to ${email || 'barangay contact'}.`)
    return
  }
  const detail = res?.mailError || res?.message || 'Email could not be delivered.'
  notify.warning(detail)
  if (res?.inviteUrl) {
    notify.info(`Invite link: ${res.inviteUrl}`, 8000)
  }
}

function normalizeLocationLabel(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^(brgy\.?|barangay)\s+/i, '')
    .replace(/\s+/g, ' ')
}

function isDuplicateBarangay(list, barangay, municipality, excludeId = null) {
  const bKey = normalizeLocationLabel(barangay)
  const mKey = normalizeLocationLabel(municipality)
  if (!bKey || !mKey) return false
  return (list || []).some((row) => {
    if (excludeId != null && Number(row.dbId) === Number(excludeId)) return false
    const rowBarangay = normalizeLocationLabel(row.barangay || row.name)
    const rowMuni = normalizeLocationLabel(row.municipality)
    return rowBarangay === bKey && rowMuni === mKey
  })
}

function priorityClass(priority) {
  const key = String(priority || 'none').toLowerCase()
  return `beneficiaries-priority beneficiaries-priority--${key}`
}

export default function BeneficiariesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: beneficiaries, loading, error, reload, setData } = useApiList(() => beneficiariesApi.list())
  const { data: requests } = useApiList(() => assistanceRequestsApi.list())

  useEffect(() => {
    if (location.state?.beneficiariesRefresh) {
      void reload()
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, location.pathname, navigate, reload])

  useEffect(() => {
    const onChanged = (event) => {
      const removedId = event.detail?.removedId
      if (removedId != null) {
        setData((prev) => (prev || []).filter((b) => Number(b.dbId) !== Number(removedId)))
      }
      void reload()
    }
    window.addEventListener(BENEFICIARIES_CHANGED, onChanged)
    return () => window.removeEventListener(BENEFICIARIES_CHANGED, onChanged)
  }, [reload, setData])

  const filters = useFilters(beneficiaries, filterConfig)

  const [modalMode, setModalMode] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [createForm, setCreateForm] = useState(emptyCreateForm)
  const [inviteForm, setInviteForm] = useState(emptyInviteForm)
  const [saving, setSaving] = useState(false)
  const [actionBusyId, setActionBusyId] = useState(null)

  const totalBeneficiaries = beneficiaries.length
  const activeBeneficiaries = beneficiaries.filter((b) => b.status === 'Active' || b.status === 'Approved').length
  const pendingInvites = beneficiaries.filter((b) => isAwaitingBarangayApproval(b)).length

  const urgentNeedsCount = useMemo(() => {
    if (!requests) return 0
    return requests.filter((r) => (
      ['Pending Review', 'Under Review'].includes(r.status)
      && ['High', 'Critical'].includes(r.priority)
    )).length
  }, [requests])

  const latestRequestsMap = useMemo(() => {
    const map = {}
    ;(requests || []).forEach((req) => {
      const bId = req.beneficiaryId
      if (!map[bId] || new Date(req.date) > new Date(map[bId].date)) {
        map[bId] = req
      }
    })
    return map
  }, [requests])

  const openPriorityMap = useMemo(() => {
    const map = {}
    ;(requests || []).forEach((req) => {
      if (['Completed', 'Done', 'Rejected', 'Cancelled'].includes(req.status)) return
      const bId = req.beneficiaryId
      const rank = PRIORITY_RANK[req.priority] || 0
      if (!map[bId] || rank > (PRIORITY_RANK[map[bId]] || 0)) {
        map[bId] = req.priority || 'Low'
      }
    })
    return map
  }, [requests])

  const openInvite = () => {
    setInviteForm(emptyInviteForm)
    setModalMode('invite')
  }

  const openCreate = () => {
    setCreateForm(emptyCreateForm)
    setModalMode('create')
  }

  const openEdit = (row) => {
    setActiveId(row.dbId)
    setCreateForm(formFromRow(row))
    setModalMode('edit')
  }

  const handleRowClick = (row) => {
    navigate(`/admin/beneficiaries/${row.dbId}`)
  }

  const handleDelete = async (e, row) => {
    e.stopPropagation()
    if (!window.confirm(`Permanently delete beneficiary "${row.barangay || row.name}"? This cannot be undone.`)) return
    try {
      await beneficiariesApi.remove(row.dbId)
      setData((prev) => (prev || []).filter((b) => Number(b.dbId) !== Number(row.dbId)))
      notifyBeneficiariesChanged({ removedId: row.dbId })
      notify.success('Beneficiary deleted.')
      reload()
    } catch (err) {
      notify.error(err.message)
    }
  }

  const handleReinvite = async (e, row) => {
    e.stopPropagation()
    const email = String(row.representativeEmail || '').trim()
    if (!email) {
      notify.warning('Add a representative email before sending an invite.')
      return
    }
    try {
      const res = await beneficiariesApi.reinvite(row.dbId, {
        email,
        barangay: row.barangay || row.name,
        municipality: row.municipality || '',
      })
      toastInviteResult(res, email)
      notifyBeneficiariesChanged()
      reload()
    } catch (err) {
      notify.error(err.message || 'Failed to send invitation')
    }
  }

  const handleApprove = async (e, row) => {
    e.stopPropagation()
    if (actionBusyId === row.dbId) return
    const name = row.barangay || row.name || 'this barangay'
    if (!window.confirm(`Approve partnership application for "${name}"? This creates their account and emails login credentials.`)) return
    setActionBusyId(row.dbId)
    try {
      const res = await beneficiariesApi.approve(row.dbId)
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
      reload()
    } catch (err) {
      notify.error(err.message || 'Failed to approve barangay')
    } finally {
      setActionBusyId(null)
    }
  }

  const handleReject = async (e, row) => {
    e.stopPropagation()
    if (actionBusyId === row.dbId) return
    const name = row.barangay || row.name || 'this barangay'
    if (!window.confirm(`Reject partnership application for "${name}"?`)) return
    setActionBusyId(row.dbId)
    try {
      const res = await beneficiariesApi.reject(row.dbId)
      notify.success(res?.message || 'Application rejected.')
      notifyBeneficiariesChanged()
      reload()
    } catch (err) {
      notify.error(err.message || 'Failed to reject application')
    } finally {
      setActionBusyId(null)
    }
  }

  const handleSaveInvite = async (e) => {
    e.preventDefault()
    const email = String(inviteForm.email || '').trim()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      notify.warning('Enter a valid representative email address.')
      return
    }
    if (!inviteForm.barangay?.trim() || !inviteForm.municipality?.trim()) {
      notify.warning('Barangay name and municipality/city are required.')
      return
    }
    setSaving(true)
    try {
      const existing = (beneficiaries || []).find((row) => (
        normalizeLocationLabel(row.barangay || row.name) === normalizeLocationLabel(inviteForm.barangay)
        && normalizeLocationLabel(row.municipality) === normalizeLocationLabel(inviteForm.municipality)
      ))
      if (existing && !canStartOrRefreshInvite(existing)) {
        if (isAwaitingBarangayApproval(existing)) {
          notify.warning('This barangay already submitted registration and is awaiting approval. Use Approve instead.')
        } else {
          notify.warning('This barangay is already registered. Invite is only for new barangays.')
        }
        return
      }
      const payload = {
        barangay: inviteForm.barangay,
        municipality: inviteForm.municipality,
        email,
        representativeEmail: email,
      }
      const res = existing?.dbId
        ? await beneficiariesApi.reinvite(existing.dbId, payload)
        : await beneficiariesApi.invite(payload)
      toastInviteResult(res, email)
      setModalMode(null)
      setInviteForm(emptyInviteForm)
      notifyBeneficiariesChanged()
      reload()
    } catch (err) {
      notify.error(err.message || 'Failed to send invitation')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveCreateEdit = async (e) => {
    e.preventDefault()
    if (!createForm.barangay?.trim() || !createForm.municipality?.trim()) {
      notify.warning('Barangay name and municipality/city are required.')
      return
    }
    const excludeId = modalMode === 'edit' ? activeId : null
    if (isDuplicateBarangay(beneficiaries, createForm.barangay, createForm.municipality, excludeId)) {
      notify.warning(`Barangay "${createForm.barangay}" in ${createForm.municipality} is already registered.`)
      return
    }
    setSaving(true)
    try {
      const representativeName = formatFullName(createForm.nameParts)
      const payload = {
        barangay: createForm.barangay,
        municipality: createForm.municipality,
        barangayType: createForm.barangayType,
        address: createForm.address,
        affectedFamilies: Number(createForm.affectedFamilies) || 0,
        needs: createForm.needs,
        representativeLastName: createForm.nameParts.lastName,
        representativeFirstName: createForm.nameParts.firstName,
        representativeMiddleInitial: createForm.nameParts.middleInitial,
        representativeName,
        representativePosition: createForm.representativePosition,
        representativePhone: createForm.representativePhone,
        representativeEmail: createForm.representativeEmail,
        notes: createForm.notes,
        status: createForm.status,
      }

      if (modalMode === 'edit' && activeId) {
        const existing = beneficiaries.find((b) => Number(b.dbId) === Number(activeId))
        // Status is not editable in Edit — preserve current partnership/operational status.
        payload.status = existing?.status || payload.status
        await beneficiariesApi.update(activeId, payload)
      } else {
        await beneficiariesApi.create(payload)
      }

      notify.success(modalMode === 'edit' ? 'Beneficiary updated.' : 'Beneficiary created.')
      setModalMode(null)
      reload()
    } catch (err) {
      notify.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    {
      key: 'barangay',
      label: 'Barangay Name',
      render: (row) => <span className="beneficiaries-name">{row.barangay || row.name || '—'}</span>,
    },
    { key: 'municipality', label: 'Municipality / City', render: (row) => row.municipality || '—' },
    { key: 'representativeName', label: 'Representative', render: (row) => row.representativeName || '—' },
    {
      key: 'affectedFamilies',
      label: 'Affected Families',
      render: (row) => (row.affectedFamilies || 0).toLocaleString(),
    },
    { key: 'status', label: 'Status', render: (row) => (
      <div className="beneficiaries-status-cell">
        <StatusBadge status={row.status} />
        {isAwaitingBarangayApproval(row) && (
          <span className="beneficiaries-review-pill">Awaiting approval</span>
        )}
      </div>
    ) },
    {
      key: 'priority',
      label: 'Priority',
      render: (row) => {
        const priority = openPriorityMap[row.dbId]
        if (!priority) return <span className={priorityClass('none')}>None</span>
        return <span className={priorityClass(priority)}>{priority}</span>
      },
    },
    {
      key: 'latestRequest',
      label: 'Latest Request',
      render: (row) => {
        const latest = latestRequestsMap[row.dbId]
        if (!latest) return <div className="beneficiaries-latest__empty">No requests</div>
        return (
          <div className="beneficiaries-latest">
            <span className="beneficiaries-latest__type">{latest.type}</span>
            <span className="beneficiaries-latest__date">{latest.date || '—'}</span>
          </div>
        )
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => {
        const awaitingReview = isAwaitingBarangayApproval(row)
        const showInvite = canInviteBarangay(row)
        const busy = actionBusyId === row.dbId
        return (
          <div className="table-actions" onClick={(e) => e.stopPropagation()}>
            {awaitingReview ? (
              <div className="beneficiaries-review-actions">
                <button
                  type="button"
                  className="btn btn--sm btn--primary"
                  title="Approve application and email login credentials"
                  disabled={busy}
                  onClick={(e) => handleApprove(e, row)}
                >
                  <CheckCircle2 size={14} /> Approve
                </button>
                <button
                  type="button"
                  className="btn btn--sm btn--outline-danger"
                  title="Reject application"
                  disabled={busy}
                  onClick={(e) => handleReject(e, row)}
                >
                  <XCircle size={14} /> Reject
                </button>
                <button type="button" className="icon-btn" title="View details" onClick={() => handleRowClick(row)}>
                  <Eye size={16} />
                </button>
              </div>
            ) : (
              <>
                <button type="button" className="icon-btn" title="View details" onClick={() => handleRowClick(row)}>
                  <Eye size={16} />
                </button>
                <button type="button" className="icon-btn" title="Edit" onClick={() => openEdit(row)}>
                  <Pencil size={16} />
                </button>
                {showInvite && (
                  <button
                    type="button"
                    className="icon-btn"
                    title={row.representativeEmail ? 'Resend invitation' : 'Add representative email first'}
                    disabled={!row.representativeEmail || busy}
                    onClick={(e) => handleReinvite(e, row)}
                  >
                    <Send size={16} />
                  </button>
                )}
                <button type="button" className="icon-btn icon-btn--danger" title="Delete" onClick={(e) => handleDelete(e, row)}>
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="beneficiaries-page">
      <PageHeader
        title="Barangays"
        description="Select a barangay from the side panel to view its full profile, or manage partners below."
        actions={(
          <>
            <button type="button" className="btn btn--outline" onClick={openInvite}>
              <Mail size={16} /> Invite Barangay
            </button>
            <button type="button" className="btn btn--primary" onClick={openCreate}>
              <Plus size={16} /> Add Barangay
            </button>
          </>
        )}
      />

      <div className="beneficiaries-stats">
        <div className="beneficiaries-stat">
          <div className="beneficiaries-stat__icon beneficiaries-stat__icon--brand"><Users size={22} /></div>
          <div>
            <span className="beneficiaries-stat__value">{totalBeneficiaries}</span>
            <span className="beneficiaries-stat__label">Total Beneficiaries</span>
          </div>
        </div>
        <div className="beneficiaries-stat">
          <div className="beneficiaries-stat__icon beneficiaries-stat__icon--success"><Activity size={22} /></div>
          <div>
            <span className="beneficiaries-stat__value">{activeBeneficiaries}</span>
            <span className="beneficiaries-stat__label">Active</span>
          </div>
        </div>
        <div className="beneficiaries-stat">
          <div className="beneficiaries-stat__icon beneficiaries-stat__icon--warning"><Clock size={22} /></div>
          <div>
            <span className="beneficiaries-stat__value">{pendingInvites}</span>
            <span className="beneficiaries-stat__label">Pending Approval</span>
          </div>
        </div>
        <div className="beneficiaries-stat">
          <div className="beneficiaries-stat__icon beneficiaries-stat__icon--danger"><AlertCircle size={22} /></div>
          <div>
            <span className="beneficiaries-stat__value">{urgentNeedsCount}</span>
            <span className="beneficiaries-stat__label">Urgent Open Needs</span>
          </div>
        </div>
      </div>

      <FilterBar
        controller={filters}
        searchPlaceholder="Search by barangay, municipality, or representative…"
      />

      <ApiState loading={loading} error={error} onRetry={reload}>
        <DataTable
          columns={columns}
          data={filters.filtered}
          onRowClick={handleRowClick}
          rowClassName={(row) => (isAwaitingBarangayApproval(row) ? 'data-table__row--pending-review' : '')}
          initialVisible={5}
        />
      </ApiState>

      {modalMode === 'invite' && (
        <div className="admin-modal-overlay" onClick={() => setModalMode(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title="Invite Barangay" onClose={() => setModalMode(null)} />
            <form onSubmit={handleSaveInvite}>
              <p style={{ color: 'var(--admin-text-muted)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
                Send a partnership invitation. The representative completes a registration form, then appears here as Pending Approval until you approve and issue credentials.
              </p>

              <label>
                <Req required>Email Address</Req>
                <input
                  type="email"
                  required
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="representative@email.com"
                />
              </label>

              <div className="form-row">
                <label>
                  <Req required>Municipality</Req>
                  <select
                    required
                    value={inviteForm.municipality}
                    onChange={(e) => setInviteForm({ ...inviteForm, municipality: e.target.value, barangay: '' })}
                  >
                    <option value="">Select municipality…</option>
                    {MUNICIPALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
                <label>
                  <Req required>Barangay</Req>
                  <select
                    required
                    value={inviteForm.barangay}
                    disabled={!inviteForm.municipality}
                    onChange={(e) => setInviteForm({ ...inviteForm, barangay: e.target.value })}
                  >
                    <option value="">{inviteForm.municipality ? 'Select barangay…' : 'Select municipality first…'}</option>
                    {barangaysForMunicipality(inviteForm.municipality).map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                Province
                <input type="text" value={inviteForm.province} readOnly disabled />
              </label>

              <div className="admin-modal__actions">
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'Sending…' : 'Send Invitation'}
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setModalMode(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {(modalMode === 'create' || modalMode === 'edit') && (
        <div className="admin-modal-overlay" onClick={() => setModalMode(null)}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title={modalMode === 'edit' ? 'Edit Barangay' : 'Add Barangay'}
              onClose={() => setModalMode(null)}
            />
            <form onSubmit={handleSaveCreateEdit}>
              <div className="form-row">
                <label>
                  <Req required>Municipality / City</Req>
                  <select
                    required
                    value={createForm.municipality}
                    onChange={(e) => setCreateForm({ ...createForm, municipality: e.target.value, barangay: '' })}
                  >
                    <option value="">Select municipality/city…</option>
                    {MUNICIPALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
                    {createForm.municipality && !MUNICIPALITIES.includes(createForm.municipality) && (
                      <option value={createForm.municipality}>{createForm.municipality}</option>
                    )}
                  </select>
                </label>
                <label>
                  <Req required>Barangay Name</Req>
                  <select
                    required
                    value={createForm.barangay}
                    disabled={!createForm.municipality}
                    onChange={(e) => setCreateForm({ ...createForm, barangay: e.target.value })}
                  >
                    <option value="">{createForm.municipality ? 'Select barangay…' : 'Select municipality first…'}</option>
                    {barangaysForMunicipality(createForm.municipality).map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                    {createForm.barangay && createForm.municipality && !barangaysForMunicipality(createForm.municipality).includes(createForm.barangay) && (
                      <option value={createForm.barangay}>{createForm.barangay}</option>
                    )}
                  </select>
                </label>
              </div>

              <div className="form-row">
                <label>
                  Barangay Type
                  <select value={createForm.barangayType} onChange={(e) => setCreateForm({ ...createForm, barangayType: e.target.value })}>
                    <option value="">Select type…</option>
                    {BARANGAY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    {createForm.barangayType && !BARANGAY_TYPES.includes(createForm.barangayType) && (
                      <option value={createForm.barangayType}>{createForm.barangayType}</option>
                    )}
                  </select>
                </label>
                <label>
                  <Req required>Affected Families</Req>
                  <input
                    type="number"
                    min="0"
                    required
                    value={createForm.affectedFamilies}
                    onChange={(e) => setCreateForm({ ...createForm, affectedFamilies: e.target.value })}
                  />
                </label>
              </div>

              <label>
                <Req required>Complete Address</Req>
                <input
                  required
                  value={createForm.address}
                  onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                  placeholder="Purok / Street, Barangay, City, Province"
                />
              </label>

              <NeedsPicker
                value={createForm.needs}
                onChange={(needs) => setCreateForm({ ...createForm, needs })}
                note={createForm.notes}
                onNoteChange={(notes) => setCreateForm({ ...createForm, notes })}
              />

              <p className="form-section-title" style={{ marginTop: '1.25rem', marginBottom: '0.85rem', fontWeight: 650, color: 'var(--admin-text)' }}>
                Representative Information
              </p>

              <NameFields
                value={createForm.nameParts}
                onChange={(nameParts) => setCreateForm({ ...createForm, nameParts })}
              />

              <label>
                <Req required>Position / Role</Req>
                <select
                  required
                  value={createForm.representativePosition}
                  onChange={(e) => setCreateForm({ ...createForm, representativePosition: e.target.value })}
                >
                  <option value="">Select position…</option>
                  {REPRESENTATIVE_POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                  {createForm.representativePosition && !REPRESENTATIVE_POSITIONS.includes(createForm.representativePosition) && (
                    <option value={createForm.representativePosition}>{createForm.representativePosition}</option>
                  )}
                </select>
              </label>

              <div className="form-row">
                <label>
                  <Req required>Contact Number</Req>
                  <input
                    required
                    value={createForm.representativePhone}
                    onChange={(e) => setCreateForm({ ...createForm, representativePhone: e.target.value })}
                    placeholder="+63 9xx xxx xxxx"
                  />
                </label>
                <label>
                  <Req required>Email Address</Req>
                  <input
                    type="email"
                    required
                    value={createForm.representativeEmail}
                    onChange={(e) => setCreateForm({ ...createForm, representativeEmail: e.target.value })}
                    placeholder="poc@email.com"
                  />
                </label>
              </div>

              {modalMode === 'create' && (
                <label>
                  Status
                  <select value={createForm.status} onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}>
                    {CREATE_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
              )}

              <div className="admin-modal__actions">
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Barangay'}
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setModalMode(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
