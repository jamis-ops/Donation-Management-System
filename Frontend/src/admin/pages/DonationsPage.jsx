import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { 
  Eye, CheckCircle2, Download, FileText, Check, Clock, Package, 
  TrendingUp, Users, MapPin, FileCheck, Send, Printer, Heart,
  Calendar, Mail, Phone, Award, BarChart3, Coins, CreditCard,
  Banknote, Gift, ShieldAlert, Sparkles, Filter, Layers, DollarSign,
  Trash2, Settings2, ExternalLink, ShoppingCart
} from 'lucide-react'
import { donationsApi, beneficiariesApi, assistanceRequestsApi } from '../../api/resources'
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
import DonationUpdatesTimeline from '../../components/shared/DonationUpdatesTimeline'
import { useBulkSelection } from '../../hooks/useBulkSelection'
import { notify, confirmAction, showSuccessModal } from '../../utils/confirm'
import { notifyBadgesChanged } from '../../utils/badgeSync'
import { useLoading } from '../../context/LoadingContext'
import { printDonationReceipt } from '../../components/shared/printDonationReceipt'
import { DONATION_STATUSES } from '../../constants/options'

const IN_KIND_LIFECYCLE = [
  'Submission', 'Tracking Code', 'Verification', 'Inventory Intake',
  'Repacking', 'Allocation', 'Distribution', 'Completion',
]

const MONETARY_LIFECYCLE = [
  'Submission', 'Tracking Code', 'Proof Verification', 'Fund Allocation',
  'Official Receipt / Certificate', 'Completed',
]

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
  searchKeys: ['trackingCode', 'donor', 'donorEmail', 'paymentMethod', 'category', 'notes'],
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
  const [modalTab, setModalTab] = useState('overview')
  const [actionStatus, setActionStatus] = useState('')

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
      paymentMethod: activeSection === 'monetary' ? 'GCash' : '',
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

  // Get related donations for selected donor
  const getRelatedDonations = (donation) => {
    if (!donation) return []
    return donations
      .filter(d => d.dbId !== donation.dbId && d.donorEmail && d.donorEmail === donation.donorEmail)
      .slice(0, 3)
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
    if (!row.hasProof) {
      notify.warning('Cannot approve: proof of donation is required.')
      return
    }

    if (row.type === 'In-Kind') {
      setIntakeModalDonation(row)
      return
    }

    const verifyMessage = `Verify monetary donation ${row.trackingCode} (${row.amount})? This will confirm receipt of funds and provision a donor account if needed.`

    const confirmed = await confirmAction({
      title: 'Verify Donation',
      message: verifyMessage,
      confirmText: 'Verify & Confirm',
      type: 'primary',
    })
    if (!confirmed) return

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
      render: (row) => (
        <span className="in-kind-category-pill">
          {row.category || 'Relief Goods'}
        </span>
      ),
    },
    { key: 'date', label: 'Date Received' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions">
          <button
            type="button"
            className="icon-btn"
            title="View Details & Actions"
            aria-label="View Details & Actions"
            onClick={(e) => { e.stopPropagation(); setSelected(row); setModalTab('overview') }}
          >
            <Eye size={15} />
          </button>
          {row.status === 'Pending Verification' && (
            <button
              type="button"
              className="icon-btn icon-btn--success"
              title="Verify Donation & Post to Inventory"
              aria-label="Verify Donation"
              onClick={(e) => { e.stopPropagation(); handleVerify(row) }}
            >
              <CheckCircle2 size={15} />
            </button>
          )}
          <button
            type="button"
            className="icon-btn"
            title="Print Official Receipt"
            aria-label="Print Official Receipt"
            onClick={(e) => { e.stopPropagation(); printDonationReceipt(row) }}
          >
            <Printer size={15} />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--danger"
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
      render: (row) => (
        <span className="in-kind-category-pill">
          {row.category || 'General Fund'}
        </span>
      ),
    },
    { 
      key: 'paymentMethod', 
      label: 'Payment Method',
      render: (row) => renderPaymentMethod(row.paymentMethod),
    },
    { 
      key: 'amount', 
      label: 'Amount (PHP)',
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
    { key: 'date', label: 'Date Received' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions">
          <button
            type="button"
            className="icon-btn"
            title="View Details & Actions"
            aria-label="View Details & Actions"
            onClick={(e) => { e.stopPropagation(); setSelected(row); setModalTab('overview') }}
          >
            <Eye size={15} />
          </button>
          {row.status === 'Pending Verification' && (
            <button
              type="button"
              className="icon-btn icon-btn--success"
              title="Verify Donation & Clear Funds"
              aria-label="Verify Donation"
              onClick={(e) => { e.stopPropagation(); handleVerify(row) }}
            >
              <CheckCircle2 size={15} />
            </button>
          )}
          {['Verified', 'Allocated'].includes(row.status) && (
            <button
              type="button"
              className="icon-btn"
              style={{ color: '#AF101A' }}
              title="Allocate / Procure Goods"
              aria-label="Allocate / Procure Goods"
              onClick={(e) => { e.stopPropagation(); setProcuringDonation(row) }}
            >
              <ShoppingCart size={15} />
            </button>
          )}
          <button
            type="button"
            className="icon-btn"
            title="Print Official Receipt"
            aria-label="Print Official Receipt"
            onClick={(e) => { e.stopPropagation(); printDonationReceipt(row) }}
          >
            <Printer size={15} />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--danger"
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
          onRowClick={(row) => { setSelected(row); setModalTab('overview') }}
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
                      paymentMethod: form.paymentMethod || 'GCash',
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
                        {PAYMENT_METHODS.map((m) => (
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
                      Initial Status
                      <select 
                        value={form.status} 
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                      >
                        <option value="Pending Verification">Pending Verification</option>
                        <option value="Verified">Verified</option>
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
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'Saving...' : `Save ${form.type} Donation`}
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Donation Details Modal */}
      {selected && (
        <div className="admin-modal-overlay" onClick={() => setSelected(null)}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
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

            {/* Tabs inside modal */}
            <div className="donation-tabs">
              <button
                className={`donation-tab${modalTab === 'overview' ? ' donation-tab--active' : ''}`}
                onClick={() => setModalTab('overview')}
              >
                <BarChart3 size={16} />
                Overview
              </button>
              <button
                className={`donation-tab${modalTab === 'actions' ? ' donation-tab--active' : ''}`}
                onClick={() => { setModalTab('actions'); setActionStatus(selected.status) }}
              >
                <Settings2 size={16} />
                Actions & Operations
              </button>
              <button
                className={`donation-tab${modalTab === 'donor' ? ' donation-tab--active' : ''}`}
                onClick={() => setModalTab('donor')}
              >
                <Heart size={16} />
                Donor Info
              </button>
              {selected.hasProof && (
                <button
                  className={`donation-tab${modalTab === 'proof' ? ' donation-tab--active' : ''}`}
                  onClick={() => setModalTab('proof')}
                >
                  <FileText size={16} />
                  Proof of Donation
                  <span className="donation-tab__badge">1</span>
                </button>
              )}
              <button
                className={`donation-tab${modalTab === 'timeline' ? ' donation-tab--active' : ''}`}
                onClick={() => setModalTab('timeline')}
              >
                <Clock size={16} />
                Timeline & Updates
              </button>
            </div>

            {/* Tab Content: Actions View */}
            {modalTab === 'actions' && (
              <div className="donation-actions-view">
                <div className="donation-actions-grid">
                  {/* Verification & Intake Operations */}
                  <div className={`donation-action-card${selected.status === 'Pending Verification' ? ' donation-action-card--highlight' : ''}`}>
                    <div className="donation-action-card__header">
                      <div className="donation-action-card__icon">
                        <CheckCircle2 size={20} />
                      </div>
                      <div>
                        <h4 className="donation-action-card__title">Verification & Intake</h4>
                        <p className="donation-action-card__desc">
                          {selected.type === 'In-Kind' 
                            ? 'Inspect physical items, approve donation, and automatically post items to warehouse inventory.' 
                            : 'Confirm receipt of monetary funds and provision donor portal account.'}
                        </p>
                      </div>
                    </div>
                    <div className="donation-action-card__controls">
                      {selected.status === 'Pending Verification' ? (
                        <button
                          type="button"
                          className="btn btn--primary"
                          onClick={() => handleVerify(selected)}
                          disabled={!selected.hasProof}
                          title={!selected.hasProof ? 'Proof of donation is required before verification' : undefined}
                        >
                          <CheckCircle2 size={16} />
                          {selected.type === 'In-Kind' ? 'Verify & Post to Inventory' : 'Verify & Confirm Funds'}
                        </button>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                          <span style={{ fontSize: '0.85rem', color: '#047857', fontWeight: 600 }}>
                            ✓ Verified & Active
                          </span>
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            (Intake processed)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Lifecycle Status Management */}
                  <div className="donation-action-card">
                    <div className="donation-action-card__header">
                      <div className="donation-action-card__icon">
                        <Layers size={20} />
                      </div>
                      <div>
                        <h4 className="donation-action-card__title">Lifecycle Status Transition</h4>
                        <p className="donation-action-card__desc">
                          Update the current operational stage of this donation across the foundation workflow.
                        </p>
                      </div>
                    </div>
                    <div className="donation-action-card__controls">
                      <div className="donation-status-selector">
                        <select
                          value={actionStatus || selected.status}
                          onChange={(e) => setActionStatus(e.target.value)}
                        >
                          {DONATION_STATUSES.map((st) => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn btn--outline"
                          disabled={(actionStatus || selected.status) === selected.status}
                          onClick={() => handleUpdateStatus(selected, actionStatus || selected.status)}
                        >
                          Apply Status
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Official Receipts & Documentation */}
                  <div className="donation-action-card">
                    <div className="donation-action-card__header">
                      <div className="donation-action-card__icon">
                        <Printer size={20} />
                      </div>
                      <div>
                        <h4 className="donation-action-card__title">Official Receipt & Printing</h4>
                        <p className="donation-action-card__desc">
                          Generate and print official RAFI donation acknowledgement receipt with tracking details.
                        </p>
                      </div>
                    </div>
                    <div className="donation-action-card__controls">
                      <button
                        type="button"
                        className="btn btn--outline"
                        onClick={() => printDonationReceipt(selected)}
                      >
                        <Printer size={16} /> Print Official Receipt
                      </button>
                      {selected.hasProof && (
                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={() => setModalTab('proof')}
                        >
                          <FileText size={16} /> View Proof File
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Monetary Allocation & Procurement */}
                  {selected.type === 'Monetary' && selected.status !== 'Pending Verification' && (
                    <div className="donation-action-card">
                      <div className="donation-action-card__header">
                        <div className="donation-action-card__icon" style={{ background: '#fee2e2', color: '#AF101A' }}>
                          <ShoppingCart size={20} />
                        </div>
                        <div>
                          <h4 className="donation-action-card__title">Fund Allocation & Goods Procurement</h4>
                          <p className="donation-action-card__desc">
                            Sponsor relief packs (Food, Hygiene, Medical) or itemize store wholesale purchases to directly allocate this donation to active barangay requests.
                          </p>
                        </div>
                      </div>
                      <div className="donation-action-card__controls">
                        <button
                          type="button"
                          className="btn btn--primary"
                          onClick={() => setProcuringDonation(selected)}
                        >
                          <ShoppingCart size={16} /> Allocate / Procure Goods
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Timeline & Progress Updates */}
                  <div className="donation-action-card">
                    <div className="donation-action-card__header">
                      <div className="donation-action-card__icon">
                        <Clock size={20} />
                      </div>
                      <div>
                        <h4 className="donation-action-card__title">Audit Trail & Updates</h4>
                        <p className="donation-action-card__desc">
                          Log distribution notes, warehouse milestones, or donor tracking updates.
                        </p>
                      </div>
                    </div>
                    <div className="donation-action-card__controls">
                      <button
                        type="button"
                        className="btn btn--outline"
                        onClick={() => setModalTab('timeline')}
                      >
                        <Clock size={16} /> Post Progress Update
                      </button>
                    </div>
                  </div>

                  {/* Administrative Actions */}
                  <div className="donation-action-card donation-action-card--danger">
                    <div className="donation-action-card__header">
                      <div className="donation-action-card__icon">
                        <Trash2 size={20} />
                      </div>
                      <div>
                        <h4 className="donation-action-card__title" style={{ color: '#b91c1c' }}>Record Removal</h4>
                        <p className="donation-action-card__desc">
                          Permanently remove this donation record from the database. This action is irreversible.
                        </p>
                      </div>
                    </div>
                    <div className="donation-action-card__controls">
                      <button
                        type="button"
                        className="btn btn--danger"
                        onClick={() => handleDelete(selected)}
                      >
                        <Trash2 size={16} /> Delete Donation Record
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab Content: Overview */}
            {modalTab === 'overview' && (
              <>
                <div className="donation-overview">
                  <div className="donation-overview-card">
                    <div className="donation-overview-card__label">
                      <FileCheck size={14} />
                      Tracking Code
                    </div>
                    <div className="donation-overview-card__value donation-overview-card__value--primary">
                      {selected.trackingCode}
                    </div>
                    <div className="donation-overview-card__subtitle">{selected.type} Donation</div>
                  </div>

                  {selected.type === 'In-Kind' ? (
                    <div className="donation-overview-card">
                      <div className="donation-overview-card__label">
                        <Package size={14} />
                        Items Description
                      </div>
                      <div className="donation-overview-card__value" style={{ fontSize: '1rem', whiteSpace: 'normal', lineHeight: 1.4 }}>
                        {selected.itemsDescription || selected.amount || '—'}
                      </div>
                      <div className="donation-overview-card__subtitle">{selected.category || 'Relief Goods'}</div>
                    </div>
                  ) : (
                    <div className="donation-overview-card">
                      <div className="donation-overview-card__label">
                        <TrendingUp size={14} />
                        Monetary Amount
                      </div>
                      <div className="donation-overview-card__value" style={{ color: '#047857' }}>
                        {typeof selected.amountRaw === 'number'
                          ? `₱${selected.amountRaw.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : selected.amount}
                      </div>
                      <div className="donation-overview-card__subtitle">{selected.paymentMethod || 'Financial Transfer'}</div>
                    </div>
                  )}

                  <div className="donation-overview-card">
                    <div className="donation-overview-card__label">
                      <Calendar size={14} />
                      Date Received
                    </div>
                    <div className="donation-overview-card__value" style={{ fontSize: '1.15rem' }}>
                      {selected.date}
                    </div>
                    <div className="donation-overview-card__subtitle">{selected.donor}</div>
                  </div>

                  <div className="donation-overview-card">
                    <div className="donation-overview-card__label">
                      <Package size={14} />
                      Current Status
                    </div>
                    <div style={{ marginTop: '0.5rem' }}>
                      <StatusBadge status={selected.status} />
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="donation-quick-actions">
                  {selected.status === 'Pending Verification' && (
                    <button
                      type="button"
                      className="donation-quick-action"
                      onClick={() => handleVerify(selected)}
                      disabled={!selected.hasProof}
                      title={!selected.hasProof ? 'Proof of donation is required before verification' : undefined}
                    >
                      <div className="donation-quick-action__icon">
                        <CheckCircle2 size={20} />
                      </div>
                      <span className="donation-quick-action__label">
                        {selected.type === 'In-Kind' ? 'Verify & Post to Inventory' : 'Verify & Clear Funds'}
                      </span>
                    </button>
                  )}
                  <button 
                    type="button" 
                    className="donation-quick-action"
                    onClick={() => { setModalTab('actions'); setActionStatus(selected.status) }}
                  >
                    <div className="donation-quick-action__icon">
                      <Settings2 size={20} />
                    </div>
                    <span className="donation-quick-action__label">Actions & Status</span>
                  </button>
                  <button 
                    type="button" 
                    className="donation-quick-action"
                    onClick={() => printDonationReceipt(selected)}
                  >
                    <div className="donation-quick-action__icon">
                      <Printer size={20} />
                    </div>
                    <span className="donation-quick-action__label">Print Receipt</span>
                  </button>
                  <button 
                    type="button" 
                    className="donation-quick-action"
                    onClick={() => setModalTab('timeline')}
                  >
                    <div className="donation-quick-action__icon">
                      <Clock size={20} />
                    </div>
                    <span className="donation-quick-action__label">Timeline Updates</span>
                  </button>
                </div>

                {/* In-Kind Classified Items Breakdown */}
                {selected.type === 'In-Kind' && selected.classifiedItems && selected.classifiedItems.length > 0 && (
                  <div className="donation-classified-card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', marginTop: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fee2e2', color: '#AF101A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Package size={18} />
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#1e293b' }}>Classified Warehouse Inventory Items</h4>
                          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Stock received and cataloged into warehouse inventory from this donation</span>
                        </div>
                      </div>
                      <span className="badge badge--success" style={{ fontSize: '0.75rem' }}>
                        {selected.classifiedItems.length} {selected.classifiedItems.length === 1 ? 'item intaked' : 'items intaked'}
                      </span>
                    </div>

                    <div className="donation-classified-table-wrap" style={{ overflowX: 'auto' }}>
                      <table className="donation-classified-table" style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #cbd5e1', textAlign: 'left', color: '#64748b' }}>
                            <th style={{ padding: '0.5rem' }}>Category</th>
                            <th style={{ padding: '0.5rem' }}>Item Type</th>
                            <th style={{ padding: '0.5rem' }}>Brand / Product</th>
                            <th style={{ padding: '0.5rem' }}>Variant / Size</th>
                            <th style={{ padding: '0.5rem', textAlign: 'right' }}>Quantity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selected.classifiedItems.map((item, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '0.6rem 0.5rem' }}>
                                <span className="inv-category">{item.category}</span>
                              </td>
                              <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600 }}>
                                {item.itemType || item.item_type || '—'}
                              </td>
                              <td style={{ padding: '0.6rem 0.5rem' }}>
                                {item.brand ? (
                                  <span className="inv-brand-badge">{item.brand}</span>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.75rem' }}>Generic / Unbranded</span>
                                )}
                              </td>
                              <td style={{ padding: '0.6rem 0.5rem' }}>
                                {item.variant ? (
                                  <span className="inv-variant-badge">{item.variant}</span>
                                ) : (
                                  <span style={{ color: '#94a3b8' }}>—</span>
                                )}
                              </td>
                              <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: 700 }}>
                                {item.quantity} <span style={{ fontWeight: 400, color: '#64748b' }}>{item.unit || 'pcs'}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Monetary Procurement & Utilization Breakdown */}
                {selected.type === 'Monetary' && selected.status !== 'Pending Verification' && (
                  <div className="donation-procurement-card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', marginTop: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fee2e2', color: '#AF101A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Coins size={18} />
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#1e293b' }}>Fund Utilization & Allocation Status</h4>
                          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Monetary balance allocation towards relief packages & supplier purchases</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn--primary"
                        style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem', gap: '0.4rem' }}
                        onClick={() => setProcuringDonation(selected)}
                      >
                        <ShoppingCart size={14} /> Allocate / Procure Goods
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                      <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Total Donation</span>
                        <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>
                          ₱{((typeof selected.amountRaw === 'number' ? selected.amountRaw : (parseFloat(String(selected.amount).replace(/[^0-9.]/g, '')) || 0))).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                      <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Allocated / Utilized</span>
                        <strong style={{ fontSize: '1.1rem', color: '#047857' }}>
                          ₱{(Number(selected.totalUtilized) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                      <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Remaining Balance</span>
                        <strong style={{ fontSize: '1.1rem', color: (Number(selected.remainingBalance ?? 0) <= 0 && Number(selected.totalUtilized) > 0) ? '#64748b' : '#d97706' }}>
                          ₱{(Number(selected.remainingBalance ?? selected.amountRaw ?? 0)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                      <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Families Supported</span>
                        <strong style={{ fontSize: '1.1rem', color: '#AF101A' }}>
                          {selected.totalFamiliesSupported || (selected.procurements?.reduce((sum, p) => sum + (Number(p.families_supported) || Number(p.pack_count) || 0), 0)) || '—'}
                        </strong>
                      </div>
                    </div>

                    {/* Procurements List */}
                    {selected.procurements && selected.procurements.length > 0 ? (
                      <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '0.75rem' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <CheckCircle2 size={14} color="#047857" /> Allocation & Procurement Log ({selected.procurements.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                          {selected.procurements.map((proc, idx) => (
                            <div key={proc.id || idx} style={{ padding: '0.65rem 0.8rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #edf2f7', fontSize: '0.82rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <div>
                                  <span style={{ fontWeight: 600, color: '#0f172a' }}>
                                    {proc.procurement_type === 'pack_sponsorship' ? `📦 ${proc.pack_type || 'Relief Pack'} Sponsorship` : `🏬 Store Purchase: ${proc.store_name || 'Wholesale Supplier'}`}
                                  </span>
                                  <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '2px' }}>
                                    Target: {proc.beneficiary_name ? `${proc.beneficiary_name}${proc.municipality ? `, ${proc.municipality}` : ''}` : 'General Relief'}
                                    {proc.receipt_number && ` • Receipt #${proc.receipt_number}`}
                                    {proc.created_at && ` • ${new Date(proc.created_at).toLocaleDateString()}`}
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <span style={{ fontWeight: 600, color: '#047857' }}>
                                    ₱{Number(proc.total_amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                  </span>
                                  {proc.pack_count > 0 && (
                                    <div style={{ fontSize: '0.72rem', color: '#AF101A', fontWeight: 500 }}>
                                      {proc.pack_count} packs sponsored
                                    </div>
                                  )}
                                </div>
                              </div>
                              {/* If itemized line items */}
                              {Array.isArray(proc.items) && proc.items.length > 0 && (
                                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed #cbd5e1' }}>
                                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.25rem' }}>Itemized Breakdown:</div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                    {proc.items.map((it, i) => (
                                      <span key={i} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '2px 6px', fontSize: '0.72rem', color: '#334155' }}>
                                        {it.item} × {it.quantity} {it.unit} (₱{(it.quantity * it.unitCost).toLocaleString('en-PH')})
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '1rem', background: '#fff', borderRadius: '8px', border: '1px dashed #cbd5e1', fontSize: '0.82rem', color: '#64748b' }}>
                        No direct allocations recorded yet. Click <strong>"Allocate / Procure Goods"</strong> above to assign these funds to relief packs or record store purchases.
                      </div>
                    )}
                  </div>
                )}

                {/* Impact Visualization */}
                {selected.status !== 'Pending Verification' && selected.type === 'In-Kind' && (
                  <div className="donation-impact">
                    <h3 className="donation-impact__title">
                      <Heart size={20} />
                      In-Kind Community Impact
                    </h3>
                    <div className="donation-impact__stats">
                      <div className="donation-impact-stat">
                        <div className="donation-impact-stat__icon">
                          <Users size={24} />
                        </div>
                        <div className="donation-impact-stat__value">40+</div>
                        <div className="donation-impact-stat__label">Beneficiaries Reached</div>
                      </div>
                      <div className="donation-impact-stat">
                        <div className="donation-impact-stat__icon">
                          <Package size={24} />
                        </div>
                        <div className="donation-impact-stat__value">15+ Packs</div>
                        <div className="donation-impact-stat__label">Relief Distributed</div>
                      </div>
                      <div className="donation-impact-stat">
                        <div className="donation-impact-stat__icon">
                          <MapPin size={24} />
                        </div>
                        <div className="donation-impact-stat__value">Partner LGUs</div>
                        <div className="donation-impact-stat__label">Cebu Province</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Details List */}
                <dl className="detail-list" style={{ marginTop: '1rem' }}>
                  <dt>Category</dt>
                  <dd>{selected.category || '—'}</dd>
                  {selected.type === 'Monetary' && (
                    <>
                      <dt>Payment Method</dt>
                      <dd>{selected.paymentMethod || '—'}</dd>
                    </>
                  )}
                  {selected.type === 'In-Kind' && (
                    <>
                      <dt>Physical Goods</dt>
                      <dd>{selected.itemsDescription || selected.amount || '—'}</dd>
                    </>
                  )}
                  <dt>Notes / Remarks</dt>
                  <dd>{selected.notes || '—'}</dd>
                </dl>
              </>
            )}

            {/* Tab Content: Donor Info */}
            {modalTab === 'donor' && (
              <>
                <div className="donor-info-card">
                  <div className="donor-info-card__header">
                    <div className="donor-info-card__avatar">
                      {selected.donor?.charAt(0)?.toUpperCase() || 'D'}
                    </div>
                    <div className="donor-info-card__details">
                      <h3>{selected.donor}</h3>
                      <p>
                        <Mail size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                        {selected.donorEmail || 'No email provided'}
                      </p>
                    </div>
                  </div>
                  <div className="donor-info-card__stats">
                    <div className="donor-info-card__stat">
                      <div className="donor-info-card__stat-value">
                        {getDonorStats(selected).totalDonations}
                      </div>
                      <div className="donor-info-card__stat-label">Total Contributions</div>
                    </div>
                    <div className="donor-info-card__stat">
                      <div className="donor-info-card__stat-value">
                        ₱{getDonorStats(selected).totalAmount.toLocaleString()}
                      </div>
                      <div className="donor-info-card__stat-label">Total Monetary Contributed</div>
                    </div>
                    <div className="donor-info-card__stat">
                      <div className="donor-info-card__stat-value" style={{ fontSize: '1rem' }}>
                        {getDonorStats(selected).lastDonation}
                      </div>
                      <div className="donor-info-card__stat-label">Latest Contribution</div>
                    </div>
                  </div>
                </div>

                {getRelatedDonations(selected).length > 0 && (
                  <div className="related-donations">
                    <h3 className="related-donations__title">Previous Donations by this Donor</h3>
                    <div className="related-donations__list">
                      {getRelatedDonations(selected).map((d) => (
                        <div
                          key={d.dbId}
                          className="related-donation-item"
                          onClick={() => setSelected(d)}
                        >
                          <div className="related-donation-item__info">
                            <div className="related-donation-item__code">{d.trackingCode}</div>
                            <div className="related-donation-item__meta">
                              <span>{d.type}</span>
                              <span>{d.date}</span>
                              <StatusBadge status={d.status} />
                            </div>
                          </div>
                          <div className="related-donation-item__amount">
                            {d.type === 'In-Kind' ? (d.itemsDescription || d.amount) : d.amount}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Tab Content: Proof of Donation */}
            {modalTab === 'proof' && selected.hasProof && (
              <div className="donation-proof-gallery">
                <h3 className="donation-proof-gallery__title">
                  <FileText size={20} />
                  Uploaded Proof of Donation
                </h3>
                <div className="donation-proof-gallery__grid">
                  {selected.proofIsImage ? (
                    <a
                      href={selected.proofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="donation-proof-item"
                    >
                      <img
                        src={selected.proofUrl}
                        alt={selected.proofFileName || 'Donation proof'}
                        className="donation-proof-item__image"
                      />
                      <div className="donation-proof-item__overlay">
                        <span className="donation-proof-item__name">
                          {selected.proofFileName || 'Proof Image'}
                        </span>
                      </div>
                    </a>
                  ) : (
                    <a
                      href={selected.proofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="donation-proof-item donation-proof-item--document"
                    >
                      <FileText size={48} className="donation-proof-item__icon" />
                      <span className="donation-proof-item__name">
                        {selected.proofFileName || 'Document'}
                      </span>
                      <span className="donation-proof-item__type">
                        {selected.proofFileType || 'PDF/Document'}
                      </span>
                    </a>
                  )}
                </div>
                <div style={{ marginTop: '1rem' }}>
                  <a
                    href={selected.proofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn--outline"
                    download={selected.proofFileName}
                  >
                    <Download size={16} /> Download Proof File
                  </a>
                </div>
              </div>
            )}

            {/* Tab Content: Timeline */}
            {modalTab === 'timeline' && (
              <DonationUpdatesTimeline
                donationId={selected.dbId}
                canPost
                onPosted={reload}
              />
            )}

            <div className="admin-modal__actions admin-modal__actions--split" style={{ marginTop: '1.25rem' }}>
              <button 
                type="button" 
                className="btn btn--danger" 
                onClick={() => handleDelete(selected)}
              >
                <Trash2 size={15} /> Delete Donation
              </button>
              <div className="admin-modal__actions-group">
                <button 
                  type="button" 
                  className="btn btn--outline" 
                  onClick={() => printDonationReceipt(selected)}
                >
                  <Printer size={15} /> Print Receipt
                </button>
                <button 
                  type="button" 
                  className="btn btn--ghost" 
                  onClick={() => setSelected(null)}
                >
                  Close
                </button>
              </div>
            </div>
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
