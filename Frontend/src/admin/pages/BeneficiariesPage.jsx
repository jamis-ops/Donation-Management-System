import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Mail, Users, Activity, Clock, AlertCircle, Eye, CheckCircle2, XCircle, Shield, Building, Phone, HeartHandshake, FileText, UserCheck, MapPin } from 'lucide-react'
import { beneficiariesApi, assistanceRequestsApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { useFilters } from '../../hooks/useFilters'
import { MUNICIPALITIES, barangaysForMunicipality } from '../../constants/locations'
import { REPRESENTATIVE_POSITIONS } from '../../constants/options'
import PageHeader from '../components/shared/PageHeader'
import DataTable from '../components/shared/DataTable'
import StatusBadge from '../components/shared/StatusBadge'
import FilterBar from '../components/shared/FilterBar'
import ModalHeader from '../components/shared/ModalHeader'
import Req from '../../components/shared/Req'
import NameFields from '../../components/shared/NameFields'
import NeedsPicker from '../../components/shared/NeedsPicker'
import { useCatalogOptions } from '../../hooks/useCatalogOptions'
import { NEEDS as FALLBACK_NEEDS } from '../../constants/options'
import ApiState from '../components/shared/ApiState'
import { emptyNameParts, formatFullName } from '../../utils/personName'
import { BENEFICIARIES_CHANGED, notifyBeneficiariesChanged } from '../../utils/beneficiariesSync'
import { canStartOrRefreshInvite, isAwaitingBarangayApproval } from '../../utils/barangayInvite'
import { notify, suppressNotificationToast, showSuccessModal } from '../../utils/confirm'
import { useHashScroll, useQueryFocus } from '../../hooks/useDeepLinkFocus'
import PhoneInput from '../../components/shared/PhoneInput'
import PasswordRequirements from '../../components/shared/PasswordRequirements'
import { phoneError, emailError, passwordError } from '../../utils/validation'
import { useLoading } from '../../context/LoadingContext'
import ReliefRequestModal from '../components/requests/ReliefRequestModal'

/** Create-only statuses — Edit never changes partnership status. */
const CREATE_STATUS_OPTIONS = ['Active', 'Pending Approval', 'Suspended']

const filterConfig = {
  searchKeys: ['id', 'barangay', 'municipality', 'type', 'notes'],
  filters: [
    {
      key: 'status',
      label: 'Status',
      deriveOptions: (rows) => Array.from(new Set(rows.map((row) => row.status).filter(Boolean))).sort(),
    },
    { key: 'priority', label: 'Priority', options: ['Critical', 'High', 'Medium', 'Low'] },
  ],
  dateKey: 'requestDate',
  dateFromLabel: 'From Date',
  dateToLabel: 'To Date',
}

const emptyCreateForm = {
  barangay: '',
  municipality: '',
  address: '',
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

function showInviteResultModal(res, email) {
  if (res?.invitationSent) {
    showSuccessModal(res?.message || `Invitation emailed to ${email || 'barangay contact'}.`)
    return
  }
  const detail = res?.mailError || res?.message || 'Email could not be delivered.'
  notify.warning(detail)
  if (res?.inviteUrl) {
    showSuccessModal(`Invite link: ${res.inviteUrl}`, 'Invitation Link')
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
  const {
    data: requests,
    loading: requestsLoading,
    error: requestsError,
    reload: reloadRequests,
  } = useApiList(() => assistanceRequestsApi.list())
  const { showLoading, hideLoading } = useLoading()

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

  const requestRows = useMemo(() => {
    const barangayMap = new Map((beneficiaries || []).map((row) => [Number(row.dbId), row]))
    return (requests || [])
      .map((request) => {
        const barangay = barangayMap.get(Number(request.beneficiaryId))
        return {
          ...request,
          barangay: barangay?.barangay || barangay?.name || request.beneficiary || '—',
          municipality: barangay?.municipality || request.municipality || '—',
          requestDate: request.requestDate || request.date || request.createdAt || '',
        }
      })
      .sort((a, b) => {
        const dateDiff = new Date(b.requestDate || 0) - new Date(a.requestDate || 0)
        return dateDiff || Number(b.dbId || 0) - Number(a.dbId || 0)
      })
  }, [beneficiaries, requests])

  const filters = useFilters(requestRows, filterConfig)

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
  const activeId = null
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
  const [selectedRequest, setSelectedRequest] = useState(null)

  const { options: needOptions, applyList: applyNeeds } = useCatalogOptions('needs', FALLBACK_NEEDS)

  const pendingSubmissions = useMemo(
    () => (beneficiaries || []).filter((b) => isAwaitingBarangayApproval(b) || b.status === 'Pending Approval'),
    [beneficiaries],
  )

  const dateRangeRequests = useMemo(() => {
    const from = filters.dateFrom
    const to = filters.dateTo
    if (!from && !to) return requestRows
    return requestRows.filter((request) => {
      const requestDate = String(request.requestDate || '').slice(0, 10)
      if (!requestDate) return false
      if (from && requestDate < from) return false
      if (to && requestDate > to) return false
      return true
    })
  }, [requestRows, filters.dateFrom, filters.dateTo])

  const requestStats = useMemo(() => {
    const closed = new Set(['Completed', 'Done', 'Rejected', 'Cancelled'])
    return dateRangeRequests.reduce((summary, request) => {
      summary.total += 1
      if (!closed.has(request.status)) summary.active += 1
      if (['Pending', 'Pending Review', 'Under Review'].includes(request.status)) summary.pending += 1
      if (!closed.has(request.status) && ['High', 'Critical'].includes(request.priority)) summary.urgent += 1
      return summary
    }, { total: 0, active: 0, pending: 0, urgent: 0 })
  }, [dateRangeRequests])

  const reportDateRange = filters.dateFrom || filters.dateTo
    ? `${filters.dateFrom || 'Earliest'} to ${filters.dateTo || 'Latest'}`
    : 'All Dates'

  const reportMeta = [
    { label: 'Relief Request Date Range', value: reportDateRange },
    { label: 'Total Relief Requests', value: requestStats.total },
    { label: 'Active Requests', value: requestStats.active },
    { label: 'Pending Review', value: requestStats.pending },
    { label: 'Urgent Open Needs', value: requestStats.urgent },
  ]

  const openInvite = () => {
    setInviteForm(emptyInviteForm)
    setModalMode('invite')
  }

  const handleRequestRowClick = (request) => {
    const requestId = request.dbId || request.id
    navigate(`/admin/beneficiaries/${request.beneficiaryId}?requestId=${encodeURIComponent(requestId)}`, {
      state: { reliefRequestId: requestId },
    })
  }

  const handleApprove = (e, row) => {
    if (e) e.stopPropagation()
    setApproveTarget(row)
    setCustomPassword('')
    setUseCustomPass(false)
  }

  const handleConfirmApprove = async () => {
    if (!approveTarget) return
    if (useCustomPass) {
      const pwErr = passwordError(customPassword, { fieldLabel: 'Custom password' })
      if (pwErr) {
        notify.warning(pwErr)
        return
      }
    }
    setActionBusyId(approveTarget.dbId)
    showLoading('Saving changes…')
    try {
      const payload = {
        acceptedTerms: true,
        acceptedPrivacy: true,
        acceptedPolicies: true,
        ...(useCustomPass && customPassword.trim() ? { password: customPassword.trim() } : {}),
      }
      const res = await beneficiariesApi.approve(approveTarget.dbId, payload)
      if (res?.credentialsSent) {
        suppressNotificationToast('beneficiary_credentials')
        showSuccessModal(res?.message || `Login credentials successfully emailed to ${approveTarget.representativeEmail || 'representative'}.`)
      } else if (res?.accountCreated) {
        showSuccessModal(
          [
            res?.message || 'Barangay approved and account was created.',
            res?.temporaryPassword ? `Temporary password: ${res.temporaryPassword}` : '',
            res?.mailError ? `Email note: ${res.mailError}` : 'Credential email delivery failed.',
          ].filter(Boolean).join(' '),
        )
      } else {
        showSuccessModal(res?.message || 'Successfully approved.')
        if (res?.mailError) notify.warning(res.mailError)
      }
      notifyBeneficiariesChanged()
      setApproveTarget(null)
      setViewingSubmission(null)
      reload()
    } catch (err) {
      notify.error(err.message || 'Failed to approve barangay')
    } finally {
      hideLoading()
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
    showLoading('Saving changes…')
    try {
      const res = await beneficiariesApi.reject(rejectTarget.dbId, { reason: rejectionReason })
      showSuccessModal(res?.message || 'Successfully rejected.')
      notifyBeneficiariesChanged()
      setRejectTarget(null)
      setViewingSubmission(null)
      reload()
    } catch (err) {
      notify.error(err.message || 'Failed to reject application')
    } finally {
      hideLoading()
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
    showLoading('Sending…')
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
      showInviteResultModal(res, email)
      setModalMode(null)
      setInviteForm(emptyInviteForm)
      notifyBeneficiariesChanged()
      reload()
    } catch (err) {
      notify.error(err.message || 'Failed to send invitation')
    } finally {
      hideLoading()
      setSaving(false)
    }
  }

  const handleSaveCreateEdit = async (e) => {
    e.preventDefault()
    if (!createForm.barangay?.trim() || !createForm.municipality?.trim()) {
      notify.warning('Barangay name and municipality/city are required.')
      return
    }
    const phoneMsg = phoneError(createForm.representativePhone, { required: true, allowInternational: true })
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
    showLoading('Saving…')
    try {
      const representativeName = formatFullName(createForm.nameParts)
      const payload = {
        barangay: createForm.barangay,
        municipality: createForm.municipality,
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
      hideLoading()
      setSaving(false)
    }
  }

  const columns = [
    {
      key: 'id',
      label: 'Relief Request ID',
      render: (row) => <span className="beneficiaries-name">{row.id || `#${row.dbId}`}</span>,
    },
    { key: 'barangay', label: 'Barangay', render: (row) => row.barangay || '—' },
    { key: 'municipality', label: 'Municipality / City', render: (row) => row.municipality || '—' },
    {
      key: 'requestDate',
      label: 'Request Date',
      render: (row) => {
        if (!row.requestDate) return '—'
        const date = new Date(row.requestDate)
        return Number.isNaN(date.getTime()) ? row.requestDate : date.toLocaleDateString('en-US')
      },
    },
    {
      key: 'affectedFamilies',
      label: 'Affected Families',
      render: (row) => Number(row.affectedFamilies || row.familiesAffected || 0).toLocaleString(),
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (row) => <span className={priorityClass(row.priority)}>{row.priority || 'None'}</span>,
    },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="btn btn--sm btn--outline"
            title="View relief request details"
            onClick={() => setSelectedRequest(row)}
          >
            <Eye size={14} /> View
          </button>
        </div>
      ),
    },
  ]

  // Barangay and municipality stay in the complete report definition and row
  // data, but are intentionally omitted from the compact overview table.
  const overviewColumns = columns.filter((column) => !['barangay', 'municipality'].includes(column.key))

  return (
    <div className="beneficiaries-page">
      <PageHeader
        title="Barangays"
        description="Review relief requests across partner barangays or select a barangay to open its full overview."
        actions={(
          <button type="button" className="btn btn--outline" onClick={openInvite}>
            <Mail size={16} /> Invite Barangay
          </button>
        )}
      />

      <div className="beneficiaries-stats">
        <div
          className={`beneficiaries-stat beneficiaries-stat--clickable ${activeSection === 'overview' && filters.values.status === 'all' && filters.values.priority === 'all' ? 'beneficiaries-stat--active' : ''}`}
          onClick={() => {
            setActiveSection('overview')
            filters.setValue('status', 'all')
            filters.setValue('priority', 'all')
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setActiveSection('overview')
              filters.setValue('status', 'all')
              filters.setValue('priority', 'all')
            }
          }}
          title="View all relief requests"
        >
          <div className="beneficiaries-stat__icon beneficiaries-stat__icon--brand"><Users size={22} /></div>
          <div>
            <span className="beneficiaries-stat__value">{requestStats.total}</span>
            <span className="beneficiaries-stat__label">Total Relief Requests</span>
          </div>
        </div>
        <div
          className="beneficiaries-stat"
          title="Open relief requests in the selected date range"
        >
          <div className="beneficiaries-stat__icon beneficiaries-stat__icon--success"><Activity size={22} /></div>
          <div>
            <span className="beneficiaries-stat__value">{requestStats.active}</span>
            <span className="beneficiaries-stat__label">Active Requests</span>
          </div>
        </div>
        <div
          className={`beneficiaries-stat beneficiaries-stat--clickable ${activeSection === 'overview' && filters.values.status === 'Pending Review' ? 'beneficiaries-stat--active' : ''}`}
          onClick={() => {
            setActiveSection('overview')
            filters.setValue('status', filters.values.status === 'Pending Review' ? 'all' : 'Pending Review')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setActiveSection('overview')
              filters.setValue('status', filters.values.status === 'Pending Review' ? 'all' : 'Pending Review')
            }
          }}
          title="Filter by pending relief requests"
          role="button"
          tabIndex={0}
        >
          <div className="beneficiaries-stat__icon beneficiaries-stat__icon--warning"><Clock size={22} /></div>
          <div>
            <span className="beneficiaries-stat__value">{requestStats.pending}</span>
            <span className="beneficiaries-stat__label">Pending Review</span>
          </div>
        </div>
        <div
          className="beneficiaries-stat beneficiaries-stat--clickable"
          onClick={() => filters.setValue('priority', filters.values.priority === 'Critical' ? 'all' : 'Critical')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              filters.setValue('priority', filters.values.priority === 'Critical' ? 'all' : 'Critical')
            }
          }}
          title="View critical open relief requests from barangays"
          role="button"
          tabIndex={0}
        >
          <div className="beneficiaries-stat__icon beneficiaries-stat__icon--danger"><AlertCircle size={22} /></div>
          <div>
            <span className="beneficiaries-stat__value">{requestStats.urgent}</span>
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
            searchPlaceholder="Search request ID, barangay, municipality, or type…"
            exportConfig={{
              filename: 'barangay-relief-requests-report',
              title: 'Barangay Relief Requests Report',
              columns,
              rows: filters.filtered,
              meta: reportMeta,
            }}
          />

          <div id="barangays-table">
            <ApiState
              loading={loading || requestsLoading}
              error={error || requestsError}
              message="Loading relief requests…"
              onRetry={() => { reload(); reloadRequests() }}
            >
              <DataTable
                columns={overviewColumns}
                data={filters.filtered}
                onRowClick={handleRequestRowClick}
                pageSize={10}
                resetKey={`${filters.search}|${JSON.stringify(filters.values)}|${filters.dateFrom}|${filters.dateTo}`}
                noun="relief requests"
                emptyTitle="No relief requests found"
                emptyDescription="There are no relief requests matching the current search and filters."
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
                        <MapPin size={12} className="inline-icon" /> {sub.municipality || 'Cebu'}
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

      {selectedRequest && (
        <ReliefRequestModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onUpdated={async () => {
            await reloadRequests()
          }}
          onDeleted={async () => {
            setSelectedRequest(null)
            await reloadRequests()
          }}
        />
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
                <button type="button" className="btn btn--danger" onClick={() => setModalMode(null)}>Cancel</button>
                <button type="submit" className="btn btn--success" disabled={saving}>
                  {saving ? 'Sending…' : 'Send Invitation'}
                </button>
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
                    allowInternational
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
                <button type="button" className="btn btn--danger" onClick={() => setModalMode(null)}>Cancel</button>
                <button type="submit" className="btn btn--success" disabled={saving}>
                  Save Barangay
                </button>
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
                  <div className="barangay-submission-modal__icon-badge">
                    <MapPin size={22} className="barangay-submission-modal__location-icon" />
                  </div>
                  <div>
                    <h2 className="barangay-submission-modal__barangay-name">
                      {viewingSubmission.barangay || viewingSubmission.name}
                    </h2>
                    <p className="barangay-submission-modal__location">
                      {viewingSubmission.municipality}, Cebu
                    </p>
                  </div>
                </div>
                <div className="barangay-submission-modal__status-section">
                  <div className="barangay-submission-modal__actions-wrap">
                    <StatusBadge status="Pending Approval" />
                    <div className="barangay-submission-modal__btn-group">
                      <button
                        type="button"
                        className="btn btn--sm barangay-submission-modal__btn-reject"
                        onClick={() => {
                          setViewingSubmission(null)
                          handleReject(null, viewingSubmission)
                        }}
                        disabled={actionBusyId === viewingSubmission.dbId}
                      >
                        <XCircle size={15} /> Reject Application
                      </button>
                      <button
                        type="button"
                        className="btn btn--sm barangay-submission-modal__btn-approve"
                        onClick={() => {
                          setViewingSubmission(null)
                          handleApprove(null, viewingSubmission)
                        }}
                        disabled={actionBusyId === viewingSubmission.dbId}
                      >
                        <CheckCircle2 size={15} /> Approve & Send Credentials
                      </button>
                    </div>
                  </div>
                  <span className="barangay-submission-modal__submitted-by">
                    Submitted by {viewingSubmission.representativeName || 'Barangay Representative'}
                  </span>
                </div>
              </div>

              {/* Quick Stats Bar */}
              <div className="barangay-submission-modal__stats">
                <div className="barangay-submission-modal__stat">
                  <MapPin size={16} className="barangay-submission-modal__stat-icon" />
                  <div>
                    <span className="barangay-submission-modal__stat-value">
                      {viewingSubmission.municipality || 'Cebu'}
                    </span>
                    <span className="barangay-submission-modal__stat-label">Municipality / City</span>
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

              {/* Modal Footer / Secondary Actions */}
              <div className="barangay-submission-modal__actions" style={{ justifyContent: 'flex-end' }}>
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

              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
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
                      minLength={8}
                      value={customPassword}
                      onChange={(e) => setCustomPassword(e.target.value)}
                      placeholder="Enter custom initial password (min 8 chars, upper, lower, number, symbol)"
                    />
                    <PasswordRequirements password={customPassword} />
                  </div>
                )}
              </div>
              <div className="admin-modal__actions" style={{ marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => setApproveTarget(null)}
                  disabled={actionBusyId === approveTarget.dbId}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn approval-overlay__btn-approve"
                  disabled={actionBusyId === approveTarget.dbId}
                >
                  {actionBusyId === approveTarget.dbId
                    ? 'Approving & Sending Credentials...'
                    : 'Approve & Send Credentials'}
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
                  type="button"
                  className="btn btn--danger"
                  onClick={() => setRejectTarget(null)}
                  disabled={actionBusyId === rejectTarget.dbId}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn approval-overlay__btn-reject"
                  disabled={actionBusyId === rejectTarget.dbId}
                >
                  {actionBusyId === rejectTarget.dbId ? 'Rejecting…' : 'Reject Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
