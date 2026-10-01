import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Download,
  FileText,
  Eye,
  CheckCircle2,
  XCircle,
  Search,
  Copy,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  AlertCircle,
  FileCheck,
  TrendingUp,
  CreditCard,
  Calendar,
  Package,
  Users,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import StatusBadge from '../../admin/components/shared/StatusBadge'
import ApiState from '../../admin/components/shared/ApiState'
import ModalHeader from '../../admin/components/shared/ModalHeader'
import DonationUpdatesTimeline from '../../components/shared/DonationUpdatesTimeline'
import InKindIntakeModal from '../../admin/components/shared/InKindIntakeModal'
import { donationsApi } from '../../api/resources'
import { getAuthenticatedFileUrl } from '../../api/auth'
import { useApiList } from '../../hooks/useApiList'
import { usePagination, DEFAULT_PAGE_SIZE } from '../../hooks/usePagination'
import Pagination from '../../admin/components/shared/Pagination'
import { notify, confirmAction, showSuccessModal } from '../../utils/confirm'
import { notifyBadgesChanged } from '../../utils/badgeSync'
import { useLoading } from '../../context/LoadingContext'

function showVerifyResultModal(res, status) {
  if (!res?.accountCreated) {
    showSuccessModal(`Status successfully updated to: ${status}. ${res?.message || ''}`.trim())
    return
  }
  if (res.credentialsSent) {
    showSuccessModal(`Status successfully updated to: ${status}. Donor portal account created and login credentials were emailed.`)
    return
  }
  notify.warning(`Status successfully updated to: ${status}. Donor portal account was created, but the credential email was NOT delivered.`)
}

export default function StaffDonationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { showLoading, hideLoading } = useLoading()
  const { data: donations = [], loading, error, reload } = useApiList(() => donationsApi.list())

  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || 'All')
  const [typeFilter, setTypeFilter] = useState(() => searchParams.get('type') || 'All')
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || searchParams.get('q') || '')

  const [selected, setSelected] = useState(null)
  const [modalTab, setModalTab] = useState('details')
  const [intakeModalDonation, setIntakeModalDonation] = useState(null)
  const [busy, setBusy] = useState(false)
  const [proofZoomModal, setProofZoomModal] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [proofImgError, setProofImgError] = useState(false)

  // Sync state with URL params if they change externally
  useEffect(() => {
    const s = searchParams.get('status')
    if (s && s !== statusFilter) setStatusFilter(s)
    const t = searchParams.get('type')
    if (t && t !== typeFilter) setTypeFilter(t)
    const q = searchParams.get('search') || searchParams.get('q')
    if (q && q !== searchQuery) setSearchQuery(q)
  }, [searchParams])

  // Count summaries
  const counts = useMemo(() => {
    const all = donations.length
    const pending = donations.filter((d) => d.status === 'Pending Verification' || d.status === 'Pending').length
    const verified = donations.filter((d) => ['Verified', 'In Inventory', 'Allocated', 'Distributed', 'Completed'].includes(d.status)).length
    const monetary = donations.filter((d) => d.type === 'Monetary').length
    const inKind = donations.filter((d) => d.type === 'In-Kind').length
    return { all, pending, verified, monetary, inKind }
  }, [donations])

  // Filtered donations
  const filteredDonations = useMemo(() => {
    return donations.filter((d) => {
      // Status filter
      if (statusFilter === 'Pending' || statusFilter === 'Pending Verification') {
        if (d.status !== 'Pending Verification' && d.status !== 'Pending') return false
      } else if (statusFilter === 'Verified') {
        if (!['Verified', 'In Inventory', 'Allocated', 'Distributed', 'Completed'].includes(d.status)) return false
      } else if (statusFilter === 'Rejected') {
        if (d.status !== 'Rejected') return false
      }

      // Type filter
      if (typeFilter !== 'All' && d.type !== typeFilter) return false

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchCode = d.trackingCode?.toLowerCase().includes(q)
        const matchDonor = d.donor?.toLowerCase().includes(q)
        const matchEmail = d.donorEmail?.toLowerCase().includes(q)
        const matchCategory = d.category?.toLowerCase().includes(q)
        const matchItems = d.itemsDescription?.toLowerCase().includes(q)
        const matchRef = d.paymentReference?.toLowerCase().includes(q)
        if (!matchCode && !matchDonor && !matchEmail && !matchCategory && !matchItems && !matchRef) {
          return false
        }
      }

      return true
    })
  }, [donations, statusFilter, typeFilter, searchQuery])

  const paging = usePagination(filteredDonations, DEFAULT_PAGE_SIZE, `${statusFilter}|${typeFilter}|${searchQuery}`)

  const handleSelectDonation = (item) => {
    setSelected(item)
    setModalTab('details')
    setProofZoomModal(false)
    setZoomLevel(1)
    setProofImgError(false)
  }

  // Handle Verify Action (Monetary & general)
  const handleVerify = async (row) => {
    if (row.type === 'In-Kind') {
      setIntakeModalDonation(row)
      return
    }

    const proofNotice = !row.hasProof
      ? '\n\nNote: No digital proof was uploaded by the donor. Proceeding will verify receipt of funds based on manual staff confirmation.'
      : ''

    const ok = await confirmAction({
      title: 'Verify & Confirm Funds',
      message: `Verify monetary donation ${row.trackingCode} (${row.amount}) from ${row.donor}?${proofNotice}`,
      confirmText: 'Verify & Confirm Funds',
      type: 'primary',
    })
    if (!ok) return

    setBusy(true)
    showLoading('Verifying donation and updating records…')
    try {
      const res = await donationsApi.update(row.dbId, { status: 'Completed' })
      const status = res?.data?.status || 'Completed'
      if (res?.accountCreated || res?.credentialsSent) {
        showVerifyResultModal(res, status)
      } else if (res?.message) {
        showSuccessModal(`Status successfully updated to: ${status}. ${res.message}`)
      } else {
        showSuccessModal(`Status successfully updated to: ${status}. Funds confirmed.`)
      }
      reload()
      notifyBadgesChanged()
      if (selected && selected.dbId === row.dbId) {
        setSelected(res?.data || { ...selected, status: 'Verified' })
      }
    } catch (err) {
      notify.error(err.message || 'Failed to verify donation')
    } finally {
      hideLoading()
      setBusy(false)
    }
  }

  // Handle In-Kind Classification & Intake Confirmation
  const handleClassifyInKindConfirm = async (payload) => {
    if (!intakeModalDonation) return
    showLoading('Classifying items into warehouse inventory…')
    setBusy(true)
    try {
      const res = await donationsApi.classifyInKind(intakeModalDonation.dbId, payload)
      const status = res?.data?.status || 'Verified'
      if (res?.accountCreated || res?.credentialsSent) {
        showVerifyResultModal(res, status)
      } else {
        showSuccessModal(`Donation verified and ${res?.totalQuantityAdded || 'items'} added to warehouse inventory.`)
      }
      setIntakeModalDonation(null)
      reload()
      notifyBadgesChanged()
      if (selected && (selected.dbId === intakeModalDonation.dbId || selected.id === intakeModalDonation.id)) {
        setSelected(res?.data || { ...selected, status: 'Verified' })
      }
    } catch (err) {
      notify.error(err.message || 'Failed to classify and verify in-kind donation')
    } finally {
      hideLoading()
      setBusy(false)
    }
  }

  // Handle Reject Action
  const handleReject = async (row) => {
    const ok = await confirmAction({
      title: 'Reject Donation',
      message: `Are you sure you want to reject donation ${row.trackingCode} from ${row.donor}? This will update the status to Rejected and notify the audit trail.`,
      confirmText: 'Reject Donation',
      type: 'danger',
    })
    if (!ok) return

    setBusy(true)
    showLoading('Rejecting donation…')
    try {
      const res = await donationsApi.update(row.dbId, { status: 'Rejected' })
      const status = res?.data?.status || 'Rejected'
      showSuccessModal(`Status successfully updated to: ${status}.`)
      reload()
      notifyBadgesChanged()
      if (selected && selected.dbId === row.dbId) {
        setSelected(res?.data || { ...selected, status: 'Rejected' })
      }
    } catch (err) {
      notify.error(err.message || 'Failed to reject donation')
    } finally {
      hideLoading()
      setBusy(false)
    }
  }

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      <div className="staff-donations-container">
        {/* Metric summary pills */}
        <div className="staff-tasks-summary" style={{ marginBottom: '1.25rem' }}>
          <button
            type="button"
            className={`staff-task-summary-card staff-task-summary-card--clickable ${statusFilter === 'All' ? 'staff-task-summary-card--active' : ''}`}
            onClick={() => setStatusFilter('All')}
          >
            <span className="staff-task-summary-card__value">{counts.all}</span>
            <span className="staff-task-summary-card__label">All Donations</span>
          </button>
          <button
            type="button"
            className={`staff-task-summary-card staff-task-summary-card--clickable ${statusFilter === 'Pending' || statusFilter === 'Pending Verification' ? 'staff-task-summary-card--active' : ''}`}
            onClick={() => setStatusFilter('Pending Verification')}
          >
            <span className="staff-task-summary-card__value" style={{ color: '#AF101A' }}>{counts.pending}</span>
            <span className="staff-task-summary-card__label">Pending Verification</span>
          </button>
          <button
            type="button"
            className={`staff-task-summary-card staff-task-summary-card--clickable ${statusFilter === 'Verified' ? 'staff-task-summary-card--active' : ''}`}
            onClick={() => setStatusFilter('Verified')}
          >
            <span className="staff-task-summary-card__value" style={{ color: '#16a34a' }}>{counts.verified}</span>
            <span className="staff-task-summary-card__label">Verified Funds & Goods</span>
          </button>
          <button
            type="button"
            className={`staff-task-summary-card staff-task-summary-card--clickable ${typeFilter === 'Monetary' ? 'staff-task-summary-card--active' : ''}`}
            onClick={() => setTypeFilter(typeFilter === 'Monetary' ? 'All' : 'Monetary')}
          >
            <span className="staff-task-summary-card__value">{counts.monetary}</span>
            <span className="staff-task-summary-card__label">Monetary</span>
          </button>
          <button
            type="button"
            className={`staff-task-summary-card staff-task-summary-card--clickable ${typeFilter === 'In-Kind' ? 'staff-task-summary-card--active' : ''}`}
            onClick={() => setTypeFilter(typeFilter === 'In-Kind' ? 'All' : 'In-Kind')}
          >
            <span className="staff-task-summary-card__value">{counts.inKind}</span>
            <span className="staff-task-summary-card__label">In-Kind</span>
          </button>
        </div>

        {/* Main Panel */}
        <section className="portal-panel">
          <div className="portal-panel__header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2>Donations Management</h2>
              <span className="portal-panel__hint" style={{ fontSize: '0.85rem' }}>
                Showing {filteredDonations.length} of {donations.length} donations
              </span>
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ width: '280px', position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                <input
                  type="text"
                  className="portal-search-input"
                  style={{
                    paddingLeft: '36px',
                    paddingRight: '12px',
                    width: '100%',
                    height: '38px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                  placeholder="Search code, donor, program..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select
                className="portal-select"
                style={{ height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', background: '#fff', fontSize: '0.85rem' }}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="All">All Types</option>
                <option value="Monetary">Monetary</option>
                <option value="In-Kind">In-Kind</option>
              </select>

              <select
                className="portal-select"
                style={{ height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', background: '#fff', fontSize: '0.85rem' }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="Pending Verification">Pending Verification</option>
                <option value="Verified">Verified</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>

          {filteredDonations.length === 0 ? (
            <div className="portal-empty" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
              <Package size={40} style={{ margin: '0 auto 0.75rem', color: '#94a3b8' }} />
              <p style={{ margin: 0, fontWeight: 600, color: '#334155' }}>No donations found</p>
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Try adjusting your search or filters.</span>
            </div>
          ) : (
            <>
              <div className="portal-table-wrap">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>Tracking Code</th>
                      <th>Donor</th>
                      <th>Type</th>
                      <th>Amount / Items</th>
                      <th>Program / Purpose</th>
                      <th>Status</th>
                      <th>Proof</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paging.pageItems.map((d) => (
                      <tr key={d.dbId || d.id}>
                        <td>
                          <strong style={{ color: '#AF101A', letterSpacing: '0.02em' }}>{d.trackingCode}</strong>
                        </td>
                        <td>
                          <div>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>{d.donor}</div>
                            {d.donorEmail && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{d.donorEmail}</div>}
                          </div>
                        </td>
                        <td>
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: d.type === 'In-Kind' ? '#f1f5f9' : '#ecfdf5',
                            color: d.type === 'In-Kind' ? '#475569' : '#047857',
                            border: `1px solid ${d.type === 'In-Kind' ? '#cbd5e1' : '#a7f3d0'}`
                          }}>
                            {d.type}
                          </span>
                        </td>
                        <td>
                          <strong style={{ color: d.type === 'In-Kind' ? '#1e293b' : '#047857' }}>
                            {d.type === 'In-Kind'
                              ? (d.itemsDescription || d.amount || '—')
                              : (typeof d.amountRaw === 'number'
                                ? `₱${d.amountRaw.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : d.amount)}
                          </strong>
                        </td>
                        <td>{d.category || 'General Support'}</td>
                        <td>
                          <StatusBadge status={d.status} />
                        </td>
                        <td>
                          {d.hasProof ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem', color: '#047857', fontWeight: 600 }}>
                              <FileCheck size={14} /> Attached
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>None</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="btn btn--sm btn--outline"
                              onClick={() => handleSelectDonation(d)}
                              title="View details"
                            >
                              <Eye size={14} /> View
                            </button>
                            {d.status === 'Pending Verification' && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn--sm btn--success"
                                  disabled={busy}
                                  onClick={() => handleVerify(d)}
                                  title={d.type === 'In-Kind' ? 'Verify & Intake Items' : 'Verify & Confirm Funds'}
                                >
                                  <CheckCircle2 size={14} /> {d.type === 'In-Kind' ? 'Intake' : 'Verify'}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn--sm btn--danger"
                                  disabled={busy}
                                  onClick={() => handleReject(d)}
                                  title="Reject donation"
                                >
                                  <XCircle size={14} /> Reject
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Pagination
                page={paging.page}
                totalPages={paging.totalPages}
                total={paging.total}
                startIndex={paging.startIndex}
                endIndex={paging.endIndex}
                onPageChange={paging.setPage}
                className="pagination--portal"
                noun="donations"
              />
            </>
          )}
        </section>

        {/* Donation Details Modal */}
        {selected && (
          <div className="admin-modal-overlay" onClick={() => setSelected(null)}>
            <div className="admin-modal admin-modal--wide donation-detail-modal" onClick={(e) => e.stopPropagation()}>
              <ModalHeader
                title={`Donation Details – ${selected.trackingCode}`}
                onClose={() => setSelected(null)}
              />

              {/* Top Action Bar for Pending Verification */}
              {selected.status === 'Pending Verification' && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.65rem 1rem',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  flexWrap: 'wrap',
                  gap: '0.5rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <StatusBadge status={selected.status} />
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Awaiting staff inspection and verification
                    </span>
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                    <button
                      type="button"
                      className="btn btn--danger btn--sm"
                      onClick={() => handleReject(selected)}
                      disabled={busy}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontWeight: 650,
                        fontSize: '0.82rem',
                        padding: '0.4rem 0.85rem',
                        borderRadius: '7px',
                        backgroundColor: '#dc2626',
                        borderColor: '#dc2626',
                        color: '#ffffff',
                        boxShadow: '0 1px 3px rgba(220, 38, 38, 0.25)',
                        cursor: 'pointer'
                      }}
                    >
                      <XCircle size={15} /> Reject Donation
                    </button>
                    <button
                      type="button"
                      className="btn btn--success btn--sm"
                      onClick={() => handleVerify(selected)}
                      disabled={busy}
                      title={selected.type === 'In-Kind' ? 'Verify & Intake Items' : 'Verify & Confirm Funds'}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontWeight: 650,
                        fontSize: '0.82rem',
                        padding: '0.4rem 0.95rem',
                        borderRadius: '7px',
                        backgroundColor: '#16a34a',
                        borderColor: '#16a34a',
                        color: '#ffffff',
                        boxShadow: '0 1px 3px rgba(22, 163, 74, 0.25)',
                        cursor: 'pointer'
                      }}
                    >
                      <CheckCircle2 size={15} /> {selected.type === 'In-Kind' ? 'Verify & Intake Items' : 'Verify & Confirm Funds'}
                    </button>
                  </div>
                </div>
              )}

              {/* Top Summary Cards (3x2 Grid matching Admin Portal) */}
              <div className="donation-overview" style={{ marginBottom: '1rem' }}>
                {/* 1: Tracking Code */}
                <div className="donation-overview-card">
                  <div className="donation-overview-card__label">
                    <FileCheck size={13} /> Tracking Code
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                    <span className="donation-overview-card__value donation-overview-card__value--primary" style={{ fontSize: '1.1rem' }}>
                      {selected.trackingCode}
                    </span>
                    <button
                      type="button"
                      className="btn btn--ghost btn--icon"
                      style={{ padding: '2px', height: '24px', width: '24px', color: '#64748b' }}
                      title="Copy tracking code"
                      onClick={() => {
                        navigator.clipboard?.writeText(selected.trackingCode)
                        notify.success('Tracking code copied!')
                      }}
                    >
                      <Copy size={13} />
                    </button>
                  </div>
                  <div className="donation-overview-card__subtitle">{selected.type} Donation</div>
                </div>

                {/* 2: Amount / Items */}
                <div className="donation-overview-card">
                  <div className="donation-overview-card__label">
                    <TrendingUp size={13} /> {selected.type === 'In-Kind' ? 'Goods / Items' : 'Monetary Amount'}
                  </div>
                  <div className="donation-overview-card__value" style={{ color: selected.type === 'In-Kind' ? '#1e293b' : '#047857', fontSize: selected.type === 'In-Kind' ? '0.98rem' : '1.2rem' }}>
                    {selected.type === 'In-Kind'
                      ? (selected.itemsDescription || selected.amount || '—')
                      : (typeof selected.amountRaw === 'number'
                        ? `₱${selected.amountRaw.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : selected.amount)}
                  </div>
                  <div className="donation-overview-card__subtitle">
                    {selected.type === 'In-Kind' ? (selected.category || 'Relief Goods') : (selected.paymentMethod || 'Financial Channel')}
                  </div>
                </div>

                {/* 3: Payment Method */}
                <div className="donation-overview-card">
                  <div className="donation-overview-card__label">
                    <CreditCard size={13} /> Payment Method
                  </div>
                  <div className="donation-overview-card__value" style={{ fontSize: '1rem' }}>
                    {selected.paymentMethod || (selected.type === 'In-Kind' ? 'Physical Turnover' : 'Direct Channel')}
                  </div>
                  <div className="donation-overview-card__subtitle">
                    {selected.paymentReference ? `Ref: ${selected.paymentReference}` : 'Payment Channel'}
                  </div>
                </div>

                {/* 4: Date Received */}
                <div className="donation-overview-card">
                  <div className="donation-overview-card__label">
                    <Calendar size={13} /> Date Received
                  </div>
                  <div className="donation-overview-card__value" style={{ fontSize: '1rem' }}>
                    {selected.date}
                  </div>
                  <div className="donation-overview-card__subtitle">{selected.donor}</div>
                </div>

                {/* 5: Donation Type */}
                <div className="donation-overview-card">
                  <div className="donation-overview-card__label">
                    <Package size={13} /> Donation Type
                  </div>
                  <div className="donation-overview-card__value" style={{ fontSize: '1rem' }}>
                    {selected.type}
                  </div>
                  <div className="donation-overview-card__subtitle">{selected.category || 'Relief Aid'}</div>
                </div>

                {/* 6: Status */}
                <div className="donation-overview-card">
                  <div className="donation-overview-card__label">Status</div>
                  <div style={{ marginTop: '4px' }}>
                    <StatusBadge status={selected.status} />
                  </div>
                  <div className="donation-overview-card__subtitle">
                    {selected.status === 'Pending Verification' ? 'Awaiting staff review' : 'System-controlled workflow status'}
                  </div>
                </div>
              </div>

              {/* Tabs inside modal */}
              <div className="donation-tabs" style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '1rem' }}>
                <button
                  type="button"
                  className={`donation-tab ${modalTab === 'details' ? 'donation-tab--active' : ''}`}
                  onClick={() => setModalTab('details')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'none', border: 'none', borderBottom: modalTab === 'details' ? '2px solid #AF101A' : 'none', color: modalTab === 'details' ? '#AF101A' : '#64748b', fontWeight: 600, cursor: 'pointer' }}
                >
                  <FileText size={16} /> Donation Details
                </button>
                <button
                  type="button"
                  className={`donation-tab ${modalTab === 'proof' ? 'donation-tab--active' : ''}`}
                  onClick={() => setModalTab('proof')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'none', border: 'none', borderBottom: modalTab === 'proof' ? '2px solid #AF101A' : 'none', color: modalTab === 'proof' ? '#AF101A' : '#64748b', fontWeight: 600, cursor: 'pointer' }}
                >
                  <FileCheck size={16} /> Proof of Donation
                  <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '10px', background: selected.hasProof ? '#fee2e2' : '#f1f5f9', color: selected.hasProof ? '#AF101A' : '#94a3b8' }}>
                    {selected.hasProof ? '1' : '0'}
                  </span>
                </button>
              </div>

              {/* TAB 1: Donation Details */}
              {modalTab === 'details' && (
                <div>
                  <div className="donation-profile-grid">
                    {/* Left Column: Donor Profile */}
                    <div className="donation-info-section" style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Users size={16} color="#AF101A" /> Donor Profile & Information
                      </h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          background: 'linear-gradient(135deg, #AF101A 0%, #7f0d13 100%)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '1rem',
                          flexShrink: 0
                        }}>
                          {selected.donor?.charAt(0)?.toUpperCase() || 'D'}
                        </div>
                        <div>
                          <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{selected.donor}</strong>
                          {selected.donorType && (
                            <span style={{ marginLeft: '6px', fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: '#e0f2fe', color: '#0369a1' }}>
                              {selected.donorType}
                            </span>
                          )}
                          {selected.donorEmail ? (
                            <div style={{ fontSize: '0.8rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                              <Mail size={12} /> {selected.donorEmail}
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>No email provided</div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0', fontSize: '0.82rem' }}>
                        <div>
                          <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Contact</span>
                          <span style={{ color: '#1e293b' }}>{selected.donorPhone || '—'}</span>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Organization</span>
                          <span style={{ color: '#1e293b' }}>{selected.donorOrganization || 'Individual'}</span>
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Address</span>
                          <span style={{ color: '#1e293b' }}>{selected.donorAddress || 'Not specified'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Payment & Verification Details */}
                    <div className="donation-info-section" style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CreditCard size={16} color="#AF101A" /> Payment & Verification Details
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#64748b', fontWeight: 600 }}>Payment Reference:</span>
                          {selected.paymentReference ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                {selected.paymentReference}
                              </code>
                              <button
                                type="button"
                                className="btn btn--ghost btn--icon"
                                style={{ padding: '2px', height: '22px', width: '22px' }}
                                onClick={() => {
                                  navigator.clipboard?.writeText(selected.paymentReference)
                                  notify.success('Reference copied!')
                                }}
                              >
                                <Copy size={12} />
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>None</span>
                          )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.4rem', borderTop: '1px solid #e2e8f0' }}>
                          <span style={{ color: '#64748b', fontWeight: 600 }}>Proof Attachment:</span>
                          <div>
                            {selected.hasProof ? (
                              <button
                                type="button"
                                className="btn btn--outline btn--sm"
                                onClick={() => setModalTab('proof')}
                                style={{ fontSize: '0.74rem', padding: '2px 8px' }}
                              >
                                <FileCheck size={12} /> View Proof
                              </button>
                            ) : (
                              <span style={{ color: '#dc2626', fontSize: '0.78rem', fontWeight: 600 }}>No Proof Uploaded</span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.4rem', borderTop: '1px solid #e2e8f0' }}>
                          <span style={{ color: '#64748b', fontWeight: 600 }}>Category / Program:</span>
                          <span style={{ fontWeight: 600, color: '#1e293b' }}>{selected.category || 'General Fund'}</span>
                        </div>

                        {selected.notes && (
                          <div style={{ paddingTop: '0.4rem', borderTop: '1px solid #e2e8f0', color: '#475569', fontStyle: 'italic', fontSize: '0.8rem' }}>
                            "{selected.notes}"
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {selected.status !== 'Pending Verification' && selected.relatedProcesses?.length > 0 && (
                    <div className="donation-process-card">
                      <div className="donation-process-card__header">
                        <div><ShieldCheck size={14} /> Related Allocation & Request Progress ({selected.relatedProcesses.length})</div>
                      </div>
                      <div className="donation-process-list">
                        {selected.relatedProcesses.map((process, idx) => (
                          <div className="donation-process-row" key={`${process.allocationId || 'process'}-${idx}`}>
                            <div className="donation-process-row__main">
                              <strong>{process.requestCode || 'Linked Relief Request'}</strong>
                              <span>{process.beneficiaryName || 'Partner Community'} · {process.allocationCode || 'Allocation recorded'}</span>
                            </div>
                            <div className="donation-process-row__statuses">
                              <StatusBadge status={process.requestStatus || process.allocationStatus || 'Allocated'} />
                              {process.distributionStatus && <StatusBadge status={process.distributionStatus} />}
                            </div>
                            {selected.type === 'Monetary' && Number(process.amount) > 0 && (
                              <strong className="donation-process-row__amount">₱{Number(process.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* OCR Extracted Payment Info (if present) */}
                  {selected.aiExtractedAmount !== null && selected.aiExtractedAmount !== undefined && (
                    <div style={{
                      marginBottom: '1rem',
                      padding: '0.75rem 1rem',
                      background: '#f0fdf4',
                      borderRadius: '8px',
                      border: '1px solid #bbf7d0',
                      fontSize: '0.82rem',
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Sparkles size={16} color="#16a34a" />
                        <div>
                          <strong>Extracted Payment Info:</strong> ₱{Number(selected.aiExtractedAmount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          {selected.aiExtractedReference && (
                            <span> • Ref: <code>{selected.aiExtractedReference}</code></span>
                          )}
                          {selected.aiExtractedMethod && (
                            <span> • Channel: <strong>{selected.aiExtractedMethod}</strong></span>
                          )}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        background: selected.aiVerificationStatus === 'verified' ? '#dcfce7' : '#fef3c7',
                        color: selected.aiVerificationStatus === 'verified' ? '#15803d' : '#b45309',
                        border: '1px solid currentColor',
                      }}>
                        {selected.aiVerificationStatus === 'verified' ? '✓ AI Verified' : '⚠ Review Needed'}
                      </span>
                    </div>
                  )}

                  {/* Updates Timeline with Note Posting */}
                  <div style={{ marginTop: '1rem' }}>
                    <DonationUpdatesTimeline
                      donationId={selected.dbId}
                      canPost
                      onPosted={reload}
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: Proof of Donation */}
              {modalTab === 'proof' && (
                selected.hasProof ? (
                  <div className="proof-viewer-card" style={{ padding: '0.5rem 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FileCheck size={18} color="#AF101A" /> Uploaded Payment Proof
                      </h4>
                      <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                        {selected.proofFileName || 'Proof Document'} • {selected.proofFileType || 'File'}
                      </span>
                    </div>

                    <a
                      href={getAuthenticatedFileUrl(selected.proofUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn--outline btn--sm"
                      download={selected.proofFileName || 'proof'}
                    >
                      <Download size={14} /> Download File
                    </a>
                  </div>

                  {/* Interactive Proof Preview Frame */}
                  {selected.proofIsImage || /\.(jpe?g|png|webp|gif)$/i.test(selected.proofFileName || '') ? (
                    !proofImgError ? (
                      <div
                        className="proof-preview-frame"
                        onClick={() => { setProofZoomModal(true); setZoomLevel(1) }}
                        title="Click to Zoom & Inspect Proof"
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          maxHeight: '400px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'zoom-in',
                          position: 'relative'
                        }}
                      >
                        <img
                          src={getAuthenticatedFileUrl(selected.proofUrl)}
                          alt={selected.proofFileName || 'Donation payment proof'}
                          style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain' }}
                          onError={() => setProofImgError(true)}
                        />
                        <div style={{
                          position: 'absolute',
                          bottom: '10px',
                          right: '10px',
                          background: 'rgba(0,0,0,0.65)',
                          color: '#fff',
                          fontSize: '0.75rem',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <ZoomIn size={12} /> Click to Inspect
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                        <AlertCircle size={32} color="#d97706" style={{ margin: '0 auto 0.5rem' }} />
                        <p style={{ margin: 0, fontWeight: 600 }}>Preview Unavailable in Frame</p>
                        <a
                          href={getAuthenticatedFileUrl(selected.proofUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn--primary btn--sm"
                          style={{ marginTop: '0.75rem' }}
                        >
                          <ExternalLink size={14} /> Open File Directly
                        </a>
                      </div>
                    )
                  ) : (
                    <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.5rem', textAlign: 'center' }}>
                      <iframe
                        src={getAuthenticatedFileUrl(selected.proofUrl)}
                        title="Proof PDF Viewer"
                        style={{ width: '100%', height: '400px', border: 'none', borderRadius: '6px' }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: '2.5rem 1rem', textAlign: 'center', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px' }}>
                  <FileText size={36} color="#94a3b8" style={{ margin: '0 auto 0.5rem' }} />
                  <h4 style={{ margin: '0 0 0.35rem', color: '#334155' }}>No Digital Proof Attached</h4>
                  <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#64748b', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
                    The donor did not upload a receipt or screenshot with this submission. Authorized Staff can still verify funds or intake goods directly.
                  </p>
                  {selected.status === 'Pending Verification' && (
                    <button
                      type="button"
                      className="btn btn--success btn--sm"
                      onClick={() => handleVerify(selected)}
                      disabled={busy}
                    >
                      <CheckCircle2 size={14} /> {selected.type === 'In-Kind' ? 'Verify & Intake Items' : 'Verify & Confirm Funds'}
                    </button>
                  )}
                </div>
              ))}

              {/* Modal Action Buttons Footer */}
              <div className="admin-modal__actions" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn--ghost" onClick={() => setSelected(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Proof Zoom Modal */}
        {proofZoomModal && selected?.proofUrl && (
          <div className="admin-modal-overlay" onClick={() => setProofZoomModal(false)} style={{ zIndex: 9999 }}>
            <div
              className="admin-modal"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '90vw', maxHeight: '90vh', width: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <strong style={{ fontSize: '0.9rem' }}>Proof Inspection: {selected.trackingCode}</strong>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn--sm btn--outline"
                    onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 3))}
                    title="Zoom in"
                  >
                    <ZoomIn size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn btn--sm btn--outline"
                    onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.5))}
                    title="Zoom out"
                  >
                    <ZoomOut size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn btn--sm btn--outline"
                    onClick={() => setZoomLevel(1)}
                    title="Reset zoom"
                  >
                    <RotateCcw size={14} />
                  </button>
                  <a
                    href={getAuthenticatedFileUrl(selected.proofUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn--sm btn--primary"
                    download={selected.proofFileName || 'proof'}
                  >
                    <Download size={14} />
                  </a>
                  <button
                    type="button"
                    className="btn btn--ghost btn--icon"
                    onClick={() => setProofZoomModal(false)}
                    style={{ fontSize: '1.2rem', lineHeight: 1 }}
                  >
                    ×
                  </button>
                </div>
              </div>
              <div style={{ overflow: 'auto', textAlign: 'center', maxHeight: '78vh' }}>
                <img
                  src={getAuthenticatedFileUrl(selected.proofUrl)}
                  alt="Zoomed Proof"
                  style={{
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: 'top center',
                    transition: 'transform 0.15s ease',
                    maxWidth: '100%',
                    borderRadius: '4px',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* In-Kind Intake Classification Modal */}
        {intakeModalDonation && (
          <InKindIntakeModal
            isOpen={Boolean(intakeModalDonation)}
            onClose={() => setIntakeModalDonation(null)}
            donation={intakeModalDonation}
            onConfirm={handleClassifyInKindConfirm}
            saving={busy}
          />
        )}
      </div>
    </ApiState>
  )
}
