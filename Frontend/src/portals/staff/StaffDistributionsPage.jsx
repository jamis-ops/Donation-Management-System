/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Truck,
  MapPin,
  Calendar,
  Users,
  Package,
  CheckCircle,
  Search,
  Eye,
  ArrowRight,
  Boxes,
  UserCheck,
  History,
  Info,
  Image as ImageIcon,
  Upload,
  Trash2,
} from 'lucide-react'
import ApiState from '../../admin/components/shared/ApiState'
import StatusBadge from '../../admin/components/shared/StatusBadge'
import ModalHeader from '../../admin/components/shared/ModalHeader'
import { distributionsApi, uploadStaffDistributionPhotos } from '../../api/resources'
import { getAuthenticatedFileUrl } from '../../api/auth'
import { useApiList } from '../../hooks/useApiList'
import { usePagination, DEFAULT_PAGE_SIZE } from '../../hooks/usePagination'
import Pagination from '../../admin/components/shared/Pagination'
import { notify, confirmAction, showSuccessModal } from '../../utils/confirm'
import { notifyBadgesChanged } from '../../utils/badgeSync'
import { useLoading } from '../../context/LoadingContext'
import PortalModal from '../shared/PortalModal'

const STAFF_ADVANCE = {
  Planning: { next: 'Preparing', label: 'Preparing' },
  Preparing: { next: 'In Transit', label: 'In Transit' },
  'In Transit': { next: 'Delivered', label: 'Delivered' },
}

// Canonical linear steps for the distribution tracker
const TRACKER_STEPS = ['Planning', 'Preparing', 'In Transit', 'Delivered', 'Completed']

function normalizeDistributionView(status) {
  if (!status || String(status).toLowerCase() === 'all') return 'all'
  return status === 'Completed' ? 'Completed' : 'Pending'
}

// Helper to parse items summary into structured list
function parseItemsList(distribution) {
  if (Array.isArray(distribution?.allocations) && distribution.allocations.length > 0) {
    return distribution.allocations.map((a) => ({
      name: a.resource || a.resourceName || 'Relief Item',
      quantity: a.quantity || 1,
      program: a.program || '',
    }))
  }
  const raw = distribution?.items || distribution?.itemsSummary || ''
  if (!raw) return [{ name: 'Relief Goods Packs', quantity: distribution?.beneficiaries || 1 }]

  // Split by ';' or by ',' if multiple
  const delimiter = raw.includes(';') ? ';' : ','
  const parts = raw.split(delimiter).map((s) => s.trim()).filter(Boolean)
  if (parts.length === 0) return [{ name: 'Relief Goods Packs', quantity: distribution?.beneficiaries || 1 }]

  return parts.map((part) => {
    const multMatch = part.match(/(.+?)\s*[×x]\s*(\d+)$/i)
    if (multMatch) {
      return { name: multMatch[1].trim(), quantity: parseInt(multMatch[2], 10) }
    }
    return { name: part, quantity: 1 }
  })
}

// Helper to extract clean team members & clean notes
function extractTeamAndNotes(distribution) {
  const rawNotes = String(distribution?.notes || '')
  let teamMembers = []
  let cleanNotes = rawNotes

  const teamRegex = /Assigned Team:\s*([^;\n\r]+)/i
  const match = rawNotes.match(teamRegex)
  if (match) {
    const rawTeam = match[1].trim()
    teamMembers = rawTeam.split(',').map((t) => t.trim()).filter(Boolean)
    cleanNotes = rawNotes.replace(teamRegex, '').trim()
    cleanNotes = cleanNotes.replace(/From allocation\(s\):\s*$/i, '').trim()
  }

  if (Array.isArray(distribution?.assignedVolunteers) && distribution.assignedVolunteers.length > 0) {
    teamMembers = Array.from(new Set([...teamMembers, ...distribution.assignedVolunteers]))
  }

  const assignedStaff = distribution?.assignedStaff || distribution?.coordinator || 'Operations Staff'

  return { assignedStaff, teamMembers, cleanNotes }
}

export default function StaffDistributionsPage() {
  const [searchParams] = useSearchParams()
  const { showLoading, hideLoading } = useLoading()
  const { data: distributions = [], loading, error, reload } = useApiList(() => distributionsApi.list())

  const [filterStatus, setFilterStatus] = useState(() => normalizeDistributionView(searchParams.get('status')))
  const [filterProgram, setFilterProgram] = useState(() => searchParams.get('program') || 'all')
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || searchParams.get('search') || '')
  const [selectedDistribution, setSelectedDistribution] = useState(null)
  const [saving, setSaving] = useState(false)
  const [photoDrafts, setPhotoDrafts] = useState([])
  const [photoNotes, setPhotoNotes] = useState('')
  const [photoSaving, setPhotoSaving] = useState(false)

  const openDistribution = (distribution) => {
    photoDrafts.forEach((draft) => URL.revokeObjectURL(draft.preview))
    setPhotoDrafts([])
    setPhotoNotes('')
    setSelectedDistribution(distribution)
  }

  const closeDistribution = () => {
    photoDrafts.forEach((draft) => URL.revokeObjectURL(draft.preview))
    setPhotoDrafts([])
    setPhotoNotes('')
    setSelectedDistribution(null)
  }

  const handlePhotoSelection = (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (files.length < 2 || files.length > 3) {
      notify.error('Select 2 to 3 distribution photos.')
      return
    }
    const invalid = files.find((file) => !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024)
    if (invalid) {
      notify.error('Use JPG, PNG, WEBP, or GIF images up to 5MB each.')
      return
    }
    photoDrafts.forEach((draft) => URL.revokeObjectURL(draft.preview))
    setPhotoDrafts(files.map((file) => ({ file, preview: URL.createObjectURL(file) })))
  }

  const removePhotoDraft = (index) => {
    setPhotoDrafts((current) => {
      URL.revokeObjectURL(current[index].preview)
      return current.filter((_, itemIndex) => itemIndex !== index)
    })
  }

  const saveDistributionPhotos = async () => {
    if (!selectedDistribution?.dbId || photoDrafts.length < 2 || photoDrafts.length > 3) return
    setPhotoSaving(true)
    const formData = new FormData()
    formData.append('distributionId', String(selectedDistribution.dbId))
    formData.append('notes', photoNotes.trim())
    photoDrafts.forEach(({ file }) => formData.append('distribution_photos[]', file))
    try {
      const response = await uploadStaffDistributionPhotos(formData)
      setSelectedDistribution((current) => current ? { ...current, distributionPhotos: response.data || [] } : current)
      photoDrafts.forEach((draft) => URL.revokeObjectURL(draft.preview))
      setPhotoDrafts([])
      setPhotoNotes('')
      await reload(true)
      showSuccessModal('Distribution photos saved. They are now available to the linked donor and Admin.')
    } catch (err) {
      notify.error(err.message || 'Unable to save distribution photos')
    } finally {
      setPhotoSaving(false)
    }
  }

  useEffect(() => {
    const st = searchParams.get('status')
    const view = normalizeDistributionView(st)
    if (st && view !== filterStatus) setFilterStatus(view)
    const prog = searchParams.get('program')
    if (prog && prog !== filterProgram) setFilterProgram(prog)
    // Query parameters are the external navigation source; local tab changes
    // intentionally should not cause this synchronization effect to rerun.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const programs = useMemo(() => {
    const set = new Set()
    distributions.forEach((d) => {
      if (d.program) set.add(d.program)
    })
    return Array.from(set)
  }, [distributions])

  const filteredDistributions = useMemo(() => {
    return distributions.filter((dist) => {
      if (filterStatus === 'Completed' && dist.status !== 'Completed') return false
      if (filterStatus === 'Pending' && ['Completed', 'Cancelled'].includes(dist.status)) return false
      if (filterProgram !== 'all' && dist.program !== filterProgram) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchCode = dist.id?.toLowerCase().includes(q)
        const matchLoc = dist.location?.toLowerCase().includes(q)
        const matchProg = dist.program?.toLowerCase().includes(q)
        const matchBarangay = dist.barangay?.toLowerCase().includes(q)
        if (!matchCode && !matchLoc && !matchProg && !matchBarangay) return false
      }
      return true
    })
  }, [distributions, filterStatus, filterProgram, searchQuery])

  const paging = usePagination(filteredDistributions, DEFAULT_PAGE_SIZE, `${searchQuery}|${filterStatus}|${filterProgram}`)

  // Distribution status counts
  const statusCounts = useMemo(() => {
    return {
      all: distributions.length,
      Pending: distributions.filter((d) => !['Completed', 'Cancelled'].includes(d.status)).length,
      Completed: distributions.filter((d) => d.status === 'Completed').length,
    }
  }, [distributions])

  const handleAdvanceStatus = async (dist) => {
    if (!dist?.dbId) return
    const stepInfo = STAFF_ADVANCE[dist.status]
    if (!stepInfo) return

    const ok = await confirmAction({
      title: 'Advance Distribution Status',
      message: `Advance distribution "${dist.id || dist.location}" from ${dist.status} to ${stepInfo.next}? This will update the distribution timeline and sync with Admin.`,
      confirmText: `Advance to ${stepInfo.next}`,
      type: 'primary',
    })
    if (!ok) return

    setSaving(true)
    showLoading('Updating distribution status…')
    try {
      const res = await distributionsApi.update(dist.dbId, { status: stepInfo.next })
      const newStatus = res?.data?.status || stepInfo.next
      showSuccessModal(`Distribution status successfully advanced to: ${newStatus}.`)
      await reload()
      notifyBadgesChanged()
      if (selectedDistribution && selectedDistribution.dbId === dist.dbId) {
        setSelectedDistribution((prev) => (res?.data ? { ...res.data, status: newStatus } : { ...prev, status: newStatus }))
      }
    } catch (err) {
      notify.error(err.message || 'Failed to update distribution status')
    } finally {
      hideLoading()
      setSaving(false)
    }
  }

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      <div className="staff-distributions-page staff-portal-page">
        {/* Compact views only; underlying distribution workflow statuses stay unchanged. */}
        <div className="staff-distribution-tabs" role="tablist" aria-label="Filter distributions by completion state">
          <button
            type="button"
            role="tab"
            aria-selected={filterStatus === 'all'}
            className={`staff-distribution-tab ${filterStatus === 'all' ? 'staff-distribution-tab--active' : ''}`}
            onClick={() => setFilterStatus('all')}
          >
            <span>All</span><strong>{statusCounts.all}</strong>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filterStatus === 'Pending'}
            className={`staff-distribution-tab ${filterStatus === 'Pending' ? 'staff-distribution-tab--active' : ''}`}
            onClick={() => setFilterStatus('Pending')}
          >
            <span>Pending</span><strong>{statusCounts.Pending}</strong>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filterStatus === 'Completed'}
            className={`staff-distribution-tab ${filterStatus === 'Completed' ? 'staff-distribution-tab--active' : ''}`}
            onClick={() => setFilterStatus('Completed')}
          >
            <span>Completed</span><strong>{statusCounts.Completed}</strong>
          </button>
        </div>

        {/* Main Panel */}
        <section className="portal-panel">
          <div className="portal-panel__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>Scheduled Distributions</h2>
              <span className="portal-panel__hint" style={{ fontSize: '0.82rem', color: '#64748b' }}>
                Showing {filteredDistributions.length} of {distributions.length} events
              </span>
            </div>

            {/* Filter and Search Bar: properly aligned, balanced, and responsive */}
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', flex: '1 1 auto', justifyContent: 'flex-end', maxWidth: '680px' }}>
              <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '200px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                <input
                  className="portal-search-input"
                  style={{ paddingLeft: '36px', width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  placeholder="Search location, code, or program..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select
                className="portal-select"
                style={{ height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', background: '#fff', fontSize: '0.85rem', flex: '0 1 auto', minWidth: '150px' }}
                value={filterProgram}
                onChange={(e) => setFilterProgram(e.target.value)}
              >
                <option value="all">All Programs</option>
                {programs.map((prog) => (
                  <option key={prog} value={prog}>{prog}</option>
                ))}
              </select>

            </div>
          </div>

          {filteredDistributions.length === 0 ? (
            <div className="portal-empty" style={{ padding: '3.5rem 1rem', textAlign: 'center' }}>
              <Truck size={42} style={{ margin: '0 auto 0.75rem', color: '#94a3b8' }} />
              <p style={{ margin: 0, fontWeight: 600, color: '#334155' }}>No distribution events found</p>
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Try changing the status or search filter.</span>
            </div>
          ) : (
            <>
              {/* Distribution Cards Grid */}
              <div className="staff-record-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                {paging.pageItems.map((dist) => {
                  const itemsList = parseItemsList(dist)
                  const { assignedStaff, teamMembers, cleanNotes } = extractTeamAndNotes(dist)
                  const advanceStep = STAFF_ADVANCE[dist.status]

                  return (
                    <div
                      key={dist.dbId || dist.id}
                      className="staff-modern-record-card"
                      style={{
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: '1.15rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        transition: 'box-shadow 0.15s ease',
                      }}
                    >
                      <div>
                        {/* Header Badges */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor: '#fee2e2',
                              color: '#b91c1c',
                              border: '1px solid #fecaca',
                            }}
                          >
                            {dist.program || 'Disaster Relief'}
                          </span>
                          <StatusBadge status={dist.status} />
                        </div>

                        {/* Location */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem' }}>
                          <MapPin size={17} color="#AF101A" style={{ flexShrink: 0 }} />
                          <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 700, color: '#0f172a' }}>
                            {dist.location || dist.barangay || 'Cebu City'}
                          </h3>
                        </div>

                        {/* Schedule & Beneficiaries */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', fontSize: '0.82rem', color: '#64748b', marginBottom: '0.75rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={13} /> {dist.date || 'TBD'}{dist.time || dist.scheduleTime ? ` at ${dist.time || dist.scheduleTime}` : ''}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Users size={13} /> <strong>{dist.beneficiaries || 0}</strong> beneficiaries
                          </span>
                        </div>

                        {/* Readable Allocated Goods */}
                        <div style={{ background: '#f8fafc', padding: '0.65rem 0.75rem', borderRadius: '6px', border: '1px solid #f1f5f9', marginBottom: '0.75rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                            <Package size={13} color="#AF101A" /> Allocated Goods ({itemsList.length} items):
                          </span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {itemsList.slice(0, 3).map((item, idx) => (
                              <span
                                key={idx}
                                style={{
                                  fontSize: '0.74rem',
                                  background: '#fff',
                                  border: '1px solid #cbd5e1',
                                  padding: '2px 7px',
                                  borderRadius: '4px',
                                  color: '#1e293b',
                                  fontWeight: 500,
                                }}
                              >
                                {item.name} {item.quantity > 1 ? `× ${item.quantity}` : ''}
                              </span>
                            ))}
                            {itemsList.length > 3 && (
                              <span style={{ fontSize: '0.72rem', color: '#64748b', alignSelf: 'center', padding: '2px 4px' }}>
                                +{itemsList.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Team Assignment */}
                        {(assignedStaff || teamMembers.length > 0) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#475569', marginBottom: '0.65rem' }}>
                            <UserCheck size={14} color="#0284c7" />
                            <span>
                              <strong>Team:</strong> {assignedStaff}
                              {teamMembers.length > 0 && ` • ${teamMembers.join(', ')}`}
                            </span>
                          </div>
                        )}

                        {/* Clean Notes if present */}
                        {cleanNotes && (
                          <div style={{ fontSize: '0.76rem', color: '#64748b', fontStyle: 'italic', marginBottom: '0.5rem' }}>
                            Notes: {cleanNotes}
                          </div>
                        )}
                      </div>

                      {/* Card Actions: Single arrow only */}
                      <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                        <button
                          type="button"
                          className="btn btn--sm btn--outline"
                          style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                          onClick={() => openDistribution(dist)}
                        >
                          <Eye size={14} /> Details
                        </button>

                        {advanceStep ? (
                          <button
                            type="button"
                            className={`btn btn--sm ${advanceStep.next === 'Completed' ? 'btn--success' : 'btn--primary'}`}
                            style={{ flex: 1.2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                            disabled={saving}
                            onClick={() => handleAdvanceStatus(dist)}
                            title={`Advance to ${advanceStep.next}`}
                          >
                            <ArrowRight size={14} /> {advanceStep.next}
                          </button>
                        ) : dist.status === 'Delivered' ? (
                          <span style={{ flex: 1.2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.78rem', color: '#047857', fontWeight: 600, background: '#ecfdf5', borderRadius: '4px', border: '1px solid #a7f3d0', padding: '4px 8px' }}>
                            <CheckCircle size={13} /> Delivered
                          </span>
                        ) : dist.status === 'Completed' ? (
                          <span style={{ flex: 1.2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.78rem', color: '#16a34a', fontWeight: 600, background: '#f0fdf4', borderRadius: '4px', border: '1px solid #bbf7d0', padding: '4px 8px' }}>
                            <CheckCircle size={13} /> Completed
                          </span>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>

              <Pagination
                page={paging.page}
                totalPages={paging.totalPages}
                total={paging.total}
                startIndex={paging.startIndex}
                endIndex={paging.endIndex}
                onPageChange={paging.setPage}
                noun="distributions"
              />
            </>
          )}
        </section>

        {/* Distribution Details Modal */}
        {selectedDistribution && (() => {
          const itemsList = parseItemsList(selectedDistribution)
          const { assignedStaff, teamMembers, cleanNotes } = extractTeamAndNotes(selectedDistribution)
          const advanceStep = STAFF_ADVANCE[selectedDistribution.status]
          const canUploadPhotos = ['In Transit', 'Delivered', 'Proof Review', 'Completed'].includes(selectedDistribution.status)

          return (
            <PortalModal>
              <div className="admin-modal-overlay" onClick={closeDistribution}>
              <div className="admin-modal admin-modal--wide staff-admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '780px' }}>
                <ModalHeader
                  title={`Distribution Event – ${selectedDistribution.id || 'DST'}`}
                  onClose={closeDistribution}
                />

                <div className="staff-admin-modal__body">

                {/* Top Badges & Ref Code */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: '#fee2e2',
                      color: '#b91c1c',
                      border: '1px solid #fecaca',
                    }}
                  >
                    {selectedDistribution.program || 'Disaster Relief'}
                  </span>
                  <StatusBadge status={selectedDistribution.status} />
                  {selectedDistribution.id && (
                    <span style={{ fontSize: '0.78rem', color: '#64748b', marginLeft: 'auto' }}>
                      Ref Code: <strong>{selectedDistribution.id}</strong>
                    </span>
                  )}
                </div>

                {/* Mini Progress Stepper (Synchronized with Admin) */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  marginBottom: '1rem',
                  overflowX: 'auto',
                  gap: '0.5rem',
                }}>
                  {TRACKER_STEPS.map((step, idx) => {
                    const normStatus = selectedDistribution.status === 'Awaiting Proof' ? 'Delivered' : selectedDistribution.status
                    const currIdx = TRACKER_STEPS.indexOf(normStatus)
                    const isDone = currIdx > idx
                    const isActive = currIdx === idx

                    return (
                      <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: isDone ? '#16a34a' : (isActive ? '#AF101A' : '#e2e8f0'),
                          color: isDone || isActive ? '#fff' : '#64748b',
                          transition: 'all 0.2s',
                        }}>
                          {isDone ? '✓' : idx + 1}
                        </div>
                        <span style={{
                          fontSize: '0.78rem',
                          fontWeight: isActive ? 700 : (isDone ? 600 : 500),
                          color: isActive ? '#AF101A' : (isDone ? '#1e293b' : '#94a3b8'),
                        }}>
                          {step}
                        </span>
                        {idx < TRACKER_STEPS.length - 1 && (
                          <div style={{
                            width: '24px',
                            height: '2px',
                            background: isDone ? '#16a34a' : '#cbd5e1',
                            margin: '0 4px',
                          }} />
                        )}
                      </div>
                    )
                  })}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Section 1: Location & Schedule */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', textTransform: 'uppercase', color: '#475569', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={15} color="#AF101A" /> Location & Schedule
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Location / Site</span>
                        <strong style={{ color: '#0f172a' }}>{selectedDistribution.location || selectedDistribution.barangay || '—'}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Target Date</span>
                        <strong style={{ color: '#0f172a' }}>{selectedDistribution.date || 'Scheduled Date'}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Schedule Time</span>
                        <strong style={{ color: '#0f172a' }}>{selectedDistribution.time || selectedDistribution.scheduleTime || '09:00 AM'}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Dispatch Route</span>
                        <span style={{ color: '#1e293b' }}>{selectedDistribution.route || `Depot → ${selectedDistribution.location || 'Site'}`}</span>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Distribution Details & Beneficiaries */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', textTransform: 'uppercase', color: '#475569', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Users size={15} color="#AF101A" /> Distribution Scope & Beneficiaries
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Registered Beneficiaries</span>
                        <strong style={{ fontSize: '1.25rem', color: '#0f172a' }}>
                          {selectedDistribution.beneficiaries || 0} Families / Individuals
                        </strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Operational Program</span>
                        <strong style={{ fontSize: '1rem', color: '#1e293b' }}>
                          {selectedDistribution.program || 'Community Relief Aid'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Allocated Items (Itemized, Readable) */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', textTransform: 'uppercase', color: '#475569', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Boxes size={15} color="#AF101A" /> Allocated Items & Relief Packs ({itemsList.length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {itemsList.map((item, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: '#fff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '0.5rem 0.75rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.85rem',
                          }}
                        >
                          <span style={{ fontWeight: 600, color: '#1e293b' }}>{item.name}</span>
                          <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, color: '#0f172a', fontSize: '0.8rem' }}>
                            Qty: {item.quantity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Section 4: Team Assignment */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', textTransform: 'uppercase', color: '#475569', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <UserCheck size={15} color="#AF101A" /> Team Assignment
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Assigned Staff Lead</span>
                        <strong style={{ color: '#0f172a' }}>{assignedStaff}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Volunteers Assigned</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                          {teamMembers.length > 0 ? (
                            teamMembers.map((vol, idx) => (
                              <span
                                key={idx}
                                style={{
                                  fontSize: '0.74rem',
                                  padding: '2px 8px',
                                  borderRadius: '9999px',
                                  background: '#e0f2fe',
                                  color: '#0369a1',
                                  fontWeight: 600,
                                }}
                              >
                                {vol}
                              </span>
                            ))
                          ) : (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>None assigned</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 5: Notes & Special Instructions */}
                  {cleanNotes && (
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                      <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', textTransform: 'uppercase', color: '#475569', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Info size={15} color="#64748b" /> Operational Notes
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#334155' }}>{cleanNotes}</p>
                    </div>
                  )}

                  <section className="staff-distribution-photos" aria-labelledby="distribution-photos-title">
                    <div className="staff-distribution-photos__heading">
                      <div>
                        <h4 id="distribution-photos-title"><ImageIcon size={16} /> Distribution Photos</h4>
                        <p>Upload 2–3 photos from the actual distribution. Saving a new set replaces the current set.</p>
                      </div>
                      {canUploadPhotos && (
                        <label className="btn btn--outline btn--sm staff-distribution-photos__picker">
                          <Upload size={15} /> Choose Photos
                          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={handlePhotoSelection} />
                        </label>
                      )}
                    </div>

                    {photoDrafts.length > 0 ? (
                      <div className="distribution-photo-grid">
                        {photoDrafts.map((draft, index) => (
                          <div className="distribution-photo-card distribution-photo-card--draft" key={draft.preview}>
                            <img src={draft.preview} alt={`Distribution preview ${index + 1}`} />
                            <button type="button" onClick={() => removePhotoDraft(index)} aria-label={`Remove ${draft.file.name}`} title="Remove photo">
                              <Trash2 size={14} />
                            </button>
                            <span>{draft.file.name}</span>
                          </div>
                        ))}
                      </div>
                    ) : Array.isArray(selectedDistribution.distributionPhotos) && selectedDistribution.distributionPhotos.length > 0 ? (
                      <div className="distribution-photo-grid">
                        {selectedDistribution.distributionPhotos.map((photo, index) => (
                          <a className="distribution-photo-card" key={photo.id} href={getAuthenticatedFileUrl(photo.fileUrl)} target="_blank" rel="noreferrer">
                            <img src={getAuthenticatedFileUrl(photo.fileUrl)} alt={`Distribution update ${index + 1}`} />
                            <span>{photo.fileName || `Distribution photo ${index + 1}`}</span>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="distribution-photo-empty"><ImageIcon size={20} /> {canUploadPhotos ? 'No distribution photos saved yet.' : 'Photo uploads open when the distribution is in transit.'}</div>
                    )}

                    {photoDrafts.length > 0 && (
                      <div className="staff-distribution-photos__save-row">
                        <input value={photoNotes} onChange={(event) => setPhotoNotes(event.target.value)} maxLength={300} placeholder="Optional short update for donors" />
                        <button type="button" className="btn btn--success btn--sm" disabled={photoSaving || photoDrafts.length < 2} onClick={saveDistributionPhotos}>
                          <Upload size={15} /> {photoSaving ? 'Saving…' : 'Save Photos'}
                        </button>
                      </div>
                    )}
                    {photoDrafts.length === 1 && <p className="distribution-photo-validation">Add one more photo before saving.</p>}
                  </section>

                  {/* Section 6: Activity History / Timeline */}
                  {Array.isArray(selectedDistribution.statusActivity) && selectedDistribution.statusActivity.length > 0 && (
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                      <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', textTransform: 'uppercase', color: '#475569', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <History size={15} color="#64748b" /> Event Activity Log
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                        {selectedDistribution.statusActivity.map((act, idx) => (
                          <div key={idx} style={{ fontSize: '0.8rem', color: '#475569', borderLeft: '2px solid #cbd5e1', paddingLeft: '8px' }}>
                            <strong>{act.title}</strong> — {act.message} <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>({act.at})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Footer Actions: Single arrow only */}
                <div className="admin-modal__actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: '1.25rem' }}>
                  <button type="button" className="btn btn--ghost" onClick={closeDistribution}>
                    Close
                  </button>

                  {advanceStep ? (
                    <button
                      type="button"
                      className={`btn ${advanceStep.next === 'Completed' ? 'btn--success' : 'btn--primary'}`}
                      disabled={saving}
                      onClick={() => handleAdvanceStatus(selectedDistribution)}
                    >
                      <ArrowRight size={16} /> Advance Status to "{advanceStep.next}"
                    </button>
                  ) : selectedDistribution.status === 'Delivered' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#047857', fontWeight: 600 }}>
                      <CheckCircle size={16} /> Delivered to site. Awaiting barangay proof of receipt.
                    </div>
                  ) : selectedDistribution.status === 'Completed' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#16a34a', fontWeight: 600 }}>
                      <CheckCircle size={16} /> Distribution successfully completed and verified.
                    </div>
                  ) : null}
                </div>
                </div>
              </div>
              </div>
            </PortalModal>
          )
        })()}
      </div>
    </ApiState>
  )
}
