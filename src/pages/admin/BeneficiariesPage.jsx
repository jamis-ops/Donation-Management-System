import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Mail, Plus, Users, Activity, Clock, AlertCircle, Eye, Pencil, Trash2, Send, CheckCircle2, XCircle, Shield, Building, Phone, HeartHandshake, FileText, UserCheck, MapPin } from 'lucide-react'
import { beneficiariesApi, assistanceRequestsApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { useFilters } from '../../hooks/useFilters'
import { MUNICIPALITIES, barangaysForMunicipality } from '../../constants/locations'
import { BARANGAY_TYPES as FALLBACK_BARANGAY_TYPES, REPRESENTATIVE_POSITIONS } from '../../constants/options'
import PageHeader from '../../components/admin/shared/PageHeader'
import DataTable from '../../components/admin/shared/DataTable'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import FilterBar from '../../components/admin/shared/FilterBar'
import ModalHeader from '../../components/admin/shared/ModalHeader'
import Req from '../../components/shared/Req'
import NameFields from '../../components/shared/NameFields'
import NeedsPicker from '../../components/shared/NeedsPicker'
import { useCatalogOptions } from '../../hooks/useCatalogOptions'
import { CatalogFieldLabel } from '../../components/admin/shared/CatalogQuickAdd'
import { NEEDS as FALLBACK_NEEDS } from '../../constants/options'
import ApiState from '../../components/admin/shared/ApiState'
import { emptyNameParts, formatFullName, parseFullName } from '../../utils/personName'
import { BENEFICIARIES_CHANGED, notifyBeneficiariesChanged } from '../../utils/beneficiariesSync'
import { canInviteBarangay, canStartOrRefreshInvite, isAwaitingBarangayApproval } from '../../utils/barangayInvite'
import { notify, suppressNotificationToast } from '../../utils/toast'
import { useHashScroll, useQueryFocus } from '../../hooks/useDeepLinkFocus'
import PhoneInput from '../../components/shared/PhoneInput'
import { phoneError, emailError } from '../../utils/validation'
import LoadingSpinner, { LoadingHeart, InlineLoader } from '../../components/shared/LoadingSpinner'

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
  const [searchParams, setSearchParams] = useSearchParams()
  const [deepLink, setDeepLink] = useState(() => ({
    id: searchParams.get('id') || searchParams.get('beneficiaryId') || '',
    status: searchParams.get('status') || '',
    focus: searchParams.get('focus') || '',
  }))
  const { data: beneficiaries, loading, error, reload, setData } = useApiList(() => beneficiariesApi.list())
  const { data: requests } = useApiList(() => assistanceRequestsApi.list())

  useEffect(() => {
    const id = searchParams.get('id') || searchParams.get('beneficiaryId') || ''
    const status = searchParams.get('status') || ''
    const focus = searchParams.get('focus') || ''
    if (id || status || focus) {
      setDeepLink({ id, status, focus })
    }
  }, [searchParams])

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

  const contentReady = !loading && Array.isArray(beneficiaries)
  const shouldScrollTable = Boolean(
    deepLink.focus === 'pending' || deepLink.status,
  ) && !deepLink.id
  useHashScroll({ enabled: contentReady, deps: [beneficiaries?.length] })
  useQueryFocus(contentReady && shouldScrollTable, 'barangays-table')

  useEffect(() => {
    if (!contentReady || !deepLink) return
    const { id: focusId, status: focusStatus, focus } = deepLink
    if (!focusId && !focusStatus && !focus) return

    if (focusStatus) {
      filters.setValue('status', focusStatus)
    } else if (focus === 'pending') {
      filters.setValue('status', 'Pending Approval')
    }
    if (focusId) {
      const row = beneficiaries.find((b) => String(b.dbId) === String(focusId))
      if (row) {
        const review = isAwaitingBarangayApproval(row)
          ? '?tab=overview&focus=review#barangay-overview-review'
          : ''
        navigate(`/admin/beneficiaries/${row.dbId}${review}`, { replace: false })
        setDeepLink({ id: '', status: '', focus: '' })
        return
      }
    }

    const next = new URLSearchParams(searchParams)
    next.delete('status')
    next.delete('focus')
    next.delete('id')
    next.delete('beneficiaryId')
    setSearchParams(next, { replace: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentReady, deepLink.id, deepLink.status, deepLink.focus])

  const [modalMode, setModalMode] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [createForm, setCreateForm] = useState(emptyCreateForm)
  const [inviteForm, setInviteForm] = useState(emptyInviteForm)
  const [saving, setSaving] = useState(false)
  const [actionBusyId, setActionBusyId] = useState(null)

  // Navigation section: 'overview' (Barangay Overview) vs 'submissions' (Barangay Registration Submissions)
  const [activeSection, setActiveSection] = useState(() => (
    searchParams.get('section') === 'submissions' || searchParams.get('focus') === 'pending' ? 'submissions' : 'overview'
  ))

  // Registration submission approval flow states
  const [viewingSubmission, setViewingSubmission] = useState(null)
  const [approveTarget, setApproveTarget] = useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [useCustomPass, setUseCustomPass] = useState(false)
  const [customPassword, setCustomPassword] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')

  const { options: barangayTypeOptions, applyList: applyBarangayTypes } = useCatalogOptions(
    'barangay_types',
    FALLBACK_BARANGAY_TYPES,
  )
  const { options: needOptions, applyList: applyNeeds } = useCatalogOptions('needs', FALLBACK_NEEDS)

  const pendingSubmissions = useMemo(
    () => (beneficiaries || []).filter((b) => isAwaitingBarangayApproval(b) || b.status === 'Pending Approval'),
    [beneficiaries],
  )

  const totalBeneficiaries = beneficiaries.length
  const activeBeneficiaries = beneficiaries.filter((b) => b.status === 'Active' || b.status === 'Approved').length
  const pendingInvites = pendingSubmissions.length

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
    if (['Active', 'Approved'].includes(row.status)) {
      notify.warning('Approved barangays are locked from full edit. Open the barangay profile to review details, or suspend the partnership first.')
      navigate(`/admin/beneficiaries/${row.dbId}`)
      return
    }
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

  const handleApprove = (e, row) => {
    if (e) e.stopPropagation()
    setApproveTarget(row)
    setCustomPassword('')
    setUseCustomPass(false)
  }

  const handleConfirmApprove = async () => {
    if (!approveTarget) return
    if (useCustomPass && customPassword.trim().length < 6) {
      notify.warning('Custom password must be at least 6 characters long.')
      return
    }
    setActionBusyId(approveTarget.dbId)
    try {
      const payload = useCustomPass && customPassword.trim() ? { password: customPassword.trim() } : {}
      const res = await beneficiariesApi.approve(approveTarget.dbId, payload)
      if (res?.credentialsSent) {
        suppressNotificationToast('beneficiary_credentials')
        notify.success(res?.message || `Login credentials successfully emailed to ${approveTarget.representativeEmail || 'representative'}.`)
      } else if (res?.accountCreated) {
        notify.warning(
          [
            res?.message || 'Barangay approved and account was created.',
            res?.temporaryPassword ? `Temporary password: ${res.temporaryPassword}` : '',
            res?.mailError ? `Email note: ${res.mailError}` : 'Credential email delivery failed.',
          ].filter(Boolean).join(' '),
        )
      } else {
        notify.success(res?.message || 'Barangay approved.')
        if (res?.mailError) notify.warning(res.mailError)
      }
      notifyBeneficiariesChanged()
      setApproveTarget(null)
      setViewingSubmission(null)
      reload()
    } catch (err) {
      notify.error(err.message || 'Failed to approve barangay')
    } finally {
      setActionBusyId(null)
    }
  }

  const handleReject = (e, row) => {
    if (e) e.stopPropagation()
    setRejectTarget(row)
    setRejectionReason('')
  }

  const handleConfirmReject = async () => {
    if (!rejectTarget) return
    setActionBusyId(rejectTarget.dbId)
    try {
      const res = await beneficiariesApi.reject(rejectTarget.dbId, { reason: rejectionReason })
      notify.success(res?.message || 'Application rejected.')
      notifyBeneficiariesChanged()
      setRejectTarget(null)
      setViewingSubmission(null)
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
    const phoneMsg = phoneError(createForm.representativePhone, { required: true })
    if (phoneMsg) {
      notify.warning(phoneMsg)
      return
    }
    const emailMsg = emailError(createForm.representativeEmail)
    if (emailMsg) {
      notify.warning(emailMsg)
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
      key: 'priority',
      label: 'Priority',
      render: (row) => {
        const priority = openPriorityMap[row.dbId]
        if (!priority) return <span className={priorityClass('none')}>None</span>
        return <span className={priorityClass(priority)}>{priority}</span>
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
                  title="Approve application"
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
              </div>
            ) : (
              <>
                <button type="button" className="icon-btn" title="View details" onClick={() => handleRowClick(row)}>
                  <Eye size={16} />
                </button>
                {!['Active', 'Approved'].includes(row.status) && (
                  <button type="button" className="icon-btn" title="Edit" onClick={() => openEdit(row)}>
                    <Pencil size={16} />
                  </button>
                )}
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
          <button type="button" className="btn btn--outline" onClick={openInvite}>
            <Mail size={16} /> Invite Barangay
          </button>
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
        <div
          className="beneficiaries-stat beneficiaries-stat--clickable"
          onClick={() => setActiveSection('submissions')}
          title="Click to view pending barangay registration submissions"
          role="button"
          tabIndex={0}
        >
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

      {/* ── Section Navigation Tabs ── */}
      <div className="barangay-section-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 'overview'}
          className={`barangay-section-tab${activeSection === 'overview' ? ' barangay-section-tab--active' : ''}`}
          onClick={() => setActiveSection('overview')}
        >
          <Building size={16} />
          <span>Barangay Overview</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 'submissions'}
          className={`barangay-section-tab${activeSection === 'submissions' ? ' barangay-section-tab--active' : ''}`}
          onClick={() => setActiveSection('submissions')}
        >
          <Shield size={16} />
          <span>Barangay Registration Submissions</span>
          {pendingSubmissions.length > 0 && (
            <span className="barangay-section-tab__badge">{pendingSubmissions.length}</span>
          )}
        </button>
      </div>

      {/* ── SECTION 1: BARANGAY OVERVIEW (Table List) ── */}
      {activeSection === 'overview' && (
        <div id="barangays-overview-section">
          <FilterBar
            controller={filters}
            searchPlaceholder="Search by barangay, municipality, or representative…"
          />

          <div id="barangays-table">
            <ApiState loading={loading} error={error} onRetry={reload}>
              <DataTable
                columns={columns}
                data={filters.filtered}
                onRowClick={handleRowClick}
                rowClassName={(row) => (isAwaitingBarangayApproval(row) ? 'data-table__row--pending-review' : '')}
                pageSize={10}
                resetKey={`${filters.search}|${JSON.stringify(filters.values)}`}
              />
            </ApiState>
          </div>
        </div>
      )}

      {/* ── SECTION 2: BARANGAY REGISTRATION SUBMISSIONS ── */}
      {activeSection === 'submissions' && (
        <section className="barangay-submissions-section" aria-label="Registration applications">
          <div className="barangay-submissions-section__header">
            <div className="barangay-submissions-section__title-group">
              <Shield size={18} className="barangay-submissions-section__icon" />
              <h2>Barangay Registration Submissions</h2>
              <span className="barangay-submissions-section__count">
                {pendingSubmissions.length} {pendingSubmissions.length === 1 ? 'submission' : 'submissions'} pending approval
              </span>
            </div>
            <span className="barangay-submissions-section__flow-hint">
              Invitation Sent → Form Submitted → <strong>Admin Review</strong> → Credentials Emailed
            </span>
          </div>

          {pendingSubmissions.length === 0 ? (
            <div className="barangay-submissions-empty">
              <CheckCircle2 size={18} className="text-success" />
              <span>No pending registration submissions to review at this time.</span>
            </div>
          ) : (
            <div className="barangay-submissions-grid">
              {pendingSubmissions.map((sub) => (
                <div key={sub.dbId || sub.id} className="barangay-submission-card">
                  <div className="barangay-submission-card__top">
                    <div>
                      <h3 className="barangay-submission-card__title">{sub.barangay || sub.name}</h3>
                      <span className="barangay-submission-card__sub">
                        <MapPin size={12} className="inline-icon" /> {sub.municipality || 'Cebu'} • {sub.barangayType || 'Barangay'}
                      </span>
                    </div>
                    <StatusBadge status="Pending Approval" />
                  </div>

                  <div className="barangay-submission-card__details">
                    <div className="barangay-submission-row">
                      <span className="barangay-submission-label">Representative</span>
                      <strong className="barangay-submission-val">{sub.representativeName || '—'}</strong>
                    </div>
                    {sub.representativePosition && (
                      <div className="barangay-submission-row">
                        <span className="barangay-submission-label">Position</span>
                        <span className="barangay-submission-val">{sub.representativePosition}</span>
                      </div>
                    )}
                    <div className="barangay-submission-row">
                      <span className="barangay-submission-label">Contact Email</span>
                      <a href={`mailto:${sub.representativeEmail}`} className="barangay-contact-link text-xs">
                        <Mail size={12} /> {sub.representativeEmail || '—'}
                      </a>
                    </div>
                    {sub.representativePhone && (
                      <div className="barangay-submission-row">
                        <span className="barangay-submission-label">Phone</span>
                        <a href={`tel:${sub.representativePhone}`} className="barangay-contact-link text-xs">
                          <Phone size={12} /> {sub.representativePhone}
                        </a>
                      </div>
                    )}
                    <div className="barangay-submission-row">
                      <span className="barangay-submission-label">Affected Families</span>
                      <span className="barangay-submission-val font-semibold">{Number(sub.affectedFamilies || 0).toLocaleString()} families</span>
                    </div>
                  </div>

                  <div className="barangay-submission-card__actions">
                    <button
                      type="button"
                      className="btn btn--outline btn--sm"
                      onClick={() => setViewingSubmission(sub)}
                      title="View complete submitted details"
                    >
                      <Eye size={14} /> View Details
                    </button>
                    <button
                      type="button"
                      className="btn approval-overlay__btn-approve btn--sm"
                      onClick={() => handleApprove(null, sub)}
                      title="Approve registration and send login credentials"
                    >
                      <CheckCircle2 size={14} /> Approve
                    </button>
                    <button
                      type="button"
                      className="btn approval-overlay__btn-reject btn--sm"
                      onClick={() => handleReject(null, sub)}
                      title="Reject registration"
                    >
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

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
                  <CatalogFieldLabel catalog="barangay_types" onUpdated={applyBarangayTypes}>
                    Barangay Type
                  </CatalogFieldLabel>
                  <select value={createForm.barangayType} onChange={(e) => setCreateForm({ ...createForm, barangayType: e.target.value })}>
                    <option value="">Select type…</option>
                    {barangayTypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                    {createForm.barangayType && !barangayTypeOptions.includes(createForm.barangayType) && (
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
                options={needOptions}
                showQuickAdd
                onCatalogUpdated={applyNeeds}
                initialVisible={6}
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
                  <PhoneInput
                    required
                    value={createForm.representativePhone}
                    onChange={(representativePhone) => setCreateForm({ ...createForm, representativePhone })}
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

      {/* ── Submission Details Modal ── */}
      {viewingSubmission && (
        <div className="admin-modal-overlay" onClick={() => setViewingSubmission(null)}>
          <div className="admin-modal admin-modal--extra-wide barangay-submission-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title="Barangay Registration Submission Review"
              onClose={() => setViewingSubmission(null)}
            />
            <div className="barangay-submission-modal__body">
              {/* Header Summary */}
              <div className="barangay-submission-modal__header">
                <div className="barangay-submission-modal__title-section">
                  <MapPin size={20} className="barangay-submission-modal__location-icon" />
                  <div>
                    <h2 className="barangay-submission-modal__barangay-name">
                      {viewingSubmission.barangay || viewingSubmission.name}
                    </h2>
                    <p className="barangay-submission-modal__location">
                      {viewingSubmission.municipality}, Cebu
                      {viewingSubmission.barangayType && <> • {viewingSubmission.barangayType}</>}
                    </p>
                  </div>
                </div>
                <div className="barangay-submission-modal__status-section">
                  <StatusBadge status="Pending Approval" />
                  <span className="barangay-submission-modal__submitted-by">
                    Submitted by {viewingSubmission.representativeName || 'Barangay Representative'}
                  </span>
                </div>
              </div>

              {/* Quick Stats Bar */}
              <div className="barangay-submission-modal__stats">
                <div className="barangay-submission-modal__stat">
                  <Users size={16} className="barangay-submission-modal__stat-icon" />
                  <div>
                    <span className="barangay-submission-modal__stat-value">
                      {Number(viewingSubmission.affectedFamilies || 0).toLocaleString()}
                    </span>
                    <span className="barangay-submission-modal__stat-label">Affected Families</span>
                  </div>
                </div>
                <div className="barangay-submission-modal__stat">
                  <HeartHandshake size={16} className="barangay-submission-modal__stat-icon" />
                  <div>
                    <span className="barangay-submission-modal__stat-value">
                      {normalizeNeeds(viewingSubmission.needs).length}
                    </span>
                    <span className="barangay-submission-modal__stat-label">Types of Needs</span>
                  </div>
                </div>
                <div className="barangay-submission-modal__stat">
                  <Shield size={16} className="barangay-submission-modal__stat-icon" />
                  <div>
                    <span className="barangay-submission-modal__stat-value">Pending</span>
                    <span className="barangay-submission-modal__stat-label">Awaiting Review</span>
                  </div>
                </div>
              </div>

              {/* Main Content Grid */}
              <div className="barangay-submission-modal__grid">
                {/* Representative Details Card */}
                <div className="barangay-submission-modal__card">
                  <div className="barangay-submission-modal__card-header">
                    <UserCheck size={18} className="barangay-submission-modal__card-icon" />
                    <h3>Representative Details</h3>
                  </div>
                  <div className="barangay-submission-modal__card-body">
                    <div className="barangay-submission-modal__info-item">
                      <span className="barangay-submission-modal__info-label">Full Name</span>
                      <span className="barangay-submission-modal__info-value">
                        {viewingSubmission.representativeName || '—'}
                      </span>
                    </div>
                    <div className="barangay-submission-modal__info-item">
                      <span className="barangay-submission-modal__info-label">Position / Role</span>
                      <span className="barangay-submission-modal__info-value">
                        {viewingSubmission.representativePosition || '—'}
                      </span>
                    </div>
                    <div className="barangay-submission-modal__info-item">
                      <span className="barangay-submission-modal__info-label">Contact Number</span>
                      <div className="barangay-submission-modal__info-value">
                        {viewingSubmission.representativePhone ? (
                          <a href={`tel:${viewingSubmission.representativePhone}`} className="barangay-submission-modal__link">
                            <Phone size={14} /> {viewingSubmission.representativePhone}
                          </a>
                        ) : (
                          '—'
                        )}
                      </div>
                    </div>
                    <div className="barangay-submission-modal__info-item">
                      <span className="barangay-submission-modal__info-label">Email Address</span>
                      <div className="barangay-submission-modal__info-value">
                        {viewingSubmission.representativeEmail ? (
                          <a href={`mailto:${viewingSubmission.representativeEmail}`} className="barangay-submission-modal__link">
                            <Mail size={14} /> <span className="barangay-submission-modal__email-text">{viewingSubmission.representativeEmail}</span>
                          </a>
                        ) : (
                          '—'
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Location & Profile Card */}
                <div className="barangay-submission-modal__card">
                  <div className="barangay-submission-modal__card-header">
                    <Building size={18} className="barangay-submission-modal__card-icon" />
                    <h3>Location & Profile</h3>
                  </div>
                  <div className="barangay-submission-modal__card-body">
                    <div className="barangay-submission-modal__info-item">
                      <span className="barangay-submission-modal__info-label">Barangay Name</span>
                      <span className="barangay-submission-modal__info-value barangay-submission-modal__info-value--highlight">
                        {viewingSubmission.barangay || viewingSubmission.name || '—'}
                      </span>
                    </div>
                    <div className="barangay-submission-modal__info-item">
                      <span className="barangay-submission-modal__info-label">Municipality / City</span>
                      <span className="barangay-submission-modal__info-value">
                        {viewingSubmission.municipality || '—'}
                      </span>
                    </div>
                    <div className="barangay-submission-modal__info-item">
                      <span className="barangay-submission-modal__info-label">Classification</span>
                      <span className="barangay-submission-modal__info-value">
                        {viewingSubmission.barangayType || 'Not specified'}
                      </span>
                    </div>
                    <div className="barangay-submission-modal__info-item">
                      <span className="barangay-submission-modal__info-label">Complete Address</span>
                      <span className="barangay-submission-modal__info-value">
                        {viewingSubmission.address || 'Not provided'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Relief Needs & Impact Section */}
              <div className="barangay-submission-modal__section">
                <div className="barangay-submission-modal__section-header">
                  <HeartHandshake size={18} />
                  <h3>Relief Needs & Community Impact</h3>
                </div>
                <div className="barangay-submission-modal__section-body">
                  <div className="barangay-submission-modal__needs-row">
                    <div className="barangay-submission-modal__needs-col">
                      <span className="barangay-submission-modal__section-label">Types of Assistance Needed</span>
                      {normalizeNeeds(viewingSubmission.needs).length > 0 ? (
                        <div className="barangay-submission-modal__pills">
                          {normalizeNeeds(viewingSubmission.needs).map((n) => (
                            <span key={n} className="barangay-submission-modal__pill">{n}</span>
                          ))}
                        </div>
                      ) : (
                        <p className="barangay-submission-modal__empty">No specific needs listed</p>
                      )}
                    </div>
                    <div className="barangay-submission-modal__needs-col barangay-submission-modal__needs-col--narrow">
                      <span className="barangay-submission-modal__section-label">Affected Families</span>
                      <div className="barangay-submission-modal__affected-families">
                        <Users size={24} className="barangay-submission-modal__affected-icon" />
                        <span className="barangay-submission-modal__affected-value">
                          {Number(viewingSubmission.affectedFamilies || 0).toLocaleString()}
                        </span>
                        <span className="barangay-submission-modal__affected-unit">families</span>
                      </div>
                    </div>
                  </div>
                  {viewingSubmission.notes && (
                    <div className="barangay-submission-modal__notes">
                      <span className="barangay-submission-modal__section-label">
                        <FileText size={14} /> Additional Notes & Instructions
                      </span>
                      <p className="barangay-submission-modal__notes-text">{viewingSubmission.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="barangay-submission-modal__actions">
                <button
                  type="button"
                  className="btn btn--lg approval-overlay__btn-approve"
                  onClick={() => {
                    setViewingSubmission(null)
                    handleApprove(null, viewingSubmission)
                  }}
                  disabled={actionBusyId === viewingSubmission.dbId}
                >
                  <CheckCircle2 size={18} /> Approve & Send Credentials
                </button>
                <button
                  type="button"
                  className="btn btn--lg approval-overlay__btn-reject"
                  onClick={() => {
                    setViewingSubmission(null)
                    handleReject(null, viewingSubmission)
                  }}
                  disabled={actionBusyId === viewingSubmission.dbId}
                >
                  <XCircle size={18} /> Reject Application
                </button>
                <button
                  type="button"
                  className="btn btn--lg btn--ghost"
                  onClick={() => setViewingSubmission(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Approve & Provision Credentials Modal ── */}
      {approveTarget && (
        <div className="admin-modal-overlay" onClick={() => setApproveTarget(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title="Approve Partnership & Send Credentials" onClose={() => setApproveTarget(null)} />
            <form onSubmit={(e) => { e.preventDefault(); handleConfirmApprove() }}>
              <div className="barangay-approve-summary">
                <CheckCircle2 size={24} className="text-success" />
                <div>
                  <strong>{approveTarget.barangay || approveTarget.name} ({approveTarget.municipality})</strong>
                  <p className="text-sm text-muted" style={{ margin: '0.1rem 0 0' }}>
                    Representative: {approveTarget.representativeName || 'Representative'} ({approveTarget.representativeEmail})
                  </p>
                </div>
              </div>

              <p className="text-sm text-muted" style={{ margin: '1rem 0 0.85rem' }}>
                Approving this registration creates a Barangay Portal user account linked to <strong>{approveTarget.representativeEmail}</strong> and automatically emails login credentials.
              </p>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="checkbox-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={useCustomPass}
                    onChange={(e) => setUseCustomPass(e.target.checked)}
                  />
                  <span>Assign custom initial password (otherwise auto-generates secure password)</span>
                </label>
                {useCustomPass && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <input
                      type="password"
                      required={useCustomPass}
                      minLength={6}
                      value={customPassword}
                      onChange={(e) => setCustomPassword(e.target.value)}
                      placeholder="Enter custom initial password (min 6 chars)"
                    />
                  </div>
                )}
              </div>

              <div className="admin-modal__actions">
                <button
                  type="submit"
                  className="btn approval-overlay__btn-approve"
                  disabled={actionBusyId === approveTarget.dbId}
                >
                  {actionBusyId === approveTarget.dbId ? (
                    <>
                      <InlineLoader size={16} /> Approving & Sending Credentials...
                    </>
                  ) : (
                    'Approve & Send Credentials'
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setApproveTarget(null)}
                  disabled={actionBusyId === approveTarget.dbId}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Reject Application Modal ── */}
      {rejectTarget && (
        <div className="admin-modal-overlay" onClick={() => setRejectTarget(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title="Reject Partnership Application" onClose={() => setRejectTarget(null)} />
            <form onSubmit={(e) => { e.preventDefault(); handleConfirmReject() }}>
              <div className="barangay-reject-summary">
                <XCircle size={24} className="text-danger" />
                <div>
                  <strong>{rejectTarget.barangay || rejectTarget.name} ({rejectTarget.municipality})</strong>
                  <p className="text-sm text-muted" style={{ margin: '0.1rem 0 0' }}>Applicant: {rejectTarget.representativeEmail}</p>
                </div>
              </div>

              <label style={{ margin: '1rem 0 1.25rem', display: 'block' }}>
                <span>Reason for Rejection (Optional)</span>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why the application was rejected…"
                />
              </label>

              <div className="admin-modal__actions">
                <button
                  type="submit"
                  className="btn approval-overlay__btn-reject"
                  disabled={actionBusyId === rejectTarget.dbId}
                >
                  {actionBusyId === rejectTarget.dbId ? 'Rejecting…' : 'Reject Application'}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setRejectTarget(null)}
                  disabled={actionBusyId === rejectTarget.dbId}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
