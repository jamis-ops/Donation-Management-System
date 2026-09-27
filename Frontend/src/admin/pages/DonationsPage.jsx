import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { 
  Eye, CheckCircle2, Download, FileText, Check, Clock, Package, 
  TrendingUp, Users, MapPin, FileCheck, Printer,
  Calendar, Mail, Award, Coins, CreditCard, ShieldCheck,
  Trash2, ExternalLink, ShoppingCart, XCircle, Copy,
  ZoomIn, ZoomOut, RotateCcw, AlertCircle, X
} from 'lucide-react'
import { donationsApi, beneficiariesApi, assistanceRequestsApi, paymentMethodsApi } from '../../api/resources'
import { getAuthenticatedFileUrl } from '../../api/auth'
import ProcurementModal from '../components/donations/ProcurementModal'
import InKindIntakeModal from '../components/shared/InKindIntakeModal'
import { useApiList } from '../../hooks/useApiList'
import { useFilters } from '../../hooks/useFilters'
import PageHeader from '../components/shared/PageHeader'
import DataTable from '../components/shared/DataTable'
import StatusBadge from '../components/shared/StatusBadge'
import ApiState from '../components/shared/ApiState'
import FilterBar from '../components/shared/FilterBar'
import ModalHeader from '../components/shared/ModalHeader'
import { useBulkSelection } from '../../hooks/useBulkSelection'
import { notify, confirmAction, showSuccessModal } from '../../utils/confirm'
import { notifyBadgesChanged } from '../../utils/badgeSync'
import { useLoading } from '../../context/LoadingContext'
import { printDonationReceipt } from '../../components/shared/printDonationReceipt'
import { DONATION_STATUSES } from '../../constants/options'

const IN_KIND_CATEGORIES = [
  'Food',
  'Water',
  'Clothing',
  'Medicine',
  'Hygiene Kits',
  'Shelter Materials',
  'Educational Support',
  'Other Relief Goods',
]

const MONETARY_CATEGORIES = [
  'Disaster Relief Fund',
  'Emergency Support',
  'Community Kitchen & Feeding',
  'Medical & Dental Missions',
  'Educational Sponsorship',
  'General Fund',
  'Cash',
]

const PAYMENT_METHODS = [
  'GCash',
  'Bank Transfer (BDO)',
  'Bank Transfer (BPI)',
  'Bank Transfer (Metrobank)',
  'Maya',
  'Cash',
  'Check',
  'Credit / Debit Card',
  'PayPal',
]

const emptyForm = {
  donorName: '',
  email: '',
  type: 'In-Kind',
  category: '',
  amount: '',
  items: '',
  paymentMethod: 'GCash',
  paymentReference: '',
  status: 'Pending Verification',
  notes: '',
}

const inKindFilterConfig = {
  searchKeys: ['trackingCode', 'donor', 'donorEmail', 'itemsDescription', 'category'],
  filters: [
    { key: 'status', label: 'Status' },
    { key: 'category', label: 'Category' },
  ],
  dateKey: 'date',
}

const monetaryFilterConfig = {
  searchKeys: ['trackingCode', 'donor', 'donorEmail', 'paymentMethod', 'paymentReference', 'category', 'notes'],
  filters: [
    { key: 'status', label: 'Status' },
    { key: 'paymentMethod', label: 'Payment Method' },
    { key: 'category', label: 'Category' },
  ],
  dateKey: 'date',
}

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

function getMonetaryRemainingBalance(donation) {
  if (!donation || donation.type !== 'Monetary') return 0
  const total = Number(donation.amountRaw || 0)
  const utilized = Number(donation.totalUtilized || 0)
  const remaining = Number(donation.remainingBalance ?? (total - utilized))
  return Number.isFinite(remaining) ? Math.max(0, remaining) : 0
}

function canAllocateMonetaryDonation(donation) {
  return donation?.type === 'Monetary'
    && ['Verified', 'Partially Allocated'].includes(donation.status)
    && getMonetaryRemainingBalance(donation) > 0.009
}

function isMonetaryDonationFullyAllocated(donation) {
  return donation?.type === 'Monetary'
    && (donation.status === 'Allocated' || getMonetaryRemainingBalance(donation) <= 0.009)
}

export default function DonationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeSection = (searchParams.get('tab') || '').toLowerCase() === 'monetary' || (searchParams.get('type') || '').toLowerCase() === 'monetary' ? 'monetary' : 'in-kind'

  const { data: donations, loading, error, reload } = useApiList(() => donationsApi.list())
  const { data: beneficiaries } = useApiList(() => beneficiariesApi.list())
  const { data: assistanceRequests } = useApiList(() => assistanceRequestsApi.list())
  const [selected, setSelected] = useState(null)
  const [procuringDonation, setProcuringDonation] = useState(null)
  const [intakeModalDonation, setIntakeModalDonation] = useState(null)
  const { showLoading, hideLoading } = useLoading()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [modalTab, setModalTab] = useState('details')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionStatus, setActionStatus] = useState('')
  const [paymentMethodOptions, setPaymentMethodOptions] = useState(PAYMENT_METHODS)
  const [proofZoomModal, setProofZoomModal] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [proofImgError, setProofImgError] = useState(false)

  const handleSelectDonation = (donation) => {
    setSelected(donation)
    setModalTab('details')
    setProofZoomModal(false)
    setZoomLevel(1)
    setProofImgError(false)
    setActionStatus(donation?.status || '')
  }

  useEffect(() => {
    paymentMethodsApi.listPublic()
      .then((res) => {
        if (Array.isArray(res?.data) && res.data.length > 0) {
          const names = res.data.map((m) => m.name).filter(Boolean)
          setPaymentMethodOptions(names)
        }
      })
      .catch(() => {})
  }, [])

  // Split donations by type
  const inKindDonations = useMemo(() => (donations || []).filter(d => d.type === 'In-Kind'), [donations])
  const monetaryDonations = useMemo(() => (donations || []).filter(d => d.type === 'Monetary'), [donations])

  // Filter controllers for each section
  const inKindFilters = useFilters(inKindDonations, inKindFilterConfig)
  const monetaryFilters = useFilters(monetaryDonations, monetaryFilterConfig)

  const currentFilters = activeSection === 'in-kind' ? inKindFilters : monetaryFilters

  // Bulk selection controller
  const bulk = useBulkSelection(
    currentFilters.filtered,
    (id) => donationsApi.remove(id),
    reload,
    activeSection === 'in-kind' ? 'in-kind donations' : 'monetary donations',
  )

  // Switch sections and sync with URL search params
  const handleSwitchTab = (tabKey) => {
    const next = new URLSearchParams(searchParams)
    if (tabKey === 'in-kind') {
      next.delete('tab')
    } else {
      next.set('tab', tabKey)
    }
    setSearchParams(next, { replace: true })
    bulk.setSelectedIds([])
  }

  // Open creation modal with tab-appropriate default
  const handleOpenCreateModal = () => {
    setForm({
      ...emptyForm,
      type: activeSection === 'monetary' ? 'Monetary' : 'In-Kind',
      category: activeSection === 'monetary' ? (MONETARY_CATEGORIES[0] || '') : (IN_KIND_CATEGORIES[0] || ''),
      paymentMethod: activeSection === 'monetary' ? (paymentMethodOptions[0] || 'GCash') : '',
      paymentReference: '',
    })
    setShowForm(true)
  }

  // Metric calculations
  const inKindStats = useMemo(() => {
    const total = inKindDonations.length
    const pending = inKindDonations.filter(d => d.status === 'Pending Verification').length
    const active = inKindDonations.filter(d => ['Verified', 'In Inventory', 'Allocated'].includes(d.status)).length
    const completed = inKindDonations.filter(d => ['Distributed', 'Completed'].includes(d.status)).length
    return { total, pending, active, completed }
  }, [inKindDonations])

  const monetaryStats = useMemo(() => {
    const totalCount = monetaryDonations.length
    const totalRaised = monetaryDonations.reduce((sum, d) => {
      const amt = typeof d.amountRaw === 'number' ? d.amountRaw : (parseFloat(String(d.amount).replace(/[^0-9.]/g, '')) || 0)
      return sum + amt
    }, 0)
    const verifiedSum = monetaryDonations
      .filter(d => d.status !== 'Pending Verification' && d.status !== 'Rejected' && d.status !== 'Cancelled')
      .reduce((sum, d) => {
        const amt = typeof d.amountRaw === 'number' ? d.amountRaw : (parseFloat(String(d.amount).replace(/[^0-9.]/g, '')) || 0)
        return sum + amt
      }, 0)
    const pendingCount = monetaryDonations.filter(d => d.status === 'Pending Verification').length
    const avgDonation = totalCount > 0 ? totalRaised / totalCount : 0
    return { totalRaised, verifiedSum, pendingCount, avgDonation }
  }, [monetaryDonations])

  // Lifecycle stages for modal detail
  const getLifecycleStages = (donation) => {
    if (!donation) return []
    const isInKind = donation.type === 'In-Kind'

    const inKindStages = [
      { id: 'submission', label: 'Submission', icon: FileText },
      { id: 'tracking', label: 'Tracking', icon: FileCheck },
      { id: 'verification', label: 'Verification', icon: CheckCircle2 },
      { id: 'inventory', label: 'Inventory Intake', icon: Package },
      { id: 'allocation', label: 'Allocation', icon: TrendingUp },
      { id: 'distribution', label: 'Distribution', icon: MapPin },
      { id: 'certificate', label: 'Certificate / Completion', icon: Award },
    ]

    const monetaryStages = [
      { id: 'submission', label: 'Submission', icon: FileText },
      { id: 'tracking', label: 'Tracking', icon: FileCheck },
      { id: 'verification', label: 'Proof Verification', icon: CheckCircle2 },
      { id: 'allocation', label: 'Fund Allocation', icon: TrendingUp },
      { id: 'certificate', label: 'Official Receipt / Certificate', icon: Award },
    ]

    const stages = isInKind ? inKindStages : monetaryStages

    const inKindStatusMap = {
      'Pending Verification': 1,
      'Verified': 3,
      'In Inventory': 4,
      'Allocated': 5,
      'Distributed': 6,
      'Completed': 7,
    }

    const monetaryStatusMap = {
      'Pending Verification': 1,
      'Verified': 3,
      'Partially Allocated': 4,
      'Allocated': 4,
      'Completed': 5,
    }

    const statusMap = isInKind ? inKindStatusMap : monetaryStatusMap
    const currentStage = statusMap[donation.status] || 0

    return stages.map((stage, index) => ({
      ...stage,
      completed: index < currentStage,
      current: index === currentStage - 1,
    }))
  }

  // Get donor stats
  const getDonorStats = (donation) => {
    if (!donation) return { totalDonations: 0, totalAmount: 0, lastDonation: '-' }
    const donorDonations = donations.filter(d => d.donorEmail && d.donorEmail === donation.donorEmail)
    return {
      totalDonations: donorDonations.length,
      totalAmount: donorDonations.reduce((sum, d) => {
        const amount = typeof d.amountRaw === 'number' ? d.amountRaw : (parseFloat(String(d.amount).replace(/[^0-9.]/g, '')) || 0)
        return sum + amount
      }, 0),
      lastDonation: donorDonations[donorDonations.length - 1]?.date || '-',
    }
  }

  const handleVerify = async (row) => {
    if (row.type === 'In-Kind') {
      setIntakeModalDonation(row)
      return
    }

    const proofNote = !row.hasProof ? ' Note: No digital proof was uploaded by the donor.' : ''
    const verifyMessage = `Verify monetary donation ${row.trackingCode} (${row.amount})?${proofNote} This will confirm receipt of funds and provision a donor account if needed.`

    const confirmed = await confirmAction({
      title: 'Verify Donation',
      message: verifyMessage,
      confirmText: 'Verify & Confirm',
      type: 'primary',
    })
    if (!confirmed) return

    setActionLoading(true)
    showLoading('Verifying donation…')
    try {
      const res = await donationsApi.update(row.dbId, { status: 'Verified' })
      const status = res?.data?.status || 'Verified'
      if (res?.accountCreated || res?.credentialsSent) {
        showVerifyResultModal(res, status)
      } else if (res?.message) {
        showSuccessModal(`Status successfully updated to: ${status}. ${res.message}`)
      } else {
        showSuccessModal(`Status successfully updated to: ${status}.`)
      }
      reload()
      notifyBadgesChanged()
      setSelected(null)
    } catch (err) {
      notify.error(err.message || 'Failed to verify donation')
    } finally {
      hideLoading()
      setActionLoading(false)
    }
  }

  const handleClassifyInKindConfirm = async (payload) => {
    if (!intakeModalDonation) return
    showLoading('Classifying items into warehouse inventory…')
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
        setSelected(res?.data || null)
      }
    } catch (err) {
      notify.error(err.message || 'Failed to verify in-kind donation')
    } finally {
      hideLoading()
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    const confirmed = await confirmAction({
      title: `Record ${form.type} Donation`,
      message: `Confirm recording ${form.type.toLowerCase()} donation for donor "${form.donorName || 'Anonymous'}"?`,
      confirmText: 'Record Donation',
      type: 'primary',
    })
    if (!confirmed) return

    setSaving(true)
    showLoading('Saving…')
    try {
      await donationsApi.create({
        donorName: form.donorName,
        email: form.email,
        type: form.type,
        category: form.category,
        amount: form.type === 'Monetary' ? Number(form.amount) : undefined,
        items: form.type === 'In-Kind' ? form.items : undefined,
        paymentMethod: form.type === 'Monetary' ? form.paymentMethod : undefined,
        paymentReference: form.type === 'Monetary' ? (form.paymentReference?.trim() || undefined) : undefined,
        notes: form.notes,
        status: form.status,
      })
      setShowForm(false)
      setForm(emptyForm)
      notify.success(`${form.type} donation recorded successfully.`)
      showSuccessModal('Successfully added.')
      reload()
      notifyBadgesChanged()
    } catch (err) {
      notify.error(err.message || 'Failed to record donation')
    } finally {
      hideLoading()
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    const confirmed = await confirmAction({
      title: 'Delete Donation',
      message: `Permanently delete donation ${row.trackingCode} from ${row.donor}? This cannot be undone.`,
      confirmText: 'Delete Donation',
      type: 'danger',
    })
    if (!confirmed) return

    showLoading('Deleting donation…')
    try {
      await donationsApi.remove(row.dbId)
      notify.success(`Donation ${row.trackingCode} deleted.`)
      showSuccessModal('Successfully deleted.')
      reload()
      notifyBadgesChanged()
      if (selected?.dbId === row.dbId) setSelected(null)
    } catch (err) {
      notify.error(err.message || 'Failed to delete donation')
    } finally {
      hideLoading()
    }
  }

  const handleUpdateStatus = async (row, newStatus) => {
    if (!row?.dbId || !newStatus || newStatus === row.status) return
    const ok = await confirmAction({
      title: 'Update Donation Status',
      message: `Update status of donation ${row.trackingCode} to "${newStatus}"?`,
      confirmText: 'Update Status',
      type: 'primary',
    })
    if (!ok) return

    setActionLoading(true)
    showLoading('Updating status…')
    try {
      const res = await donationsApi.update(row.dbId, { status: newStatus })
      const status = res?.data?.status || newStatus
      notify.success(`Status updated to: ${status}.`)
      showSuccessModal('Successfully updated.')
      if (selected?.dbId === row.dbId) {
        setSelected({ ...selected, status })
      }
      reload()
      notifyBadgesChanged()
    } catch (err) {
      notify.error(err.message || 'Failed to update status')
    } finally {
      hideLoading()
      setActionLoading(false)
    }
  }

  // Payment method badge styling helper
  const renderPaymentMethod = (method) => {
    if (!method) return <span className="text-muted">—</span>
    const lower = String(method).toLowerCase()
    let variant = ''
    if (lower.includes('gcash')) variant = 'payment-method-pill--gcash'
    else if (lower.includes('bank') || lower.includes('bdo') || lower.includes('bpi')) variant = 'payment-method-pill--bank'
    else if (lower.includes('cash')) variant = 'payment-method-pill--cash'

    return (
      <span className={`payment-method-pill ${variant}`}>
        <CreditCard size={12} />
        {method}
      </span>
    )
  }

  // Columns for In-Kind Donations
  const inKindColumns = [
    { 
      key: 'trackingCode', 
      label: 'Tracking Code',
      width: '130px',
      render: (row) => (
        <span className="font-mono font-semibold" style={{ color: 'var(--admin-brand)' }}>
          {row.trackingCode}
        </span>
      ),
    },
    { 
      key: 'donor', 
      label: 'Donor',
      render: (row) => (
        <div className="donor-cell">
          <span className="donor-cell__name">{row.donor}</span>
          {row.donorEmail && <span className="donor-cell__email">{row.donorEmail}</span>}
        </div>
      ),
    },
    { 
      key: 'category', 
      label: 'Relief Category', 
      width: '150px',
      render: (row) => (
        <span className="in-kind-category-pill">
          {row.category || 'Relief Goods'}
        </span>
      ),
    },
    { key: 'date', label: 'Date Received', width: '120px' },
    { key: 'status', label: 'Status', width: '155px', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      width: '90px',
      align: 'center',
      render: (row) => (
        <div className="table-actions--compact">
          <button
            type="button"
            className="icon-btn icon-btn--sm"
            title="View Details"
            aria-label="View Details"
            onClick={(e) => { e.stopPropagation(); handleSelectDonation(row) }}
          >
            <Eye size={15} />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--sm icon-btn--danger"
            title="Delete Donation"
            aria-label="Delete Donation"
            onClick={(e) => { e.stopPropagation(); handleDelete(row) }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ]

  // Columns for Monetary Donations
  const monetaryColumns = [
    { 
      key: 'trackingCode', 
      label: 'Tracking Code',
      width: '130px',
      render: (row) => (
        <span className="font-mono font-semibold" style={{ color: 'var(--admin-brand)' }}>
          {row.trackingCode}
        </span>
      ),
    },
    { 
      key: 'donor', 
      label: 'Donor',
      render: (row) => (
        <div className="donor-cell">
          <span className="donor-cell__name">{row.donor}</span>
          {row.donorEmail && <span className="donor-cell__email">{row.donorEmail}</span>}
        </div>
      ),
    },
    { 
      key: 'category', 
      label: 'Fund / Program', 
      width: '140px',
      render: (row) => (
        <span className="in-kind-category-pill">
          {row.category || 'General Fund'}
        </span>
      ),
    },
    { 
      key: 'paymentMethod', 
      label: 'Payment Method',
      width: '140px',
      render: (row) => renderPaymentMethod(row.paymentMethod),
    },
    { 
      key: 'amount', 
      label: 'Amount (PHP)',
      width: '150px',
      render: (row) => {
        const total = typeof row.amountRaw === 'number' ? row.amountRaw : (parseFloat(String(row.amount).replace(/[^0-9.]/g, '')) || 0)
        const utilized = Number(row.totalUtilized || 0)
        const remaining = Number(row.remainingBalance ?? (total - utilized))
        const pct = Math.min(100, Math.round((utilized / (total || 1)) * 100))
        return (
          <div>
            <span className="donation-amount-value">
              ₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {utilized > 0 && (
              <div style={{ fontSize: '0.75rem', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px', color: remaining <= 0 ? '#059669' : '#d97706', fontWeight: 500 }}>
                <CheckCircle2 size={11} />
                <span>₱{utilized.toLocaleString('en-PH')} allocated ({pct}%)</span>
              </div>
            )}
          </div>
        )
      },
    },
    { key: 'date', label: 'Date Received', width: '120px' },
    { key: 'status', label: 'Status', width: '160px', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      width: '90px',
      align: 'center',
      render: (row) => (
        <div className="table-actions--compact">
          <button
            type="button"
            className="icon-btn icon-btn--sm"
            title="View Details"
            aria-label="View Details"
            onClick={(e) => { e.stopPropagation(); handleSelectDonation(row) }}
          >
            <Eye size={15} />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--sm icon-btn--danger"
            title="Delete Donation"
            aria-label="Delete Donation"
            onClick={(e) => { e.stopPropagation(); handleDelete(row) }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ]

  const activeColumns = activeSection === 'in-kind' ? inKindColumns : monetaryColumns
  const activeExportConfig = activeSection === 'in-kind'
    ? { filename: 'in-kind-donations-report', title: 'In-Kind Donations Report', columns: inKindColumns, rows: inKindFilters.filtered }
    : { filename: 'monetary-donations-report', title: 'Monetary Donations Report', columns: monetaryColumns, rows: monetaryFilters.filtered }

  return (
    <>
      <PageHeader
        title="Donations Management"
        description="Verify inbound physical relief items and monetary contributions, review uploaded proofs, and track lifecycle stages."
        actions={
          <button type="button" className="btn btn--primary" onClick={handleOpenCreateModal}>
            + Record Donation
          </button>
        }
      />

      {/* Sub-Navigation Switcher */}
      <div className="donation-subnav" role="tablist" aria-label="Donation Types">
        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 'in-kind'}
          className={`donation-subnav__tab${activeSection === 'in-kind' ? ' donation-subnav__tab--active' : ''}`}
          onClick={() => handleSwitchTab('in-kind')}
        >
          <Package size={17} />
          <span>In-Kind Donations</span>
          <span className="donation-subnav__badge">{inKindDonations.length}</span>
          {inKindStats.pending > 0 && (
            <span className="donation-subnav__pending-tag" title={`${inKindStats.pending} pending verification`}>
              <Clock size={11} />
              {inKindStats.pending} pending
            </span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 'monetary'}
          className={`donation-subnav__tab${activeSection === 'monetary' ? ' donation-subnav__tab--active' : ''}`}
          onClick={() => handleSwitchTab('monetary')}
        >
          <Coins size={17} />
          <span>Monetary Donations</span>
          <span className="donation-subnav__badge">{monetaryDonations.length}</span>
          {monetaryStats.pendingCount > 0 && (
            <span className="donation-subnav__pending-tag" title={`${monetaryStats.pendingCount} pending verification`}>
              <Clock size={11} />
              {monetaryStats.pendingCount} pending
            </span>
          )}
        </button>
      </div>

      {/* Metric Cards tailored per active section */}
      {activeSection === 'in-kind' ? (
        <div className="donation-metrics-row">
          <div
            className={`donation-metric-card donation-metric-card--clickable ${inKindFilters.values.status === 'all' ? 'donation-metric-card--active' : ''}`}
            onClick={() => inKindFilters.setValue('status', 'all')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inKindFilters.setValue('status', 'all') } }}
            title="View all in-kind donations"
          >
            <div className="donation-metric-card__header">
              <span className="donation-metric-card__label">Total In-Kind</span>
              <div className="donation-metric-card__icon">
                <Package size={16} />
              </div>
            </div>
            <div className="donation-metric-card__value">{inKindStats.total}</div>
            <div className="donation-metric-card__subtext">Physical relief items received</div>
          </div>

          <div
            className={`donation-metric-card donation-metric-card--clickable ${inKindFilters.values.status === 'Pending Verification' ? 'donation-metric-card--active' : ''}`}
            onClick={() => inKindFilters.setValue('status', inKindFilters.values.status === 'Pending Verification' ? 'all' : 'Pending Verification')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inKindFilters.setValue('status', inKindFilters.values.status === 'Pending Verification' ? 'all' : 'Pending Verification') } }}
            title="Filter by Pending Verification donations"
          >
            <div className="donation-metric-card__header">
              <span className="donation-metric-card__label">Pending Verification</span>
              <div className="donation-metric-card__icon donation-metric-card__icon--warning">
                <Clock size={16} />
              </div>
            </div>
            <div className="donation-metric-card__value">{inKindStats.pending}</div>
            <div className="donation-metric-card__subtext">Awaiting proof & inspection</div>
          </div>

          <div
            className={`donation-metric-card donation-metric-card--clickable ${['Verified', 'In Inventory', 'Allocated'].includes(inKindFilters.values.status) ? 'donation-metric-card--active' : ''}`}
            onClick={() => inKindFilters.setValue('status', inKindFilters.values.status === 'Verified' ? 'all' : 'Verified')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inKindFilters.setValue('status', inKindFilters.values.status === 'Verified' ? 'all' : 'Verified') } }}
            title="Filter by In Inventory / Active donations"
          >
            <div className="donation-metric-card__header">
              <span className="donation-metric-card__label">In Inventory / Active</span>
              <div className="donation-metric-card__icon donation-metric-card__icon--info">
                <TrendingUp size={16} />
              </div>
            </div>
            <div className="donation-metric-card__value">{inKindStats.active}</div>
            <div className="donation-metric-card__subtext">Ready / allocated for packs</div>
          </div>

          <div
            className={`donation-metric-card donation-metric-card--clickable ${['Distributed', 'Completed'].includes(inKindFilters.values.status) ? 'donation-metric-card--active' : ''}`}
            onClick={() => inKindFilters.setValue('status', inKindFilters.values.status === 'Distributed' ? 'all' : 'Distributed')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inKindFilters.setValue('status', inKindFilters.values.status === 'Distributed' ? 'all' : 'Distributed') } }}
            title="Filter by Distributed / Completed donations"
          >
            <div className="donation-metric-card__header">
              <span className="donation-metric-card__label">Distributed / Done</span>
              <div className="donation-metric-card__icon donation-metric-card__icon--success">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <div className="donation-metric-card__value">{inKindStats.completed}</div>
            <div className="donation-metric-card__subtext">Delivered to beneficiaries</div>
          </div>
        </div>
      ) : (
        <div className="donation-metrics-row">
          <div
            className={`donation-metric-card donation-metric-card--clickable ${monetaryFilters.values.status === 'all' ? 'donation-metric-card--active' : ''}`}
            onClick={() => monetaryFilters.setValue('status', 'all')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); monetaryFilters.setValue('status', 'all') } }}
            title="View all monetary donations"
          >
            <div className="donation-metric-card__header">
              <span className="donation-metric-card__label">Total Funds Raised</span>
              <div className="donation-metric-card__icon">
                <Coins size={16} />
              </div>
            </div>
            <div className="donation-metric-card__value">
              ₱{monetaryStats.totalRaised.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="donation-metric-card__subtext">{monetaryDonations.length} total donations recorded</div>
          </div>

          <div
            className={`donation-metric-card donation-metric-card--clickable ${monetaryFilters.values.status === 'Verified' ? 'donation-metric-card--active' : ''}`}
            onClick={() => monetaryFilters.setValue('status', monetaryFilters.values.status === 'Verified' ? 'all' : 'Verified')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); monetaryFilters.setValue('status', monetaryFilters.values.status === 'Verified' ? 'all' : 'Verified') } }}
            title="Filter by Verified funds"
          >
            <div className="donation-metric-card__header">
              <span className="donation-metric-card__label">Verified Funds</span>
              <div className="donation-metric-card__icon donation-metric-card__icon--success">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <div className="donation-metric-card__value">
              ₱{monetaryStats.verifiedSum.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="donation-metric-card__subtext">Cleared & available for relief</div>
          </div>

          <div
            className={`donation-metric-card donation-metric-card--clickable ${monetaryFilters.values.status === 'Pending Verification' ? 'donation-metric-card--active' : ''}`}
            onClick={() => monetaryFilters.setValue('status', monetaryFilters.values.status === 'Pending Verification' ? 'all' : 'Pending Verification')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); monetaryFilters.setValue('status', monetaryFilters.values.status === 'Pending Verification' ? 'all' : 'Pending Verification') } }}
            title="Filter by Pending Verification donations"
          >
            <div className="donation-metric-card__header">
              <span className="donation-metric-card__label">Pending Verification</span>
              <div className="donation-metric-card__icon donation-metric-card__icon--warning">
                <Clock size={16} />
              </div>
            </div>
            <div className="donation-metric-card__value">{monetaryStats.pendingCount}</div>
            <div className="donation-metric-card__subtext">Awaiting bank/GCash receipt check</div>
          </div>

          <div
            className={`donation-metric-card donation-metric-card--clickable ${monetaryFilters.values.status === 'Completed' ? 'donation-metric-card--active' : ''}`}
            onClick={() => monetaryFilters.setValue('status', monetaryFilters.values.status === 'Completed' ? 'all' : 'Completed')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); monetaryFilters.setValue('status', monetaryFilters.values.status === 'Completed' ? 'all' : 'Completed') } }}
            title="Filter by Completed donations"
          >
            <div className="donation-metric-card__header">
              <span className="donation-metric-card__label">Completed / Allocated</span>
              <div className="donation-metric-card__icon donation-metric-card__icon--info">
                <TrendingUp size={16} />
              </div>
            </div>
            <div className="donation-metric-card__value">
              ₱{monetaryStats.avgDonation.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="donation-metric-card__subtext">Avg donation: ₱{monetaryStats.avgDonation.toFixed(0)}</div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <FilterBar
        controller={currentFilters}
        searchPlaceholder={activeSection === 'in-kind' ? 'Search in-kind by tracking code, donor, item description...' : 'Search monetary by tracking code, donor, payment method...'}
        exportConfig={activeExportConfig}
      />

      {/* Data Table */}
      <ApiState loading={loading} error={error} message="Loading donations…" onRetry={reload}>
        <DataTable
          columns={activeColumns}
          data={currentFilters.filtered}
          onRowClick={(row) => handleSelectDonation(row)}
          pageSize={10}
          resetKey={`${activeSection}|${currentFilters.search}|${JSON.stringify(currentFilters.values)}`}
          selectable
          selectedIds={bulk.selectedIds}
          onSelectionChange={bulk.setSelectedIds}
          onBulkDelete={bulk.handleBulkDelete}
          deleting={bulk.deleting}
          bulkDeleteLabel={`Delete Selected ${activeSection === 'in-kind' ? 'In-Kind' : 'Monetary'}`}
        />
      </ApiState>

      {/* Record Donation Modal */}
      {showForm && (
        <div className="admin-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader 
              title={`Record ${form.type} Donation`} 
              onClose={() => setShowForm(false)} 
            />
            
            <form onSubmit={handleSave}>
              {/* Type Switcher in Form */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.85rem' }}>
                  Donation Classification
                </label>
                <div className="type-toggle-group">
                  <button
                    type="button"
                    className={`type-toggle-btn${form.type === 'In-Kind' ? ' type-toggle-btn--active' : ''}`}
                    onClick={() => setForm({ 
                      ...form, 
                      type: 'In-Kind', 
                      category: IN_KIND_CATEGORIES[0] || '',
                      items: form.items || '',
                    })}
                  >
                    <Package size={16} />
                    In-Kind (Physical Items)
                  </button>
                  <button
                    type="button"
                    className={`type-toggle-btn${form.type === 'Monetary' ? ' type-toggle-btn--active' : ''}`}
                    onClick={() => setForm({ 
                      ...form, 
                      type: 'Monetary', 
                      category: MONETARY_CATEGORIES[0] || '',
                      paymentMethod: paymentMethodOptions[0] || 'GCash',
                    })}
                  >
                    <Coins size={16} />
                    Monetary (Cash / Funds)
                  </button>
                </div>
              </div>

              <div className="form-row">
                <label>
                  Donor Name
                  <input 
                    required 
                    placeholder="e.g. Maria Santos"
                    value={form.donorName} 
                    onChange={(e) => setForm({ ...form, donorName: e.target.value })} 
                  />
                </label>
                <label>
                  Donor Email
                  <input 
                    type="email" 
                    placeholder="e.g. maria@example.com"
                    value={form.email} 
                    onChange={(e) => setForm({ ...form, email: e.target.value })} 
                  />
                </label>
              </div>

              {form.type === 'In-Kind' ? (
                <>
                  <div className="form-row">
                    <label>
                      Relief Category
                      <select 
                        value={form.category} 
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                      >
                        {IN_KIND_CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Initial Status
                      <select 
                        value={form.status} 
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                      >
                        <option value="Pending Verification">Pending Verification</option>
                        <option value="Verified">Verified (Post to Inventory)</option>
                      </select>
                    </label>
                  </div>

                  <label>
                    Items Description & Quantity
                    <textarea 
                      required 
                      rows={3}
                      placeholder="e.g. 50 sacks of 25kg premium rice, 100 boxes canned tuna and sardines"
                      value={form.items} 
                      onChange={(e) => setForm({ ...form, items: e.target.value })} 
                    />
                  </label>
                </>
              ) : (
                <>
                  <div className="form-row">
                    <label>
                      Fund / Program
                      <select 
                        value={form.category} 
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                      >
                        {MONETARY_CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Payment Method
                      <select 
                        value={form.paymentMethod} 
                        onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                      >
                        {paymentMethodOptions.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="form-row">
                    <label>
                      Amount (PHP ₱)
                      <input 
                        type="number" 
                        step="0.01"
                        min="1"
                        required 
                        placeholder="e.g. 5000.00"
                        value={form.amount} 
                        onChange={(e) => setForm({ ...form, amount: e.target.value })} 
                      />
                    </label>
                    <label>
                      Payment Reference / Transaction No.
                      <input 
                        type="text"
                        placeholder="e.g. GCash Ref, Bank Trace No."
                        value={form.paymentReference || ''} 
                        onChange={(e) => setForm({ ...form, paymentReference: e.target.value })} 
                      />
                    </label>
                  </div>

                  <div className="form-row">
                    <label>
                      Initial Status
                      <select 
                        value={form.status} 
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                      >
                        {DONATION_STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </>
              )}

              <label>
                Notes / Reference
                <input 
                  placeholder="Optional reference number or logistics notes"
                  value={form.notes} 
                  onChange={(e) => setForm({ ...form, notes: e.target.value })} 
                />
              </label>

              <div className="admin-modal__actions">
                <button type="button" className="btn btn--ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'Saving...' : `Save ${form.type} Donation`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Donation Details Modal */}
      {selected && (
        <div className="admin-modal-overlay" onClick={() => setSelected(null)}>
          <div className="admin-modal donation-detail-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader 
              title={`${selected.type} Donation: ${selected.trackingCode}`} 
              onClose={() => setSelected(null)} 
            />

            {/* Donation Lifecycle Progress Stepper */}
            <div className="donation-lifecycle-tracker">
              <h4 className="donation-lifecycle-tracker__title">
                {selected.type} Lifecycle Progress
              </h4>
              <div className="donation-lifecycle-tracker__steps">
                {getLifecycleStages(selected).map((stage) => {
                  const Icon = stage.icon
                  return (
                    <div
                      key={stage.id}
                      className={`donation-lifecycle-step${stage.completed ? ' donation-lifecycle-step--completed' : ''}${stage.current ? ' donation-lifecycle-step--current' : ''}`}
                    >
                      <div className="donation-lifecycle-step__circle">
                        {stage.completed ? <Check size={18} /> : <Icon size={18} />}
                      </div>
                      <span className="donation-lifecycle-step__label">{stage.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Tabs inside modal (Strictly Donation Details & Proof of Donation) */}
            <div className="donation-tabs">
              <button
                className={`donation-tab${(modalTab === 'details' || modalTab === 'overview') ? ' donation-tab--active' : ''}`}
                onClick={() => setModalTab('details')}
              >
                <FileText size={16} />
                Donation Details
              </button>
              {selected.hasProof && (
                <button
                  className={`donation-tab${modalTab === 'proof' ? ' donation-tab--active' : ''}`}
                  onClick={() => setModalTab('proof')}
                >
                  <FileCheck size={16} />
                  Proof of Donation
                  <span className="donation-tab__badge">1</span>
                </button>
              )}
            </div>

            {/* Tab Content: Donation Details */}
            {(modalTab === 'details' || modalTab === 'overview') && (
              <div className="donation-details-page">
                {/* 1. Summary Cards (Compact Balanced 3x2 Grid) */}
                <div className="donation-overview">
                  {/* Row 1: Tracking Code */}
                  <div className="donation-overview-card">
                    <div className="donation-overview-card__label">
                      <FileCheck size={13} />
                      Tracking Code
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                      <span className="donation-overview-card__value donation-overview-card__value--primary" style={{ fontSize: '1.15rem' }}>
                        {selected.trackingCode}
                      </span>
                      <button
                        type="button"
                        className="btn btn--ghost btn--icon"
                        style={{ padding: '3px', height: '24px', width: '24px', color: '#64748b' }}
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

                  {/* Row 1: Amount */}
                  <div className="donation-overview-card">
                    <div className="donation-overview-card__label">
                      <TrendingUp size={13} />
                      {selected.type === 'In-Kind' ? 'Goods / Items' : 'Monetary Amount'}
                    </div>
                    <div className="donation-overview-card__value" style={{ color: selected.type === 'In-Kind' ? '#1e293b' : '#047857', fontSize: selected.type === 'In-Kind' ? '1rem' : '1.25rem' }}>
                      {selected.type === 'In-Kind'
                        ? (selected.itemsDescription || selected.amount || '—')
                        : (typeof selected.amountRaw === 'number'
                          ? `₱${selected.amountRaw.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : selected.amount)}
                    </div>
                    <div className="donation-overview-card__subtitle">
                      {selected.type === 'In-Kind' ? (selected.category || 'Relief Goods') : (selected.paymentMethod || 'Financial Transfer')}
                    </div>
                  </div>

                  {/* Row 1: Payment Method */}
                  <div className="donation-overview-card">
                    <div className="donation-overview-card__label">
                      <CreditCard size={13} />
                      Payment Method
                    </div>
                    <div className="donation-overview-card__value" style={{ fontSize: '1.05rem' }}>
                      {selected.paymentMethod || (selected.type === 'In-Kind' ? 'Physical Turnover' : 'Direct Transfer')}
                    </div>
                    <div className="donation-overview-card__subtitle">
                      {selected.paymentReference ? `Ref: ${selected.paymentReference}` : 'Payment Channel'}
                    </div>
                  </div>

                  {/* Row 2: Date Received */}
                  <div className="donation-overview-card">
                    <div className="donation-overview-card__label">
                      <Calendar size={13} />
                      Date Received
                    </div>
                    <div className="donation-overview-card__value" style={{ fontSize: '1.05rem' }}>
                      {selected.date}
                    </div>
                    <div className="donation-overview-card__subtitle">{selected.donor}</div>
                  </div>

                  {/* Row 2: Donation Type */}
                  <div className="donation-overview-card">
                    <div className="donation-overview-card__label">
                      <Package size={13} />
                      Donation Type
                    </div>
                    <div className="donation-overview-card__value" style={{ fontSize: '1.05rem' }}>
                      {selected.type}
                    </div>
                    <div className="donation-overview-card__subtitle">{selected.category || 'Support'}</div>
                  </div>

                  {/* Row 2: Status */}
                  <div className="donation-overview-card">
                    <div className="donation-overview-card__label">
                      <ShieldCheck size={13} />
                      Current Status
                    </div>
                    <div style={{ marginTop: '0.15rem' }}>
                      <StatusBadge status={selected.status} />
                    </div>
                    <div className="donation-overview-card__subtitle" style={{ marginTop: '0.2rem' }}>
                      Workflow Phase
                    </div>
                  </div>
                </div>

                <hr className="donation-section-divider" />

                {/* 2. Compact Unified Information: Donor Profile & Transaction Information */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '0.85rem', marginBottom: '1rem' }}>
                  {/* Left Column: Donor Information */}
                  <div className="donation-info-section" style={{ margin: 0 }}>
                    <h4 className="donation-info-section__title">
                      <Users size={15} /> Donor Profile & Information
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
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
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{selected.donor}</strong>
                            {selected.donorType && (
                              <span className="badge badge--info" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                                {selected.donorType}
                              </span>
                            )}
                          </div>
                          {selected.donorEmail ? (
                            <a href={`mailto:${selected.donorEmail}`} style={{ fontSize: '0.8rem', color: '#475569', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '2px' }}>
                              <Mail size={12} /> {selected.donorEmail}
                            </a>
                          ) : (
                            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>No email provided</span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0', fontSize: '0.82rem' }}>
                        <div>
                          <span style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>
                            Contact Number
                          </span>
                          <span style={{ color: '#1e293b', fontWeight: 500 }}>
                            {selected.donorPhone || 'Not provided'}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>
                            Organization
                          </span>
                          <span style={{ color: '#1e293b', fontWeight: 500 }}>
                            {selected.donorOrganization || 'Individual'}
                          </span>
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <span style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>
                            Address / Location
                          </span>
                          <span style={{ color: '#1e293b', fontWeight: 500 }}>
                            {selected.donorAddress || 'Not specified'}
                          </span>
                        </div>
                      </div>

                      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem', color: '#475569' }}>
                        <span>Lifetime History:</span>
                        <strong style={{ color: '#AF101A' }}>
                          {getDonorStats(selected).totalDonations} donation(s) • ₱{getDonorStats(selected).totalAmount.toLocaleString()}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Transaction & Verification Details */}
                  <div className="donation-info-section" style={{ margin: 0 }}>
                    <h4 className="donation-info-section__title">
                      <CreditCard size={15} /> Payment & Verification Details
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.82rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '0.68rem', fontWeight: 600 }}>Payment Reference</span>
                        {selected.paymentReference ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                            <code style={{ fontFamily: 'monospace', fontWeight: 700, background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '0.82rem' }}>
                              {selected.paymentReference}
                            </code>
                            <button
                              type="button"
                              className="btn btn--ghost btn--icon"
                              style={{ padding: '2px', height: '22px', width: '22px' }}
                              onClick={() => {
                                navigator.clipboard?.writeText(selected.paymentReference)
                                notify.success('Reference number copied!')
                              }}
                              title="Copy Reference"
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>None</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.4rem', borderTop: '1px solid #e2e8f0' }}>
                        <span style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '0.68rem', fontWeight: 600 }}>Proof Attachment</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {selected.hasProof ? (
                            <>
                              <span style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '2px 7px',
                                borderRadius: '9999px',
                                background: selected.aiVerificationStatus === 'verified' ? '#dcfce7' : (selected.aiVerificationStatus === 'needs_review' ? '#fef3c7' : (selected.aiVerificationStatus === 'invalid' ? '#fee2e2' : '#f1f5f9')),
                                color: selected.aiVerificationStatus === 'verified' ? '#15803d' : (selected.aiVerificationStatus === 'needs_review' ? '#b45309' : (selected.aiVerificationStatus === 'invalid' ? '#b91c1c' : '#475569')),
                                border: `1px solid ${selected.aiVerificationStatus === 'verified' ? '#86efac' : (selected.aiVerificationStatus === 'needs_review' ? '#fcd34d' : '#e2e8f0')}`,
                              }}>
                                {selected.aiVerificationStatus === 'verified' ? '✓ AI Verified' : (selected.aiVerificationStatus === 'needs_review' ? '⚠ Review Needed' : (selected.aiVerificationStatus === 'invalid' ? '✕ Invalid' : 'Proof Attached'))}
                              </span>
                              <button
                                type="button"
                                className="btn btn--outline btn--sm"
                                onClick={() => setModalTab('proof')}
                                style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem' }}
                              >
                                View Proof
                              </button>
                            </>
                          ) : (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No proof attached</span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.4rem', borderTop: '1px solid #e2e8f0' }}>
                        <span style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '0.68rem', fontWeight: 600 }}>Category / Purpose</span>
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>{selected.category || 'General Support'}</span>
                      </div>

                      {selected.type === 'Monetary' && selected.status !== 'Pending Verification' && (
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#64748b', fontSize: '0.74rem' }}>Funds Allocated:</span>
                          <span style={{ fontWeight: 600, color: '#047857' }}>
                            ₱{(Number(selected.totalUtilized) || 0).toLocaleString('en-PH')} / ₱{(Number(selected.amountRaw) || 0).toLocaleString('en-PH')}
                          </span>
                        </div>
                      )}

                      {selected.notes && (
                        <div style={{ paddingTop: '0.3rem', borderTop: '1px solid #e2e8f0', color: '#475569', fontStyle: 'italic', fontSize: '0.78rem' }}>
                          "{selected.notes}"
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <hr className="donation-section-divider" />

                <div className="donation-actions-section">
                  {/* Primary workflow actions stay first and prominent. */}
                  <div className="donation-actions-primary-group">
                    {selected.status === 'Pending Verification' ? (
                      <>
                        <button
                          type="button"
                          className="btn btn--primary"
                          onClick={() => handleVerify(selected)}
                          disabled={actionLoading}
                          title={selected.type === 'In-Kind' ? 'Verify & Post to Inventory' : 'Verify & Confirm Funds'}
                        >
                          <CheckCircle2 size={16} />
                          {selected.type === 'In-Kind' ? 'Verify & Post to Inventory' : 'Verify & Confirm Funds'}
                        </button>

                        <button
                          type="button"
                          className="btn btn--danger-outline"
                          disabled={actionLoading}
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to mark donation ${selected.trackingCode} as Rejected?`)) {
                              handleUpdateStatus(selected, 'Rejected')
                            }
                          }}
                        >
                          <XCircle size={15} /> Reject Donation
                        </button>
                      </>
                    ) : (
                      canAllocateMonetaryDonation(selected) ? (
                        <button
                          type="button"
                          className="btn btn--primary"
                          onClick={() => setProcuringDonation(selected)}
                        >
                          <ShoppingCart size={16} /> Allocate Funds / Procure Goods
                        </button>
                      ) : (
                        <div className="donation-actions-complete">
                          <CheckCircle2 size={16} /> {isMonetaryDonationFullyAllocated(selected) ? 'Funds Fully Allocated' : 'Verification & Intake Completed'}
                        </div>
                      )
                    )}
                  </div>

                  {/* Status is grouped beneath, but kept visually separate from, the primary decisions. */}
                  <div className="donation-status-row">
                    <div className="donation-status-current">
                      <span>Current Status</span>
                      <StatusBadge status={selected.status} />
                    </div>

                    <div className="donation-status-quick-transition">
                      <label htmlFor="donation-status-select">Status</label>
                      <select
                        id="donation-status-select"
                        value={actionStatus || selected.status}
                        onChange={(e) => setActionStatus(e.target.value)}
                        disabled={actionLoading}
                        title="Change operational status"
                      >
                        {DONATION_STATUSES.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        disabled={(actionStatus || selected.status) === selected.status || actionLoading}
                        onClick={() => handleUpdateStatus(selected, actionStatus || selected.status)}
                      >
                        Update
                      </button>
                    </div>
                  </div>

                  <div className="donation-actions-secondary-row">
                    <div className="donation-actions-secondary-group">
                      <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        onClick={() => printDonationReceipt(selected)}
                        disabled={selected.status === 'Rejected' || selected.status === 'Cancelled'}
                        title="Generate official acknowledgment receipt"
                      >
                        <Printer size={14} /> Print Receipt
                      </button>

                      {selected.hasProof && (
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => setModalTab('proof')}
                        >
                          <FileCheck size={14} /> Inspect Proof File
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      className="btn btn--ghost btn--sm donation-delete-action"
                      onClick={() => handleDelete(selected)}
                      title="Permanently remove donation record"
                    >
                      <Trash2 size={14} /> Delete Record
                    </button>
                  </div>
                </div>

                {/* Monetary Procurement Breakdown (if active and items recorded) */}
                {selected.type === 'Monetary' && selected.status !== 'Pending Verification' && selected.procurements && selected.procurements.length > 0 && (
                  <div className="donation-procurement-card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem 1rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>
                        <Coins size={14} color="#AF101A" /> Recorded Allocations & Purchases ({selected.procurements.length})
                      </div>
                      {canAllocateMonetaryDonation(selected) && (
                        <button
                          type="button"
                          className="btn btn--outline btn--sm"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.74rem' }}
                          onClick={() => setProcuringDonation(selected)}
                        >
                          <ShoppingCart size={12} /> New Allocation
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {selected.procurements.slice(0, 3).map((proc, idx) => (
                        <div key={proc.id || idx} style={{ padding: '0.45rem 0.65rem', background: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontWeight: 600, color: '#0f172a' }}>
                              {proc.procurement_type === 'pack_sponsorship' ? `📦 ${proc.pack_type || 'Relief Pack'} Sponsorship` : `🏬 Store Purchase: ${proc.store_name || 'Wholesale'}`}
                            </span>
                            <div style={{ color: '#64748b', fontSize: '0.72rem' }}>
                              {proc.beneficiary_name ? `Target: ${proc.beneficiary_name}` : 'General Relief'}
                              {proc.created_at && ` • ${new Date(proc.created_at).toLocaleDateString()}`}
                            </div>
                          </div>
                          <strong style={{ color: '#047857' }}>
                            ₱{Number(proc.total_amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* In-Kind Classified Items Breakdown */}
                {selected.type === 'In-Kind' && selected.classifiedItems && selected.classifiedItems.length > 0 && (
                  <div className="donation-classified-card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem 1rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>
                        <Package size={14} color="#AF101A" /> Classified Warehouse Items ({selected.classifiedItems.length})
                      </div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #cbd5e1', textAlign: 'left', color: '#64748b' }}>
                            <th style={{ padding: '0.35rem' }}>Category</th>
                            <th style={{ padding: '0.35rem' }}>Item</th>
                            <th style={{ padding: '0.35rem', textAlign: 'right' }}>Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selected.classifiedItems.map((item, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '0.4rem 0.35rem' }}><span className="inv-category">{item.category}</span></td>
                              <td style={{ padding: '0.4rem 0.35rem', fontWeight: 600 }}>{item.itemType || item.item_type || '—'}</td>
                              <td style={{ padding: '0.4rem 0.35rem', textAlign: 'right', fontWeight: 700 }}>
                                {item.quantity} {item.unit || 'pcs'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* Tab Content: Proof of Donation (Fully Functional with Zoom & Fallbacks) */}
            {modalTab === 'proof' && selected.hasProof && (
              <div className="proof-viewer-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.85rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <FileCheck size={18} color="#AF101A" />
                      Uploaded Payment Proof
                    </h3>
                    <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                      {selected.proofFileName || 'Proof Document'} • {selected.proofFileType || 'Image/Document'}
                    </span>
                  </div>

                  {selected.aiVerificationStatus && selected.aiVerificationStatus !== 'Unverified' && (
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: '9999px',
                      background: selected.aiVerificationStatus === 'verified' ? '#dcfce7' : (selected.aiVerificationStatus === 'needs_review' ? '#fef3c7' : '#fee2e2'),
                      color: selected.aiVerificationStatus === 'verified' ? '#15803d' : (selected.aiVerificationStatus === 'needs_review' ? '#b45309' : '#b91c1c'),
                      border: `1px solid ${selected.aiVerificationStatus === 'verified' ? '#86efac' : (selected.aiVerificationStatus === 'needs_review' ? '#fcd34d' : '#fca5a5')}`,
                    }}>
                      {selected.aiVerificationStatus === 'verified' ? '✓ AI Verified' : (selected.aiVerificationStatus === 'needs_review' ? '⚠ Needs Review' : '✕ Invalid Proof')}
                    </span>
                  )}
                </div>

                {selected.status === 'Pending Verification' && (
                  <div className="proof-primary-actions">
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => handleVerify(selected)}
                      disabled={actionLoading}
                    >
                      <CheckCircle2 size={16} />
                      {selected.type === 'In-Kind' ? 'Verify & Post to Inventory' : 'Verify & Confirm Funds'}
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger-outline"
                      disabled={actionLoading}
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to mark donation ${selected.trackingCode} as Rejected?`)) {
                          handleUpdateStatus(selected, 'Rejected')
                        }
                      }}
                    >
                      <XCircle size={15} /> Reject Donation
                    </button>
                  </div>
                )}

                <div className="proof-status-row">
                  <span>Donation Status</span>
                  <StatusBadge status={selected.status} />
                </div>

                {/* Preview Frame: Image or PDF */}
                {selected.proofIsImage || /\.(jpe?g|png|webp|gif)$/i.test(selected.proofFileName || '') ? (
                  !proofImgError ? (
                    <div
                      className="proof-preview-frame"
                      onClick={() => { setProofZoomModal(true); setZoomLevel(1) }}
                      title="Click to Zoom & Inspect Proof"
                    >
                      <img
                        src={getAuthenticatedFileUrl(selected.proofUrl)}
                        alt={selected.proofFileName || 'Donation payment proof'}
                        onError={() => setProofImgError(true)}
                      />
                      <div className="proof-preview-hover-hint">
                        <ZoomIn size={14} /> Click to Zoom / Inspect
                      </div>
                    </div>
                  ) : (
                    <div className="proof-fallback-box">
                      <AlertCircle size={36} color="#d97706" style={{ margin: '0 auto 0.5rem' }} />
                      <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.9rem', color: '#1e293b' }}>Preview Unavailable in Frame</h4>
                      <p style={{ margin: '0 0 1rem', fontSize: '0.78rem', color: '#64748b' }}>
                        The proof file cannot be rendered inside the frame directly (or authentication cookie is restricted).
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                        <a
                          href={getAuthenticatedFileUrl(selected.proofUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn--primary btn--sm"
                        >
                          <ExternalLink size={14} /> Open Direct File
                        </a>
                        <button
                          type="button"
                          className="btn btn--outline btn--sm"
                          onClick={() => setProofImgError(false)}
                        >
                          <RotateCcw size={14} /> Retry
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  /* PDF or Document Viewer */
                  <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                    <iframe
                      src={getAuthenticatedFileUrl(selected.proofUrl)}
                      title="Proof PDF Viewer"
                      style={{ width: '100%', height: '420px', border: 'none', borderRadius: '6px' }}
                    />
                  </div>
                )}

                {/* Proof Information & Extraction Details Card */}
                {selected.aiExtractedAmount !== null && selected.aiExtractedAmount !== undefined && (
                  <div style={{
                    marginTop: '0.85rem',
                    padding: '0.75rem 1rem',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.82rem',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.65rem',
                  }}>
                    <div>
                      <strong>Extracted Amount:</strong> ₱{Number(selected.aiExtractedAmount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      {selected.aiExtractedReference && (
                        <span> • Ref: <code>{selected.aiExtractedReference}</code></span>
                      )}
                      {selected.aiExtractedMethod && (
                        <span> • Provider: <strong>{selected.aiExtractedMethod}</strong></span>
                      )}
                    </div>
                    {selected.isAmountManuallyAdjusted && (
                      <span style={{ color: '#b45309', fontWeight: 600 }}>
                        ✎ Donor adjusted to ₱{Number(selected.amountRaw || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                )}

                {/* Proof file controls */}
                <div className="proof-file-actions">
                  <button
                    type="button"
                    className="btn btn--outline"
                    onClick={() => { setProofZoomModal(true); setZoomLevel(1) }}
                  >
                    <ZoomIn size={15} /> Zoom & Inspect
                  </button>
                  <a
                    href={getAuthenticatedFileUrl(`${selected.proofUrl}&download=${encodeURIComponent(selected.proofFileName || 'proof')}`)}
                    className="btn btn--outline"
                    download={selected.proofFileName || 'donation_proof'}
                  >
                    <Download size={15} /> Download Proof
                  </a>
                  <a
                    href={getAuthenticatedFileUrl(selected.proofUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn--ghost"
                  >
                    <ExternalLink size={15} /> Open in New Tab
                  </a>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="admin-modal__actions donation-modal-footer">
              <button 
                type="button" 
                className="btn btn--ghost" 
                onClick={() => setSelected(null)}
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proof Zoom / Fullscreen Lightbox Modal */}
      {proofZoomModal && selected && selected.hasProof && (
        <div className="proof-zoom-overlay" onClick={() => setProofZoomModal(false)}>
          <div className="proof-zoom-header" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <FileCheck size={18} color="#fca5a5" />
              <div>
                <strong style={{ fontSize: '0.92rem' }}>Proof Inspection: {selected.trackingCode}</strong>
                <span style={{ fontSize: '0.74rem', color: '#cbd5e1', marginLeft: '0.5rem' }}>
                  Zoom: {Math.round(zoomLevel * 100)}%
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                style={{ color: '#fff' }}
                onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                title="Zoom In"
              >
                <ZoomIn size={15} />
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                style={{ color: '#fff' }}
                onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                title="Zoom Out"
              >
                <ZoomOut size={15} />
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                style={{ color: '#fff' }}
                onClick={() => setZoomLevel(1)}
                title="Reset Zoom"
              >
                <RotateCcw size={15} />
              </button>
              <a
                href={getAuthenticatedFileUrl(selected.proofUrl)}
                target="_blank"
                rel="noreferrer"
                className="btn btn--ghost btn--sm"
                style={{ color: '#fff' }}
                title="Open in New Tab"
              >
                <ExternalLink size={15} />
              </a>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                style={{ color: '#fff', marginLeft: '0.5rem' }}
                onClick={() => setProofZoomModal(false)}
                title="Close Lightbox"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="proof-zoom-viewport" onClick={() => setProofZoomModal(false)}>
            <img
              src={getAuthenticatedFileUrl(selected.proofUrl)}
              alt="Proof Fullscreen"
              style={{ transform: `scale(${zoomLevel})` }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Procurement & Allocation Modal */}
      {procuringDonation && (
        <ProcurementModal
          donation={procuringDonation}
          beneficiaries={beneficiaries || []}
          assistanceRequests={assistanceRequests || []}
          onClose={() => setProcuringDonation(null)}
          onSuccess={() => {
            setProcuringDonation(null)
            reload()
            if (selected && selected.dbId === procuringDonation.dbId) {
              setSelected(null)
            }
          }}
        />
      )}

      {/* In-Kind Intake & Classification Modal */}
      {intakeModalDonation && (
        <InKindIntakeModal
          isOpen={Boolean(intakeModalDonation)}
          onClose={() => setIntakeModalDonation(null)}
          donation={intakeModalDonation}
          onConfirm={handleClassifyInKindConfirm}
        />
      )}
    </>
  )
}
