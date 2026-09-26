import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, Download, TrendingUp, Coins, Package, Calendar, Users, MapPin, Heart } from 'lucide-react'
import StatusBadge from '../../admin/components/shared/StatusBadge'
import ApiState from '../../admin/components/shared/ApiState'
import { donationsApi, certificatesApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { usePagination, DEFAULT_PAGE_SIZE } from '../../hooks/usePagination'
import Pagination from '../../admin/components/shared/Pagination'
import ExportMenu from '../../admin/components/shared/ExportMenu'
import ModalHeader from '../../admin/components/shared/ModalHeader'
import DonationProgressTracker from '../../components/donor/DonationProgressTracker'
import { notify, confirmAction, showSuccessModal } from '../../utils/confirm'
import { DONATION_STATUSES } from '../../constants/options'
import { useLoading } from '../../context/LoadingContext'

export default function DonorDonationsPage() {
  const [searchParams] = useSearchParams()
  const { showLoading, hideLoading } = useLoading()
  const { data, loading, error, reload } = useApiList(() => donationsApi.list())
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState(() => searchParams.get('q') || searchParams.get('search') || '')
  const [typeFilter, setTypeFilter] = useState(() => searchParams.get('type') || 'All')
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || 'All')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const t = searchParams.get('type')
    if (t) setTypeFilter(t)
    const st = searchParams.get('status')
    if (st) setStatusFilter(st)
  }, [searchParams])

  // Calculate statistics
  const totalMonetary = data
    .filter(d => d.type === 'Monetary' && d.status !== 'Cancelled')
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0)
  
  const totalInKind = data
    .filter(d => d.type === 'In-Kind' && d.status !== 'Cancelled')
    .length

  const activeDonations = data
    .filter(d => ['Pending', 'Pending Verification', 'Verified', 'In Transit', 'Allocated'].includes(d.status))
    .length

  const completedDonations = data
    .filter(d => ['Distributed', 'Completed', 'Received'].includes(d.status))
    .length

  // Filter donations
  const filtered = data.filter((d) => {
    const matchesSearch = !search ||
      d.trackingCode?.toLowerCase().includes(search.toLowerCase()) ||
      d.category?.toLowerCase().includes(search.toLowerCase()) ||
      d.program?.toLowerCase().includes(search.toLowerCase())
    
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
      DONATION_STATUSES.map((s) => [
        s,
        data.filter((d) => d.status === s).length,
      ])
    ),
  }

  const handleCancel = async (row) => {
    const ok = await confirmAction({
      title: 'Cancel Donation',
      message: `Cancel donation ${row.trackingCode}? This cannot be undone.`,
      confirmText: 'Cancel Donation',
      type: 'danger',
    })
    if (!ok) return

    setBusy(true)
    showLoading('Processing…')
    try {
      await donationsApi.remove(row.dbId)
      setSelected(null)
      showSuccessModal('Status successfully updated to: Cancelled.')
      reload()
    } catch (err) {
      notify.error(err.message)
    } finally {
      hideLoading()
      setBusy(false)
    }
  }

  const handleRequestCert = async (row) => {
    setBusy(true)
    showLoading('Sending…')
    try {
      await certificatesApi.create({ type: 'Certificate of Donation', reference: row.trackingCode })
      setSelected(null)
      notify.success(`Certificate requested for ${row.trackingCode}. You will be notified once it is ready.`)
    } catch (err) {
      notify.error(err.message)
    } finally {
      hideLoading()
      setBusy(false)
    }
  }

  const exportColumns = useMemo(() => [
    { key: 'trackingCode', label: 'Tracking Code' },
    { key: 'type', label: 'Type' },
    { key: 'amount', label: 'Amount / Item', exportValue: (d) => d.type === 'Monetary' ? (typeof d.amount === 'number' ? `₱${d.amount.toLocaleString()}` : String(d.amount)) : (d.item || d.amount || '—') },
    { key: 'program', label: 'Program', exportValue: (d) => d.program || '—' },
    { key: 'date', label: 'Date' },
    { key: 'status', label: 'Status' },
    { key: 'beneficiaries', label: 'Beneficiaries', exportValue: (d) => d.beneficiaries || 0 },
  ], [])

  const canRequestCert = selected && !['Pending Verification', 'Cancelled'].includes(selected.status)

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      {/* Analytics Cards */}
      <div className="donor-analytics-cards">
        <div 
          className={`donor-analytics-card portal-stat-card--clickable ${typeFilter === 'Monetary' ? 'donor-analytics-card--active' : ''}`}
          onClick={() => setTypeFilter(typeFilter === 'Monetary' ? 'All' : 'Monetary')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTypeFilter(typeFilter === 'Monetary' ? 'All' : 'Monetary') } }}
          title="Filter: Monetary Donations"
        >
          <div className="donor-analytics-card__icon">
            <Coins size={20} />
          </div>
          <div className="donor-analytics-card__content">
            <span className="donor-analytics-card__value">₱{totalMonetary.toLocaleString()}</span>
            <span className="donor-analytics-card__label">Total Monetary</span>
          </div>
        </div>
        <div 
          className={`donor-analytics-card donor-analytics-card--blue portal-stat-card--clickable ${typeFilter === 'In-Kind' ? 'donor-analytics-card--active' : ''}`}
          onClick={() => setTypeFilter(typeFilter === 'In-Kind' ? 'All' : 'In-Kind')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTypeFilter(typeFilter === 'In-Kind' ? 'All' : 'In-Kind') } }}
          title="Filter: In-Kind Donations"
        >
          <div className="donor-analytics-card__icon">
            <Package size={20} />
          </div>
          <div className="donor-analytics-card__content">
            <span className="donor-analytics-card__value">{totalInKind}</span>
            <span className="donor-analytics-card__label">In-Kind Donations</span>
          </div>
        </div>
        <div 
          className={`donor-analytics-card donor-analytics-card--green portal-stat-card--clickable ${statusFilter === 'Distributed' ? 'donor-analytics-card--active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'Distributed' ? 'All' : 'Distributed')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setStatusFilter(statusFilter === 'Distributed' ? 'All' : 'Distributed') } }}
          title="Filter: Distributed Donations"
        >
          <div className="donor-analytics-card__icon">
            <TrendingUp size={20} />
          </div>
          <div className="donor-analytics-card__content">
            <span className="donor-analytics-card__value">{completedDonations}</span>
            <span className="donor-analytics-card__label">Distributed</span>
          </div>
        </div>
        <div 
          className={`donor-analytics-card donor-analytics-card--purple portal-stat-card--clickable ${statusFilter === 'All' && typeFilter === 'All' ? 'donor-analytics-card--active' : ''}`}
          onClick={() => { setStatusFilter('All'); setTypeFilter('All') }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setStatusFilter('All'); setTypeFilter('All') } }}
          title="View all donations"
        >
          <div className="donor-analytics-card__icon">
            <Users size={20} />
          </div>
          <div className="donor-analytics-card__content">
            <span className="donor-analytics-card__value">{data.reduce((sum, d) => sum + (Number(d.beneficiaries) || 0), 0)}</span>
            <span className="donor-analytics-card__label">Lives Impacted</span>
          </div>
        </div>
      </div>

      <section className="portal-panel">
        <div className="portal-panel__header">
          <h2>My Donations</h2>
          <div className="portal-panel__actions">
            <ExportMenu
              columns={exportColumns}
              rows={filtered}
              filename="my-donations"
              title="Donation History Report"
            />
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
                      {d.type === 'In-Kind' && <Package size={16} />}
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

            {/* Fund Utilization & Impact Breakdown for Monetary Donations */}
            {selected.type === 'Monetary' && Array.isArray(selected.procurements) && selected.procurements.length > 0 && (
              <div className="donor-procurement-impact" style={{ margin: '1.25rem 0', padding: '1.25rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#fee2e2', color: '#AF101A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Heart size={20} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600, color: '#1e293b' }}>
                      Verified Community Impact & Fund Breakdown
                    </h4>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Your financial gift has been directly converted into the following relief provisions:
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {selected.procurements.map((proc, idx) => (
                    <div key={proc.id || idx} style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <div>
                          <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, background: proc.procurement_type === 'pack_sponsorship' ? '#eff6ff' : '#f0fdf4', color: proc.procurement_type === 'pack_sponsorship' ? '#1d4ed8' : '#15803d', marginBottom: '4px' }}>
                            {proc.procurement_type === 'pack_sponsorship' ? '📦 Relief Pack Sponsorship' : '🏬 Wholesale Store Purchase'}
                          </span>
                          <h5 style={{ margin: 0, fontSize: '0.92rem', color: '#0f172a' }}>
                            {proc.procurement_type === 'pack_sponsorship' ? (proc.pack_type || 'Emergency Relief Food Pack') : (proc.store_name || 'Partner Supplier Purchase')}
                          </h5>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '3px' }}>
                            <MapPin size={13} color="#AF101A" />
                            <span>
                              Dispatched to: <strong>{proc.beneficiary_name || 'Relief Center'}</strong>{proc.municipality ? `, ${proc.municipality}` : ''}
                            </span>
                            {proc.receipt_number && <span> • Receipt #{proc.receipt_number}</span>}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#047857' }}>
                            ₱{Number(proc.total_amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </span>
                          {proc.pack_count > 0 && (
                            <div style={{ fontSize: '0.78rem', color: '#AF101A', fontWeight: 600, marginTop: '2px' }}>
                              {proc.pack_count} Families Supported
                            </div>
                          )}
                        </div>
                      </div>

                      {Array.isArray(proc.items) && proc.items.length > 0 && (
                        <div style={{ marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid #f1f5f9' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                            Itemized Goods:
                          </span>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.4rem' }}>
                            {proc.items.map((it, i) => (
                              <div key={i} style={{ background: '#f8fafc', padding: '4px 8px', borderRadius: '6px', fontSize: '0.76rem', display: 'flex', justifyContent: 'space-between', border: '1px solid #edf2f7' }}>
                                <span style={{ color: '#334155' }}>{it.item}</span>
                                <strong style={{ color: '#0f172a' }}>{it.quantity} {it.unit}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live Progress Tracker */}
            <DonationProgressTracker donation={selected} donationId={selected.dbId} />

            <div className="admin-modal__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setSelected(null)}>Close</button>
              {(canRequestCert || selected.status === 'Pending Verification') && (
                <div className="admin-modal__actions-group">
                  {selected.status === 'Pending Verification' && (
                    <button type="button" className="btn btn--outline" disabled={busy} onClick={() => handleCancel(selected)}>
                      Cancel Donation
                    </button>
                  )}
                  {canRequestCert && (
                    <button type="button" className="btn btn--primary" disabled={busy} onClick={() => handleRequestCert(selected)}>
                      Request Certificate
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </ApiState>
  )
}
