import { useState } from 'react'
import { 
  Eye, CheckCircle2, Download, FileText, Check, Clock, Package, 
  TrendingUp, Users, MapPin, FileCheck, Send, Printer, Heart,
  Calendar, Mail, Phone, Award, BarChart3
} from 'lucide-react'
import { donationsApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { DONATION_CATEGORIES } from '../../constants/options'
import { useFilters } from '../../hooks/useFilters'
import PageHeader from '../../components/admin/shared/PageHeader'
import DataTable from '../../components/admin/shared/DataTable'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import FilterBar from '../../components/admin/shared/FilterBar'
import ModalHeader from '../../components/admin/shared/ModalHeader'
import DonationUpdatesTimeline from '../../components/shared/DonationUpdatesTimeline'
import { notify } from '../../utils/toast'

const lifecycle = [
  'Submission', 'Tracking Code', 'Verification', 'Inventory', 'Repacking',
  'Allocation', 'Distribution Planning', 'Distribution', 'Certificate / OR',
]

const emptyForm = {
  donorName: '', email: '', type: 'Monetary', category: '', amount: '', items: '', status: 'Pending Verification',
}

const filterConfig = {
  searchKeys: ['trackingCode', 'donor', 'donorEmail'],
  filters: [
    { key: 'status', label: 'Status' },
    { key: 'type', label: 'Type' },
    { key: 'category', label: 'Category' },
  ],
  dateKey: 'date',
}

function toastVerifyResult(res) {
  if (!res?.accountCreated) {
    notify.success(res?.message || 'Donation verified.')
    return
  }
  if (res.credentialsSent) {
    notify.success('Donation verified. Donor portal account created and login credentials were emailed.')
    return
  }
  notify.warning('Donation verified. Donor portal account was created, but the credential email was NOT delivered.')
}

export default function DonationsPage() {
  const { data: donations, loading, error, reload } = useApiList(() => donationsApi.list())
  const categoryOptions = DONATION_CATEGORIES
  const [selected, setSelected] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  const filters = useFilters(donations, filterConfig)

  // Get lifecycle stages with completion status
  const getLifecycleStages = (donation) => {
    const stages = [
      { id: 'submission', label: 'Submission', icon: FileText },
      { id: 'tracking', label: 'Tracking', icon: FileCheck },
      { id: 'verification', label: 'Verification', icon: CheckCircle2 },
      { id: 'inventory', label: 'Inventory', icon: Package },
      { id: 'allocation', label: 'Allocation', icon: TrendingUp },
      { id: 'distribution', label: 'Distribution', icon: MapPin },
      { id: 'certificate', label: 'Certificate', icon: Award },
    ]

    const statusMap = {
      'Pending Verification': 1,
      'Verified': 3,
      'In Inventory': 4,
      'Allocated': 5,
      'Distributed': 6,
      'Completed': 7,
    }

    const currentStage = statusMap[donation?.status] || 0

    return stages.map((stage, index) => ({
      ...stage,
      completed: index < currentStage,
      current: index === currentStage - 1,
    }))
  }

  // Get related donations (mock data for demo)
  const getRelatedDonations = (donation) => {
    if (!donation) return []
    return donations
      .filter(d => d.dbId !== donation.dbId && d.donorEmail === donation.donorEmail)
      .slice(0, 3)
  }

  // Get donor stats (mock calculation)
  const getDonorStats = (donation) => {
    if (!donation) return { totalDonations: 0, totalAmount: 0, lastDonation: '-' }
    const donorDonations = donations.filter(d => d.donorEmail === donation.donorEmail)
    return {
      totalDonations: donorDonations.length,
      totalAmount: donorDonations.reduce((sum, d) => {
        const amount = parseFloat(String(d.amount).replace(/[^0-9.]/g, '')) || 0
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
    try {
      const res = await donationsApi.update(row.dbId, { status: 'Verified' })
      if (res?.accountCreated || res?.credentialsSent) {
        toastVerifyResult(res)
      } else if (res?.message) {
        notify.success(res.message)
      } else {
        notify.success('Donation verified.')
      }
      reload()
      setSelected(null)
    } catch (err) {
      notify.error(err.message || 'Failed to verify donation')
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await donationsApi.create({
        donorName: form.donorName,
        email: form.email,
        type: form.type,
        category: form.category,
        amount: form.type === 'Monetary' ? Number(form.amount) : undefined,
        items: form.type === 'In-Kind' ? form.items : undefined,
        status: form.status,
      })
      setShowForm(false)
      setForm(emptyForm)
      notify.success('Donation recorded.')
      reload()
    } catch (err) {
      notify.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    if (!confirm(`Delete donation ${row.trackingCode}?`)) return
    try {
      await donationsApi.remove(row.dbId)
      notify.success('Donation deleted.')
      reload()
      setSelected(null)
    } catch (err) {
      notify.error(err.message)
    }
  }

  const columns = [
    { key: 'trackingCode', label: 'Tracking Code' },
    { key: 'donor', label: 'Donor' },
    { key: 'type', label: 'Type' },
    { key: 'category', label: 'Category', render: (row) => row.category || '—' },
    { key: 'amount', label: 'Amount / Items' },
    { key: 'date', label: 'Date' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions">
          {row.status === 'Pending Verification' && (
            <button
              type="button"
              className="icon-btn icon-btn--success"
              title="Verify"
              aria-label="Verify"
              onClick={(e) => { e.stopPropagation(); handleVerify(row) }}
            >
              <CheckCircle2 size={15} />
            </button>
          )}
          <button
            type="button"
            className="icon-btn"
            title="View"
            aria-label="View"
            onClick={(e) => { e.stopPropagation(); setSelected(row) }}
          >
            <Eye size={15} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Inbound Donations (Received)"
        description="Verify inbound donations, review uploaded proof, and manage the donation lifecycle."
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setShowForm(true)}>
            + Record Donation
          </button>
        }
      />

      <div className="admin-lifecycle">
        {lifecycle.map((step, i) => (
          <span key={step} className="admin-lifecycle__step">
            {step}
            {i < lifecycle.length - 1 && <span className="admin-lifecycle__arrow">›</span>}
          </span>
        ))}
      </div>

      <FilterBar
        controller={filters}
        searchPlaceholder="Search by tracking code, donor, or email..."
        exportConfig={{ filename: 'donation-report', title: 'Donation Report', columns, rows: filters.filtered }}
      />

      <ApiState loading={loading} error={error} onRetry={reload}>
        <DataTable columns={columns} data={filters.filtered} onRowClick={setSelected} initialVisible={5} />
      </ApiState>

      {showForm && (
        <div className="admin-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title="Record Donation" onClose={() => setShowForm(false)} />
            <form onSubmit={handleSave}>
              <label>Donor Name<input required value={form.donorName} onChange={(e) => setForm({ ...form, donorName: e.target.value })} /></label>
              <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              <div className="form-row">
                <label>Type
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    <option value="Monetary">Monetary</option>
                    <option value="In-Kind">In-Kind</option>
                  </select>
                </label>
                <label>Category
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    <option value="">Uncategorized</option>
                    {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              </div>
              {form.type === 'Monetary' ? (
                <label>Amount (PHP)<input type="number" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
              ) : (
                <label>Items Description<input required value={form.items} onChange={(e) => setForm({ ...form, items: e.target.value })} /></label>
              )}
              <div className="admin-modal__actions">
                <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                <button type="button" className="btn btn--ghost" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selected && (
        <div className="admin-modal-overlay" onClick={() => setSelected(null)}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title="Donation Details" onClose={() => setSelected(null)} />

            {/* Donation Lifecycle Tracker */}
            <div className="donation-lifecycle-tracker">
              <h4 className="donation-lifecycle-tracker__title">Donation Progress</h4>
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

            {/* Tabs */}
            <div className="donation-tabs">
              <button
                className={`donation-tab${activeTab === 'overview' ? ' donation-tab--active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                <BarChart3 size={16} />
                Overview
              </button>
              <button
                className={`donation-tab${activeTab === 'donor' ? ' donation-tab--active' : ''}`}
                onClick={() => setActiveTab('donor')}
              >
                <Heart size={16} />
                Donor Info
              </button>
              {selected.hasProof && (
                <button
                  className={`donation-tab${activeTab === 'proof' ? ' donation-tab--active' : ''}`}
                  onClick={() => setActiveTab('proof')}
                >
                  <FileText size={16} />
                  Proof
                  <span className="donation-tab__badge">1</span>
                </button>
              )}
              <button
                className={`donation-tab${activeTab === 'timeline' ? ' donation-tab--active' : ''}`}
                onClick={() => setActiveTab('timeline')}
              >
                <Clock size={16} />
                Timeline
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
              <>
                {/* Overview Cards */}
                <div className="donation-overview">
                  <div className="donation-overview-card">
                    <div className="donation-overview-card__label">
                      <FileCheck size={14} />
                      Tracking Code
                    </div>
                    <div className="donation-overview-card__value donation-overview-card__value--primary">
                      {selected.trackingCode}
                    </div>
                  </div>
                  <div className="donation-overview-card">
                    <div className="donation-overview-card__label">
                      <TrendingUp size={14} />
                      Amount / Value
                    </div>
                    <div className="donation-overview-card__value">
                      {selected.amount}
                    </div>
                    <div className="donation-overview-card__subtitle">{selected.type}</div>
                  </div>
                  <div className="donation-overview-card">
                    <div className="donation-overview-card__label">
                      <Calendar size={14} />
                      Date Received
                    </div>
                    <div className="donation-overview-card__value" style={{ fontSize: '1.25rem' }}>
                      {selected.date}
                    </div>
                  </div>
                  <div className="donation-overview-card">
                    <div className="donation-overview-card__label">
                      <Package size={14} />
                      Status
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
                      title={!selected.hasProof ? 'Proof of donation is required' : undefined}
                    >
                      <div className="donation-quick-action__icon">
                        <CheckCircle2 size={20} />
                      </div>
                      <span className="donation-quick-action__label">Verify</span>
                    </button>
                  )}
                  <button type="button" className="donation-quick-action">
                    <div className="donation-quick-action__icon">
                      <Award size={20} />
                    </div>
                    <span className="donation-quick-action__label">Generate Certificate</span>
                  </button>
                  <button type="button" className="donation-quick-action">
                    <div className="donation-quick-action__icon">
                      <Send size={20} />
                    </div>
                    <span className="donation-quick-action__label">Send Receipt</span>
                  </button>
                  <button type="button" className="donation-quick-action">
                    <div className="donation-quick-action__icon">
                      <Printer size={20} />
                    </div>
                    <span className="donation-quick-action__label">Print Details</span>
                  </button>
                </div>

                {/* Impact Visualization (if verified) */}
                {selected.status !== 'Pending Verification' && (
                  <div className="donation-impact">
                    <h3 className="donation-impact__title">
                      <Heart size={20} />
                      Donation Impact
                    </h3>
                    <div className="donation-impact__stats">
                      <div className="donation-impact-stat">
                        <div className="donation-impact-stat__icon">
                          <Users size={24} />
                        </div>
                        <div className="donation-impact-stat__value">
                          {Math.floor(Math.random() * 50) + 10}
                        </div>
                        <div className="donation-impact-stat__label">Beneficiaries Helped</div>
                      </div>
                      <div className="donation-impact-stat">
                        <div className="donation-impact-stat__icon">
                          <Package size={24} />
                        </div>
                        <div className="donation-impact-stat__value">
                          {Math.floor(Math.random() * 20) + 5}
                        </div>
                        <div className="donation-impact-stat__label">Items Distributed</div>
                      </div>
                      <div className="donation-impact-stat">
                        <div className="donation-impact-stat__icon">
                          <MapPin size={24} />
                        </div>
                        <div className="donation-impact-stat__value">
                          {Math.floor(Math.random() * 5) + 1}
                        </div>
                        <div className="donation-impact-stat__label">Barangays Reached</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Details List */}
                <dl className="detail-list">
                  <dt>Category</dt><dd>{selected.category || '—'}</dd>
                  <dt>Payment Method</dt><dd>{selected.paymentMethod || '—'}</dd>
                  <dt>Notes</dt><dd>{selected.notes || '—'}</dd>
                </dl>
              </>
            )}

            {activeTab === 'donor' && (
              <>
                {/* Donor Info Card */}
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
                      <div className="donor-info-card__stat-label">Total Donations</div>
                    </div>
                    <div className="donor-info-card__stat">
                      <div className="donor-info-card__stat-value">
                        ₱{getDonorStats(selected).totalAmount.toLocaleString()}
                      </div>
                      <div className="donor-info-card__stat-label">Total Amount</div>
                    </div>
                    <div className="donor-info-card__stat">
                      <div className="donor-info-card__stat-value" style={{ fontSize: '1rem' }}>
                        {getDonorStats(selected).lastDonation}
                      </div>
                      <div className="donor-info-card__stat-label">Last Donation</div>
                    </div>
                  </div>
                </div>

                {/* Related Donations */}
                {getRelatedDonations(selected).length > 0 && (
                  <div className="related-donations">
                    <h3 className="related-donations__title">Previous Donations</h3>
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
                          <div className="related-donation-item__amount">{d.amount}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'proof' && selected.hasProof && (
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
                    <Download size={16} /> Download Proof
                  </a>
                </div>
              </div>
            )}

            {activeTab === 'timeline' && (
              <DonationUpdatesTimeline
                donationId={selected.dbId}
                canPost
                onPosted={reload}
              />
            )}

            <div className="admin-modal__actions">
              <button type="button" className="btn btn--outline" onClick={() => handleDelete(selected)}>Delete</button>
              <button type="button" className="btn btn--ghost" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
