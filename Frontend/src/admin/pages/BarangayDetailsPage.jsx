import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Mail, Trash2, FileText, Truck, Package,
  User, Calendar, Check, Eye, X, Shield, Upload, CheckCircle2, XCircle,
  Building, Phone, UserCheck, HeartHandshake, MapPin, Clock, Users, Activity, Tag
} from 'lucide-react'
import {
  beneficiariesApi,
  assistanceRequestsApi,
  distributionsApi,
  allocationsApi,
} from '../../api/resources'
import { useCatalogOptions } from '../../hooks/useCatalogOptions'
import { NEEDS as FALLBACK_NEEDS } from '../../constants/options'
import { useApiList } from '../../hooks/useApiList'
import StatusBadge from '../components/shared/StatusBadge'
import ApiState from '../components/shared/ApiState'
import ModalHeader from '../components/shared/ModalHeader'
import Req from '../../components/shared/Req'
import NeedsPicker from '../../components/shared/NeedsPicker'
import ReliefRequestModal from '../components/requests/ReliefRequestModal'
import { usePagination, DEFAULT_PAGE_SIZE } from '../../hooks/usePagination'
import Pagination from '../components/shared/Pagination'
import { notifyBeneficiariesChanged } from '../../utils/beneficiariesSync'
import { canInviteBarangay, isAwaitingBarangayApproval } from '../../utils/barangayInvite'
import { notify, suppressNotificationToast, confirmAction, showSuccessModal } from '../../utils/confirm'
import { useHashScroll, useQueryFocus } from '../../hooks/useDeepLinkFocus'
import PhoneInput from '../../components/shared/PhoneInput'
import PasswordRequirements from '../../components/shared/PasswordRequirements'
import { phoneError, passwordError } from '../../utils/validation'
import { useLoading } from '../../context/LoadingContext'

function normalizeNeeds(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((n) => n.trim()).filter(Boolean)
  }
  return []
}

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

function formatDateClean(raw) {
  if (!raw) return '—'
  try {
    const d = new Date(raw)
    if (isNaN(d.getTime())) return raw
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return raw
  }
}

function CleanItemsSummary({ summary }) {
  const [expanded, setExpanded] = useState(false)

  if (!summary || !summary.trim()) {
    return <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.8rem' }}>Relief goods package</span>
  }

  // Split items by semicolon (common delimiter in distribution packages)
  const items = summary
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)

  if (items.length === 0) {
    return <span style={{ color: '#475569', fontSize: '0.82rem' }}>{summary}</span>
  }

  const showAll = expanded || items.length <= 2
  const visibleItems = showAll ? items : items.slice(0, 2)
  const remainingCount = items.length - 2

  return (
    <div 
      style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', alignItems: 'center', width: '100%', maxWidth: '240px' }}
      title={summary}
    >
      {visibleItems.map((item, idx) => (
        <span
          key={idx}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            color: '#334155',
            borderRadius: '4px',
            padding: '0.15rem 0.4rem',
            fontSize: '0.73rem',
            lineHeight: 1.2,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            maxWidth: expanded ? '240px' : '145px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={item}
        >
          <Package size={10} style={{ marginRight: '0.25rem', color: '#94a3b8', flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item}</span>
        </span>
      ))}
      {!showAll && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setExpanded(true)
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: '#fef2f2',
            border: '1px solid #fee2e2',
            color: '#af101a',
            borderRadius: '4px',
            padding: '0.15rem 0.38rem',
            fontSize: '0.71rem',
            fontWeight: 650,
            cursor: 'pointer',
            lineHeight: 1.2,
          }}
        >
          +{remainingCount} more
        </button>
      )}
      {expanded && items.length > 2 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setExpanded(false)
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            color: '#64748b',
            borderRadius: '4px',
            padding: '0.15rem 0.35rem',
            fontSize: '0.71rem',
            fontWeight: 600,
            cursor: 'pointer',
            lineHeight: 1.2,
          }}
        >
          Show less
        </button>
      )}
    </div>
  )
}

export default function BarangayDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: beneficiaries, loading: benLoading, reload: reloadBen } = useApiList(() => beneficiariesApi.list())
  const beneficiary = useMemo(
    () => beneficiaries.find((b) => Number(b.dbId) === Number(id) || String(b.id) === String(id)),
    [beneficiaries, id],
  )

  const { data: assistanceRequests, loading: reqLoading, reload: reloadReqs } = useApiList(() => assistanceRequestsApi.list())
  const requests = useMemo(() => {
    if (!beneficiary) return []
    return assistanceRequests.filter((r) => Number(r.beneficiaryId) === Number(beneficiary.dbId))
  }, [assistanceRequests, beneficiary])

  const { data: distributions, loading: distLoading } = useApiList(() => distributionsApi.list())
  const bDistributions = useMemo(() => {
    if (!beneficiary) return []
    return distributions.filter((d) => Number(d.beneficiaryId) === Number(beneficiary.dbId))
  }, [distributions, beneficiary])

  const [searchParams, setSearchParams] = useSearchParams()
  const { showLoading, hideLoading } = useLoading()
  const [reqFilter, setReqFilter] = useState('All')
  const [selectedRequestModal, setSelectedRequestModal] = useState(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [approveConfirm, setApproveConfirm] = useState(false)
  const [rejectConfirm, setRejectConfirm] = useState(false)
  const [useCustomPass, setUseCustomPass] = useState(false)
  const [customPassword, setCustomPassword] = useState('')
  const [editForm, setEditForm] = useState({})
  const { options: needOptions, applyList: applyNeeds } = useCatalogOptions('needs', FALLBACK_NEEDS)

  useEffect(() => {
    if (!beneficiary) return
    setEditForm({
      barangay: beneficiary.barangay || beneficiary.name || '',
      municipality: beneficiary.municipality || '',
      address: beneficiary.address || '',
      needs: normalizeNeeds(beneficiary.needs),
      representativeName: beneficiary.representativeName || '',
      representativePosition: beneficiary.representativePosition || '',
      representativePhone: beneficiary.representativePhone || '',
      representativeEmail: beneficiary.representativeEmail || '',
      notes: beneficiary.notes || '',
      status: beneficiary.status || 'Pending Approval',
    })
  }, [beneficiary])

  const requestFromNavigation = useMemo(() => {
    const requestId = searchParams.get('requestId')
    if (!requestId) return null
    return requests.find((request) => (
      String(request.dbId) === String(requestId) || String(request.id) === String(requestId)
    )) || null
  }, [requests, searchParams])

  const activeRequestModal = selectedRequestModal || requestFromNavigation

  const closeSelectedRequest = () => {
    setSelectedRequestModal(null)
    if (!searchParams.has('requestId')) return
    const next = new URLSearchParams(searchParams)
    next.delete('requestId')
    setSearchParams(next, { replace: true })
  }

  const pageReady = Boolean(beneficiary) && !benLoading
  const focusReview = searchParams.get('focus') === 'review'
    || Boolean(beneficiary && isAwaitingBarangayApproval(beneficiary))
  useHashScroll({ enabled: pageReady })
  useQueryFocus(pageReady && focusReview, 'barangay-overview-review')

  const loading = benLoading || reqLoading || distLoading

  const filteredRequests = useMemo(() => {
    if (reqFilter === 'All') return requests
    return requests.filter((r) => {
      if (reqFilter === 'Pending') {
        return ['Pending', 'Pending Verification', 'Pending Review', 'Under Review'].includes(r.status)
      }
      return r.status === reqFilter
    })
  }, [requests, reqFilter])

  const requestsPaging = usePagination(filteredRequests, DEFAULT_PAGE_SIZE, `req|${reqFilter}`)
  const distributionsPaging = usePagination(bDistributions, 5, 'dist')

  if (loading && !beneficiary) {
    return <ApiState loading message="Loading barangay details…" />
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
    const phoneMsg = phoneError(editForm.representativePhone, { required: true, allowInternational: true })
    if (phoneMsg) {
      notify.warning(phoneMsg)
      return
    }
    setSaving(true)
    showLoading('Saving…')
    try {
      const { status: _status, ...profileFields } = editForm
      await beneficiariesApi.update(beneficiary.dbId, {
        ...profileFields,
        status: beneficiary.status,
      })
      await reloadBen()
      notify.success('Barangay updated.')
      showSuccessModal('Barangay details successfully updated.')
      setIsEditModalOpen(false)
    } catch (err) {
      notify.error(err.message)
    } finally {
      hideLoading()
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    const name = beneficiary.barangay || beneficiary.name || 'this barangay'
    const ok = await confirmAction({
      title: 'Delete Barangay',
      message: `Permanently delete "${name}"? This removes the barangay and its linked records. This cannot be undone.`,
      confirmText: 'Delete Barangay',
      type: 'danger',
    })
    if (!ok) return

    try {
      showLoading('Deleting barangay…')
      const removedId = beneficiary.dbId
      await beneficiariesApi.remove(removedId)
      notifyBeneficiariesChanged({ removedId })
      notify.success('Barangay deleted.')
      showSuccessModal('Successfully deleted.')
      navigate('/admin/beneficiaries', { replace: true, state: { beneficiariesRefresh: Date.now() } })
    } catch (err) {
      notify.error(err.message || 'Failed to delete barangay')
    } finally {
      hideLoading()
    }
  }

  const handleSendInvite = async () => {
    if (!beneficiary.representativeEmail) {
      notify.warning('Add a representative email before sending an invite.')
      return
    }
    const name = beneficiary.barangay || beneficiary.name || 'this barangay'
    const ok = await confirmAction({
      title: 'Send Barangay Invitation',
      message: `Send partnership invitation email to ${beneficiary.representativeEmail} for ${name}?`,
      confirmText: 'Send Invitation',
      type: 'primary',
    })
    if (!ok) return

    showLoading('Sending invitation…')
    try {
      const res = await beneficiariesApi.reinvite(beneficiary.dbId, {
        email: beneficiary.representativeEmail,
        barangay: beneficiary.barangay || beneficiary.name,
        municipality: beneficiary.municipality || '',
      })
      if (res?.invitationSent) {
        notify.success(res?.message || `Invitation emailed to ${beneficiary.representativeEmail}.`)
        showSuccessModal('Credentials successfully sent.')
      } else {
        notify.warning(res?.mailError || res?.message || 'Invitation saved, but email could not be delivered.')
        if (res?.inviteUrl) notify.info(`Invite link: ${res.inviteUrl}`, 8000)
        showSuccessModal('Successfully updated.')
      }
      await reloadBen()
    } catch (err) {
      notify.error(err.message || 'Failed to send invitation')
    } finally {
      hideLoading()
    }
  }

  const handleApprove = async () => {
    if (useCustomPass) {
      const pwErr = passwordError(customPassword, { fieldLabel: 'Custom password' })
      if (pwErr) {
        notify.warning(pwErr)
        return
      }
    }
    setApproveConfirm(false)
    setActionBusy(true)
    showLoading('Approving partnership…')
    try {
      const payload = {
        acceptedTerms: true,
        acceptedPrivacy: true,
        acceptedPolicies: true,
        ...(useCustomPass && customPassword.trim() ? { password: customPassword.trim() } : {}),
      }
      const res = await beneficiariesApi.approve(beneficiary.dbId, payload)
      if (res?.credentialsSent) {
        suppressNotificationToast('beneficiary_credentials')
        notify.success(res?.message || 'Login credentials have been successfully sent to the approved Barangay.')
        showSuccessModal('Credentials successfully sent.')
      } else if (res?.accountCreated) {
        notify.warning(
          [
            res?.message || 'Barangay approved and account was created.',
            res?.temporaryPassword ? `Temporary password (share securely): ${res.temporaryPassword}` : '',
            res?.mailError ? `Email note: ${res.mailError}` : 'Credential email was not delivered.',
          ].filter(Boolean).join(' '),
        )
        showSuccessModal('Successfully approved.')
      } else {
        notify.success(res?.message || 'Barangay approved.')
        if (res?.mailError) notify.warning(res.mailError)
        showSuccessModal('Successfully approved.')
      }
      notifyBeneficiariesChanged()
      await reloadBen()
    } catch (err) {
      notify.error(err.message || 'Failed to approve barangay')
    } finally {
      hideLoading()
      setActionBusy(false)
    }
  }

  const handleReject = async () => {
    setRejectConfirm(false)
    setActionBusy(true)
    showLoading('Rejecting…')
    try {
      const res = await beneficiariesApi.reject(beneficiary.dbId)
      notify.success(res?.message || 'Application rejected.')
      showSuccessModal('Successfully rejected.')
      notifyBeneficiariesChanged()
      await reloadBen()
    } catch (err) {
      notify.error(err.message || 'Failed to reject application')
    } finally {
      hideLoading()
      setActionBusy(false)
    }
  }

  // Operational metrics without generic affected families
  const completedDistributions = bDistributions.filter((d) => ['Completed', 'Done', 'Distributed'].includes(d.status)).length
  const pendingRequestsCount = requests.filter((r) => !CLOSED_STATUSES.includes(r.status)).length
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
              This will create a Barangay account for <strong>{barangayName}</strong> and email login credentials to <strong>{beneficiary.representativeEmail || 'the representative'}</strong>.
            </p>
            <div className="form-group" style={{ margin: '0.85rem 0', textAlign: 'left' }}>
              <label className="checkbox-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                <input
                  type="checkbox"
                  checked={useCustomPass}
                  onChange={(e) => setUseCustomPass(e.target.checked)}
                />
                <span>Assign custom initial password</span>
              </label>
              {useCustomPass && (
                <div style={{ marginTop: '0.4rem' }}>
                  <input
                    type="password"
                    minLength={8}
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    placeholder="Enter custom password (min 8 chars, upper, lower, number, symbol)"
                  />
                  <PasswordRequirements password={customPassword} />
                </div>
              )}
            </div>

            <div className="approval-confirm__actions" style={{ marginTop: '1.25rem' }}>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => setApproveConfirm(false)}
                disabled={actionBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn approval-overlay__btn-approve"
                onClick={handleApprove}
                disabled={actionBusy}
              >
                {actionBusy ? 'Approving…' : 'Yes, Approve & Send Credentials'}
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
                className="btn btn--danger"
                onClick={() => setRejectConfirm(false)}
                disabled={actionBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn approval-overlay__btn-reject"
                onClick={handleReject}
                disabled={actionBusy}
              >
                {actionBusy ? 'Rejecting…' : 'Yes, Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Barangay Details Content ── */}
      <div className="barangay-details__content">

        {/* 1. Barangay Header */}
        <div className="barangay-details__top">
          <div className="barangay-details__identity">
            <button
              type="button"
              className="btn btn--ghost btn--sm barangay-details__back"
              onClick={() => navigate('/admin/beneficiaries')}
              aria-label="Back to barangays overview"
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

        {/* 2. Operational Summary Metrics (NO general affected families) */}
        <div className="barangay-metrics">
          <div className="barangay-metric">
            <div className="barangay-metric__header">
              <FileText size={15} className="barangay-metric__icon" />
              <span className="barangay-metric__label">Relief Requests</span>
            </div>
            <span className="barangay-metric__value">{requests.length}</span>
          </div>

          <div className="barangay-metric">
            <div className="barangay-metric__header">
              <Clock size={15} className="barangay-metric__icon" />
              <span className="barangay-metric__label">Active Requests</span>
            </div>
            <span className="barangay-metric__value">{pendingRequestsCount}</span>
          </div>

          <div className="barangay-metric">
            <div className="barangay-metric__header">
              <CheckCircle2 size={15} className="barangay-metric__icon" />
              <span className="barangay-metric__label">Delivered Packs</span>
            </div>
            <span className="barangay-metric__value">{completedDistributions}</span>
          </div>

          <div className="barangay-metric">
            <div className="barangay-metric__header">
              <Truck size={15} className="barangay-metric__icon" />
              <span className="barangay-metric__label">Distributions</span>
            </div>
            <span className="barangay-metric__value">{bDistributions.length}</span>
          </div>
        </div>

        {/* 3. Centralized Overview Layout */}
        <div className="barangay-overview" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          
          {/* Partnership Registration Awaiting Approval Banner */}
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

          {/* 3-Card Barangay Information Grid */}
          <div className="barangay-overview-grid">
            
            {/* Card 1: Representative Details */}
            <div className="barangay-overview-card">
              <div className="barangay-overview-card__header">
                <UserCheck size={16} className="barangay-overview-card__icon" />
                <h3>Representative Details</h3>
              </div>
              <div className="barangay-overview-card__body">
                <div className="barangay-info-row">
                  <span className="barangay-info-label">Name</span>
                  <span className="barangay-info-value">{beneficiary.representativeName || '—'}</span>
                </div>
                <div className="barangay-info-row">
                  <span className="barangay-info-label">Position</span>
                  <span className="barangay-info-value">{beneficiary.representativePosition || '—'}</span>
                </div>
                <div className="barangay-info-row">
                  <span className="barangay-info-label">Phone</span>
                  <span className="barangay-info-value">
                    {beneficiary.representativePhone ? (
                      <a href={`tel:${beneficiary.representativePhone}`} className="barangay-contact-link">
                        <Phone size={13} /> {beneficiary.representativePhone}
                      </a>
                    ) : '—'}
                  </span>
                </div>
                <div className="barangay-info-row">
                  <span className="barangay-info-label">Email</span>
                  <span className="barangay-info-value">
                    {beneficiary.representativeEmail ? (
                      <a href={`mailto:${beneficiary.representativeEmail}`} className="barangay-contact-link">
                        <Mail size={13} /> {beneficiary.representativeEmail}
                      </a>
                    ) : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Barangay Profile & Location (NO affected families row) */}
            <div className="barangay-overview-card">
              <div className="barangay-overview-card__header">
                <Building size={16} className="barangay-overview-card__icon" />
                <h3>Barangay Profile</h3>
              </div>
              <div className="barangay-overview-card__body">
                <div className="barangay-info-row">
                  <span className="barangay-info-label">Municipality / City</span>
                  <span className="barangay-info-value">{beneficiary.municipality || '—'}</span>
                </div>
                <div className="barangay-info-row">
                  <span className="barangay-info-label">Address</span>
                  <span className="barangay-info-value">{beneficiary.address || '—'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Relief Requests Section (Centralized in Overview) */}
          <section className="barangay-overview-section" style={{
            background: 'var(--admin-surface, #ffffff)',
            borderRadius: '12px',
            border: '1px solid var(--admin-border, #e2e8f0)',
            padding: '1.15rem 1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--admin-brand, #af101a)', flexShrink: 0, lineHeight: 1 }}>
                  <HeartHandshake size={19} />
                </span>
                <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
                  Relief Requests
                </h3>
                <span className="badge badge--neutral" style={{ fontWeight: 650, lineHeight: 1 }}>
                  {requests.length}
                </span>
              </div>

              {/* Status Filter Chips */}
              <div className="barangay-chip-filters" style={{ margin: 0 }}>
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
            </div>

            {filteredRequests.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '2.5rem 1rem',
                color: '#64748b',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px dashed #cbd5e1',
              }}>
                <FileText size={28} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                <p style={{ margin: 0, fontWeight: 500, fontSize: '0.9rem' }}>
                  {reqFilter === 'All' ? 'No relief requests filed for this barangay yet.' : `No ${reqFilter.toLowerCase()} requests found.`}
                </p>
              </div>
            ) : (
              <div style={{ width: '100%', overflowX: 'auto' }}>
                <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', tableLayout: 'auto' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '0.55rem 0.5rem', fontWeight: 650, color: '#475569', whiteSpace: 'nowrap', width: '14%' }}>Request ID</th>
                      <th style={{ padding: '0.55rem 0.5rem', fontWeight: 650, color: '#475569', width: '13%' }}>Calamity</th>
                      <th style={{ padding: '0.55rem 0.5rem', fontWeight: 650, color: '#475569', textAlign: 'center', whiteSpace: 'nowrap', width: '16%' }}>Affected Families</th>
                      <th style={{ padding: '0.55rem 0.5rem', fontWeight: 650, color: '#475569', width: '12%' }}>Priority</th>
                      <th style={{ padding: '0.55rem 0.5rem', fontWeight: 650, color: '#475569', width: '16%' }}>Status</th>
                      <th style={{ padding: '0.55rem 0.5rem', fontWeight: 650, color: '#475569', whiteSpace: 'nowrap', width: '14%' }}>Date</th>
                      <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontWeight: 650, color: '#475569', width: '15%' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requestsPaging.pageItems.map((req) => {
                      const reqCalamity = (req.calamityTags && req.calamityTags[0])
                        || (req.notes?.match(/Calamity\/Program:\s*([^\n\r]+)/i)?.[1]?.trim())
                        || req.reason
                        || 'General'
                      const reqFamilies = Number(req.affectedFamilies || 0)

                      return (
                        <tr 
                          key={req.dbId || req.id} 
                          style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                          onClick={() => setSelectedRequestModal(req)}
                          className="table-row-hover"
                        >
                          <td style={{ padding: '0.65rem 0.5rem', fontWeight: 650, color: '#0f172a', whiteSpace: 'nowrap' }}>
                            {req.id}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', color: '#334155' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                              {reqCalamity}
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', whiteSpace: 'nowrap', textAlign: 'center' }}>
                            <span style={{
                              fontWeight: 700,
                              color: '#af101a',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.35rem',
                              lineHeight: 1,
                              verticalAlign: 'middle',
                            }}>
                              <Users size={13} style={{ flexShrink: 0, display: 'block' }} />
                              <span style={{ lineHeight: 1 }}>{reqFamilies.toLocaleString()}</span>
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem' }}>
                            {req.priority && <StatusBadge status={req.priority} />}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem' }}>
                            <StatusBadge status={req.status} />
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', color: '#64748b', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                            {formatDateClean(req.date || req.requestDate)}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button
                              type="button"
                              className="btn btn--outline btn--xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedRequestModal(req)
                              }}
                              style={{ fontSize: '0.73rem', padding: '0.25rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                            >
                              <Eye size={12} style={{ flexShrink: 0 }} /> View Details
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {requestsPaging.totalPages > 1 && (
                  <div style={{ marginTop: '0.85rem' }}>
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
                  </div>
                )}
              </div>
            )}
          </section>

          {/* 5. Distributions & Logistics Fulfillment Section (Centralized in Overview) */}
          <section className="barangay-overview-section" style={{
            background: 'var(--admin-surface, #ffffff)',
            borderRadius: '12px',
            border: '1px solid var(--admin-border, #e2e8f0)',
            padding: '1.15rem 1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--admin-brand, #af101a)', flexShrink: 0, lineHeight: 1 }}>
                  <Truck size={19} />
                </span>
                <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
                  Distributions & Fulfillment
                </h3>
                <span className="badge badge--neutral" style={{ fontWeight: 650, lineHeight: 1 }}>
                  {bDistributions.length}
                </span>
              </div>
            </div>

            {bDistributions.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '2rem 1rem',
                color: '#64748b',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px dashed #cbd5e1',
              }}>
                <Truck size={26} style={{ margin: '0 auto 0.4rem', opacity: 0.5 }} />
                <p style={{ margin: 0, fontWeight: 500, fontSize: '0.88rem' }}>
                  No distribution events recorded for this barangay yet.
                </p>
              </div>
            ) : (
              <div style={{ width: '100%', overflowX: 'auto' }}>
                <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', tableLayout: 'auto' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '0.55rem 0.5rem', fontWeight: 650, color: '#475569', width: '18%' }}>Event / Code</th>
                      <th style={{ padding: '0.55rem 0.5rem', fontWeight: 650, color: '#475569', width: '12%' }}>Program</th>
                      <th style={{ padding: '0.55rem 0.5rem', fontWeight: 650, color: '#475569', width: '28%' }}>Items Summary</th>
                      <th style={{ padding: '0.55rem 0.5rem', fontWeight: 650, color: '#475569', whiteSpace: 'nowrap', width: '13%' }}>Date</th>
                      <th style={{ padding: '0.55rem 0.5rem', fontWeight: 650, color: '#475569', width: '14%' }}>Status</th>
                      <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontWeight: 650, color: '#475569', width: '15%' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {distributionsPaging.pageItems.map((dist) => (
                      <tr 
                        key={dist.dbId || dist.id} 
                        style={{ borderBottom: '1px solid #f1f5f9' }}
                      >
                        <td style={{ padding: '0.65rem 0.5rem', fontWeight: 650, color: '#0f172a' }}>
                          <span style={{ display: 'inline-block', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={dist.eventName || dist.id}>
                            {dist.eventName || dist.id}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.5rem', color: '#334155' }}>
                          {dist.program || 'General Relief'}
                        </td>
                        <td style={{ padding: '0.65rem 0.5rem' }}>
                          <CleanItemsSummary summary={dist.itemsSummary} />
                        </td>
                        <td style={{ padding: '0.65rem 0.5rem', color: '#64748b', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                          {formatDateClean(dist.date || dist.distributionDate)}
                        </td>
                        <td style={{ padding: '0.65rem 0.5rem' }}>
                          <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-start' }}>
                            <StatusBadge status={dist.status} />
                            {dist.proofStatus && <StatusBadge status={dist.proofStatus} />}
                          </div>
                        </td>
                        <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            className="btn btn--outline btn--xs"
                            onClick={() => navigate('/admin/distributions')}
                            style={{ fontSize: '0.73rem', padding: '0.25rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                          >
                            View in Logistics &rarr;
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {distributionsPaging.totalPages > 1 && (
                  <div style={{ marginTop: '0.85rem' }}>
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
                  </div>
                )}
              </div>
            )}
          </section>

        </div>{/* end .barangay-overview */}

      </div>{/* end .barangay-details__content */}

      {/* ── Relief Request Modal (Shared clean UI) ── */}
      {activeRequestModal && (
        <ReliefRequestModal
          request={activeRequestModal}
          onClose={closeSelectedRequest}
          onUpdated={async () => {
            await reloadReqs()
          }}
          onDeleted={async () => {
            await reloadReqs()
          }}
        />
      )}

      {/* ── Edit Barangay Modal (NO affected families input) ── */}
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
                    allowInternational
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
                <button type="button" className="btn btn--danger" onClick={() => setIsEditModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn--success" disabled={saving}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
