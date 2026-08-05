import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Download, TrendingUp, DollarSign, Package, Calendar, Users, MapPin } from 'lucide-react'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import { donationsApi, certificatesApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { usePagination, DEFAULT_PAGE_SIZE } from '../../hooks/usePagination'
import Pagination from '../../components/admin/shared/Pagination'
import ModalHeader from '../../components/admin/shared/ModalHeader'
import DonationProgressTracker from '../../components/donor/DonationProgressTracker'
import { notify } from '../../utils/toast'
import { DONATION_STATUSES } from '../../constants/options'

export default function DonorDonationsPage() {
  const { data, loading, error, reload } = useApiList(() => donationsApi.list())
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [busy, setBusy] = useState(false)

  // Calculate statistics
  const totalMonetary = data
    .filter(d => d.type === 'Monetary' && d.status !== 'Cancelled')
    .reduce((sum, d) => sum + parseFloat(d.amount.replace(/[₱,]/g, '')), 0)
  
  const inKindCount = data.filter(d => d.type === 'In-Kind').length
  const distributedCount = data.filter(d => d.status === 'Distributed').length
  const totalBeneficiaries = data.reduce((sum, d) => sum + (d.beneficiaries || 0), 0)

  // Apply filters
  const filtered = data.filter((d) => {
    const matchesSearch = !search ||
      d.trackingCode?.toLowerCase().includes(search.toLowerCase()) ||
      d.program?.toLowerCase().includes(search.toLowerCase()) ||
      d.status?.toLowerCase().includes(search.toLowerCase())
    
    const matchesType = typeFilter === 'All' || d.type === typeFilter
    const matchesStatus = statusFilter === 'All' || d.status === statusFilter
    
    return matchesSearch && matchesType && matchesStatus
  })

  const paging = usePagination(filtered, DEFAULT_PAGE_SIZE, `${search}|${typeFilter}|${statusFilter}`)

  const typeCounts = {
    All: data.length,
    Monetary: data.filter(d => d.type === 'Monetary').length,
    'In-Kind': data.filter(d => d.type === 'In-Kind').length,
  }

  const statusCounts = {
    All: data.length,
    ...Object.fromEntries(
      DONATION_STATUSES.filter((s) => !['Rejected', 'Cancelled'].includes(s)).map((s) => [
        s,
        data.filter((d) => d.status === s).length,
      ])
    ),
  }

  const handleCancel = async (row) => {
    if (!window.confirm(`Cancel donation ${row.trackingCode}? This cannot be undone.`)) return
    setBusy(true)
    try {
      await donationsApi.remove(row.dbId)
      setSelected(null)
      notify.success(`Donation ${row.trackingCode} was cancelled.`)
      reload()
    } catch (err) {
      notify.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleRequestCert = async (row) => {
    setBusy(true)
    try {
      await certificatesApi.create({ type: 'Certificate of Donation', reference: row.trackingCode })
      setSelected(null)
      notify.success(`Certificate requested for ${row.trackingCode}. You will be notified once it is ready.`)
    } catch (err) {
      notify.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleExportCSV = () => {
    const headers = ['Tracking Code', 'Type', 'Amount', 'Program', 'Date', 'Status', 'Beneficiaries']
    const rows = filtered.map(d => [
      d.trackingCode,
      d.type,
      `"${d.amount}"`,
      `"${d.program || ''}"`,
      d.date,
      d.status,
      d.beneficiaries || 0,
    ])
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'my-donations.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const canRequestCert = selected && !['Pending Verification', 'Cancelled'].includes(selected.status)

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      {/* Analytics Cards */}
      <div className="donor-analytics-cards">
        <div className="donor-analytics-card">
          <div className="donor-analytics-card__icon">
            <DollarSign size={20} />
          </div>
          <div className="donor-analytics-card__content">
            <span className="donor-analytics-card__value">₱{totalMonetary.toLocaleString()}</span>
            <span className="donor-analytics-card__label">Total Monetary</span>
          </div>
        </div>
        <div className="donor-analytics-card donor-analytics-card--blue">
          <div className="donor-analytics-card__icon">
            <Package size={20} />
          </div>
          <div className="donor-analytics-card__content">
            <span className="donor-analytics-card__value">{inKindCount}</span>
            <span className="donor-analytics-card__label">In-Kind Donations</span>
          </div>
        </div>
        <div className="donor-analytics-card donor-analytics-card--green">
          <div className="donor-analytics-card__icon">
            <TrendingUp size={20} />
          </div>
          <div className="donor-analytics-card__content">
            <span className="donor-analytics-card__value">{distributedCount}</span>
            <span className="donor-analytics-card__label">Distributed</span>
          </div>
        </div>
        <div className="donor-analytics-card donor-analytics-card--purple">
          <div className="donor-analytics-card__icon">
            <Users size={20} />
          </div>
          <div className="donor-analytics-card__content">
            <span className="donor-analytics-card__value">{totalBeneficiaries}</span>
            <span className="donor-analytics-card__label">Lives Impacted</span>
          </div>
        </div>
      </div>

      <section className="portal-panel">
        <div className="portal-panel__header">
          <h2>My Donations</h2>
          <div className="portal-panel__actions">
            <button 
              type="button" 
              className="btn btn--sm btn--outline" 
              onClick={handleExportCSV}
              disabled={filtered.length === 0}
            >
              <Download size={14} /> Export CSV
            </button>
            <Link to="/donate" className="btn btn--sm btn--primary">+ Make a Donation</Link>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="portal-filter-bar">
          <div className="portal-filter-bar__search">
            <Search size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by tracking code, program, or status..."
              className="portal-search-input"
            />
          </div>
          
          <div className="portal-filter-section">
            <span className="portal-filter-label">Type:</span>
            <div className="portal-filter-bar__filters">
              {Object.keys(typeCounts).map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`portal-filter-btn ${typeFilter === type ? 'active' : ''}`}
                >
                  {type} <span className="portal-filter-btn__count">({typeCounts[type]})</span>
                </button>
              ))}
            </div>
          </div>

          <div className="portal-filter-section">
            <span className="portal-filter-label">Status:</span>
            <div className="portal-filter-bar__filters">
              {Object.keys(statusCounts).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`portal-filter-btn ${statusFilter === status ? 'active' : ''}`}
                >
                  {status} <span className="portal-filter-btn__count">({statusCounts[status]})</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Donations List */}
        {filtered.length === 0 ? (
          <div className="portal-empty">
            <Package size={36} />
            <p>
              {search 
                ? `No donations found matching "${search}"`
                : typeFilter !== 'All' || statusFilter !== 'All'
                ? 'No donations match the selected filters'
                : 'No donations yet. Make your first donation to get started!'}
            </p>
          </div>
        ) : (
          <>
            <div className="donor-donations-grid">
              {paging.pageItems.map((d) => (
                <div key={d.id} className="donor-donation-card">
                  <div className="donor-donation-card__header">
                    <div className="donor-donation-card__tracking">
                      <strong>{d.trackingCode}</strong>
                      <span className={`donor-donation-type donor-donation-type--${d.type.toLowerCase()}`}>
                        {d.type}
                      </span>
                    </div>
                    <StatusBadge status={d.status} />
                  </div>
                  
                  <div className="donor-donation-card__body">
                    <div className="donor-donation-card__amount">
                      {d.type === 'Monetary' ? <DollarSign size={16} /> : <Package size={16} />}
                      <span>{d.amount}</span>
                    </div>
                    
                    <div className="donor-donation-card__details">
                      <span className="donor-donation-card__program">{d.program}</span>
                      <span className="donor-donation-card__date">
                        <Calendar size={14} /> {d.date}
                      </span>
                      {d.beneficiaries > 0 && (
                        <span className="donor-donation-card__impact">
                          <Users size={14} /> {d.beneficiaries} beneficiaries
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="donor-donation-card__actions">
                    <button 
                      type="button" 
                      className="btn btn--sm btn--outline" 
                      onClick={() => setSelected(d)}
                    >
                      Track Details
                    </button>
                  </div>
                </div>
              ))}
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

      {/* Tracking Modal */}
      {selected && (
        <div className="admin-modal-overlay" onClick={() => setSelected(null)}>
          <div className="admin-modal admin-modal--extra-wide" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title={`Track Donation ${selected.trackingCode}`} onClose={() => setSelected(null)} />

            <div className="donor-tracking-details">
              <div className="donor-tracking-header">
                <div className="donor-tracking-amount">
                  <span className="donor-tracking-amount__value">{selected.amount}</span>
                  <span className="donor-tracking-amount__label">{selected.type} Donation</span>
                </div>
                <StatusBadge status={selected.status} />
              </div>

              <div className="donor-tracking-grid">
                <div className="donor-tracking-item">
                  <MapPin size={16} />
                  <div>
                    <span className="donor-tracking-item__label">Program</span>
                    <strong>{selected.program}</strong>
                  </div>
                </div>
                <div className="donor-tracking-item">
                  <Calendar size={16} />
                  <div>
                    <span className="donor-tracking-item__label">Date</span>
                    <strong>{selected.date}</strong>
                  </div>
                </div>
                <div className="donor-tracking-item">
                  <Users size={16} />
                  <div>
                    <span className="donor-tracking-item__label">Beneficiaries</span>
                    <strong>{selected.beneficiaries || 'Pending'}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Progress Tracker */}
            <DonationProgressTracker donation={selected} donationId={selected.dbId} />

            <div className="admin-modal__actions">
              {canRequestCert && (
                <button type="button" className="btn btn--primary" disabled={busy} onClick={() => handleRequestCert(selected)}>
                  Request Certificate
                </button>
              )}
              {selected.status === 'Pending Verification' && (
                <button type="button" className="btn btn--outline" disabled={busy} onClick={() => handleCancel(selected)}>
                  Cancel Donation
                </button>
              )}
              <button type="button" className="btn btn--ghost" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </ApiState>
  )
}
