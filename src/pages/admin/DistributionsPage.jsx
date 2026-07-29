import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Eye, Pencil, ArrowRightCircle, MapPin, Calendar, Package, Users,
  Truck, UserRound, FileCheck, ClipboardList, Route, Fuel, StickyNote,
} from 'lucide-react'
import { distributionsApi, beneficiariesApi, volunteerMatchApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { useFilters } from '../../hooks/useFilters'
import PageHeader from '../../components/admin/shared/PageHeader'
import DataTable from '../../components/admin/shared/DataTable'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import WorkflowStepper from '../../components/admin/shared/WorkflowStepper'
import ApiState from '../../components/admin/shared/ApiState'
import FilterBar from '../../components/admin/shared/FilterBar'
import ModalHeader from '../../components/admin/shared/ModalHeader'
import SkillTagPicker from '../../components/shared/SkillTagPicker'
import RowActionsMenu from '../../components/admin/shared/RowActionsMenu'
import { useSeeMore } from '../../hooks/useSeeMore'
import { SeeMoreToggle } from '../../components/admin/shared/SeeMoreList'
import { notify } from '../../utils/toast'

const WORKFLOW = ['Planning', 'Preparing', 'In Transit', 'Delivered', 'Awaiting Proof', 'Completed']
const PROOF_STATUS = ['Not Required', 'Awaiting Proof', 'Proof Submitted', 'Proof Verified', 'Proof Rejected']

const filterConfig = {
  searchKeys: ['barangay', 'location', 'program', 'coordinator', 'eventName', 'itemsSummary'],
  filters: [
    { key: 'status', label: 'Status' },
  ],
  dateKey: 'date',
}

const emptyForm = {
  eventName: '', location: '', beneficiaryId: '', program: '', distributionDate: '', scheduleTime: '',
  beneficiaries: '', volunteers: '', vehicles: '', distanceKm: '', status: 'Planning',
  type: 'Delivery', itemsSummary: '', coordinator: '', notes: '', proofStatus: 'Awaiting Proof',
  allocationIds: [],
}

function formFromAllocations(allocs, barangays) {
  if (!allocs?.length) return null
  const first = allocs[0]
  const ben = barangays.find((b) => Number(b.dbId) === Number(first.beneficiaryId))
  const location = ben?.barangay || ben?.name || first.beneficiary || ''
  const itemsSummary = allocs.map((a) => `${a.resource} × ${a.quantity}`).join('; ')
  const program = allocs.find((a) => a.program)?.program || ''
  const families = first.affectedFamilies || ben?.affectedFamilies || ''
  return {
    ...emptyForm,
    eventName: location ? `Delivery — ${location}` : '',
    location,
    beneficiaryId: String(first.beneficiaryId || ''),
    program,
    beneficiaries: families ? String(families) : '',
    itemsSummary,
    notes: `From allocation(s): ${allocs.map((a) => a.id).join(', ')}`,
    allocationIds: allocs.map((a) => a.dbId),
    status: 'Planning',
    type: 'Delivery',
    proofStatus: 'Awaiting Proof',
  }
}

export default function DistributionsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { data, loading, error, reload } = useApiList(() => distributionsApi.list())
  const { data: barangays } = useApiList(() => beneficiariesApi.list())
  const filters = useFilters(data, filterConfig)
  const [detailRow, setDetailRow] = useState(null)
  const [editRow, setEditRow] = useState(null)
  const [statusRow, setStatusRow] = useState(null)
  const [statusValue, setStatusValue] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [manpowerSkills, setManpowerSkills] = useState(['Logistics / Driving', 'Packing / Repacking'])
  const [manpowerSuggestions, setManpowerSuggestions] = useState([])
  const [showVolunteerHelp, setShowVolunteerHelp] = useState(false)
  const [selectedDraftIds, setSelectedDraftIds] = useState([])
  const [grouping, setGrouping] = useState(false)

  const planningDrafts = useMemo(() => {
    return (data || []).filter((d) => d.status === 'Planning')
  }, [data])
  const draftsSeeMore = useSeeMore(planningDrafts, 3)

  const handleGroupDrafts = async () => {
    if (selectedDraftIds.length < 2) {
      notify.warning('Select at least 2 draft distributions for the same barangay to group.')
      return
    }
    setGrouping(true)
    try {
      const res = await fetch('/api/distributions.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'group', distributionIds: selectedDraftIds }),
        credentials: 'include',
      }).then((r) => r.json())

      if (res?.ok) {
        setSelectedDraftIds([])
        reload()
        notify.success('Draft distributions grouped.')
      } else {
        notify.error(res?.error || 'Failed to group distributions')
      }
    } catch (err) {
      notify.error(err.message)
    } finally {
      setGrouping(false)
    }
  }

  useEffect(() => {
    const incoming = location.state?.fromAllocations
    if (!incoming?.length || !barangays.length) return
    const prefilled = formFromAllocations(incoming, barangays)
    if (prefilled) {
      setForm(prefilled)
      setShowCreate(true)
      setEditRow(null)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, location.pathname, barangays, navigate])

  useEffect(() => {
    if (!(showCreate || editRow) || !showVolunteerHelp) return
    if (!manpowerSkills.length) {
      setManpowerSuggestions([])
      return
    }
    volunteerMatchApi.suggest({ skills: manpowerSkills, programs: form.program ? [form.program] : [], limit: 5 })
      .then((res) => setManpowerSuggestions(Array.isArray(res.data) ? res.data : []))
      .catch(() => setManpowerSuggestions([]))
  }, [showCreate, editRow, showVolunteerHelp, manpowerSkills, form.program])

  const openEdit = (row) => {
    setEditRow(row)
    setDetailRow(null)
    setStatusRow(null)
    setShowVolunteerHelp(false)
    setForm({
      eventName: row.eventName || '',
      location: row.location || '',
      beneficiaryId: row.beneficiaryId || '',
      program: row.program || '',
      distributionDate: row.distributionDate || '',
      scheduleTime: row.scheduleTime || '',
      beneficiaries: row.beneficiaries || '',
      volunteers: row.volunteers || '',
      vehicles: row.vehicles || '',
      distanceKm: row.distanceKm ?? '',
      status: row.status,
      type: row.type || 'Delivery',
      itemsSummary: row.itemsSummary || '',
      coordinator: row.coordinator || '',
      notes: row.notes || '',
      proofStatus: row.proofStatus || 'Awaiting Proof',
      allocationIds: row.allocationIds || [],
    })
  }

  const openStatus = (row) => {
    setStatusRow(row)
    setStatusValue(row.status)
    setDetailRow(null)
  }

  const closeForm = () => {
    setEditRow(null)
    setShowCreate(false)
    setShowVolunteerHelp(false)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.beneficiaryId) {
      notify.warning('Please select a barangay for this delivery.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        eventName: form.eventName,
        location: form.location,
        beneficiaryId: Number(form.beneficiaryId),
        program: form.program,
        distributionDate: form.distributionDate,
        scheduleTime: form.scheduleTime,
        beneficiaries: Number(form.beneficiaries) || 0,
        volunteers: Number(form.volunteers) || 0,
        vehicles: Number(form.vehicles) || 0,
        distanceKm: form.type === 'Delivery' && form.distanceKm !== '' ? Number(form.distanceKm) : '',
        status: form.status,
        type: form.type,
        itemsSummary: form.itemsSummary,
        coordinator: form.coordinator,
        notes: form.notes,
        proofStatus: form.proofStatus,
      }

      if (editRow) {
        await distributionsApi.update(editRow.dbId, payload)
        setEditRow(null)
      } else {
        if (form.allocationIds?.length) {
          payload.allocationIds = form.allocationIds.map(Number)
        }
        await distributionsApi.create(payload)
        setShowCreate(false)
      }
      setShowVolunteerHelp(false)
      reload()
      notify.success(editRow ? 'Delivery updated.' : 'Delivery created.')
    } catch (err) {
      notify.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateStatus = async (e) => {
    e.preventDefault()
    if (!statusRow) return
    setSaving(true)
    try {
      await distributionsApi.update(statusRow.dbId, { status: statusValue })
      setStatusRow(null)
      setDetailRow(null)
      reload()
      notify.success('Delivery status updated.')
    } catch (err) {
      notify.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    if (!confirm('Delete this delivery? This cannot be undone.')) return
    try {
      await distributionsApi.remove(row.dbId)
      setDetailRow(null)
      setEditRow(null)
      reload()
      notify.success('Delivery deleted.')
    } catch (err) {
      notify.error(err.message || 'Failed to delete distribution')
    }
  }

  const fromAllocation = !!form.allocationIds?.length

  const columns = [
    {
      key: 'request',
      label: 'Request ID',
      render: (row) => (
        <span className="alloc-request-id" title={row.request?.type || ''}>
          {row.request?.id || (row.requestId ? `#${row.requestId}` : '—')}
        </span>
      ),
    },
    {
      key: 'eventName',
      label: 'Delivery',
      render: (row) => (
        <div className="dist-cell-primary">
          <strong>{row.eventName || row.location || '—'}</strong>
          {row.itemsSummary ? <span>{row.itemsSummary}</span> : null}
        </div>
      ),
    },
    { key: 'barangay', label: 'Barangay' },
    { key: 'date', label: 'Date', render: (row) => row.date || '—' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <RowActionsMenu
          items={[
            { label: 'View', icon: <Eye size={14} />, onClick: () => setDetailRow(row) },
            { label: 'Edit', icon: <Pencil size={14} />, onClick: () => openEdit(row) },
            {
              label: 'Update status',
              icon: <ArrowRightCircle size={14} />,
              onClick: () => openStatus(row),
              hidden: WORKFLOW.indexOf(row.status) >= WORKFLOW.length - 1,
            },
          ]}
        />
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Logistics & Distribution"
        description="Schedule and track deliveries. Approved resource allocations appear in the Ready to Schedule Queue below automatically."
        actions={
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setForm(emptyForm)
              setShowCreate(true)
              setEditRow(null)
              setShowVolunteerHelp(false)
            }}
          >
            + Plan Delivery
          </button>
        }
      />

      {planningDrafts.length > 0 && (
        <section className="admin-panel" style={{ marginBottom: '24px', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📅 Ready to Schedule Queue ({planningDrafts.length})
              </h2>
              <p style={{ margin: '4px 0 0', color: 'var(--admin-text-muted, #94a3b8)', fontSize: '0.88rem' }}>
                Auto-drafted distributions from approved allocations. Select date, team, and logistics to schedule delivery.
              </p>
            </div>
            {selectedDraftIds.length > 1 && (
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={handleGroupDrafts}
                disabled={grouping}
              >
                {grouping ? 'Grouping...' : `Group Selected (${selectedDraftIds.length}) into 1 Distribution`}
              </button>
            )}
          </div>

          <div className="see-more-wrap">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {draftsSeeMore.visible.map((draft) => {
              const isSelected = selectedDraftIds.includes(draft.dbId)
              return (
                <div
                  key={draft.dbId}
                  style={{
                    background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'var(--admin-surface, #1e293b)',
                    border: isSelected ? '1px solid #3b82f6' : '1px solid var(--admin-border, #334155)',
                    borderRadius: '10px',
                    padding: '16px',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedDraftIds((prev) => [...prev, draft.dbId])
                          } else {
                            setSelectedDraftIds((prev) => prev.filter((id) => id !== draft.dbId))
                          }
                        }}
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--admin-text-muted, #94a3b8)' }}>
                        Draft
                      </span>
                    </div>
                    <StatusBadge status={draft.status} />
                  </div>

                  <h3 style={{ margin: '0 0 6px', fontSize: '1rem', color: 'var(--admin-text, #f1f5f9)' }}>
                    {draft.barangay || draft.eventName || 'Barangay'}
                  </h3>

                  <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '12px' }}>
                    📦 <strong>Items:</strong> {draft.itemsSummary || 'Packs allocated'}
                  </div>

                  {draft.requestPriority && (
                    <div style={{ fontSize: '0.8rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Urgency:</span>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        background: draft.requestPriority === 'Critical' ? '#fee2e2' : '#fefce8',
                        color: draft.requestPriority === 'Critical' ? '#dc2626' : '#d97706',
                      }}>
                        {draft.requestPriority}
                      </span>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      style={{ flex: 1 }}
                      onClick={() => openEdit(draft)}
                    >
                      Schedule Delivery &rarr;
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          {draftsSeeMore.needsToggle && (
            <SeeMoreToggle
              expanded={draftsSeeMore.expanded}
              onToggle={draftsSeeMore.toggle}
              hiddenCount={draftsSeeMore.hiddenCount}
            />
          )}
          </div>
        </section>
      )}

      <FilterBar
        controller={filters}
        searchPlaceholder="Search deliveries by barangay or event..."
        exportConfig={{ filename: 'distribution-report', title: 'Distribution Report', columns, rows: filters.filtered }}
      />

      <ApiState loading={loading} error={error} onRetry={reload}>
        <DataTable columns={columns} data={filters.filtered} onRowClick={setDetailRow} initialVisible={5} />
      </ApiState>

      {detailRow && (
        <div className="admin-modal-overlay" onClick={() => setDetailRow(null)}>
          <div className="admin-modal admin-modal--xl dist-detail-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title="Delivery details"
              subtitle={detailRow.eventName || detailRow.barangay || detailRow.location || 'Logistics event'}
              onClose={() => setDetailRow(null)}
            />

            <div className="dist-detail">
              <header className="dist-detail__hero">
                <div className="dist-detail__hero-main">
                  <h3 className="dist-detail__title">
                    {detailRow.eventName || detailRow.location || 'Untitled delivery'}
                  </h3>
                  <div className="dist-detail__meta">
                    <span>
                      <MapPin size={14} aria-hidden />
                      {[detailRow.barangay, detailRow.barangayMunicipality || detailRow.location]
                        .filter(Boolean)
                        .filter((v, i, arr) => arr.indexOf(v) === i)
                        .join(' · ') || '—'}
                    </span>
                    <span>
                      <Calendar size={14} aria-hidden />
                      {detailRow.date || 'Unscheduled'}
                      {detailRow.scheduleTime ? ` · ${detailRow.scheduleTime}` : ''}
                    </span>
                    {detailRow.program ? (
                      <span>
                        <ClipboardList size={14} aria-hidden />
                        {detailRow.program}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="dist-detail__hero-aside">
                  <StatusBadge status={detailRow.status} />
                  {detailRow.type ? <span className="dist-detail__pill">{detailRow.type}</span> : null}
                  {(detailRow.request?.id || detailRow.requestId) ? (
                    <span className="alloc-request-id" title={detailRow.request?.type || 'Linked request'}>
                      {detailRow.request?.id || `#${detailRow.requestId}`}
                    </span>
                  ) : null}
                </div>
              </header>

              <section className="dist-detail__progress" aria-label="Delivery progress">
                <WorkflowStepper steps={WORKFLOW} currentStatus={detailRow.status} />
              </section>

              <div className="dist-detail__metrics">
                <div className="dist-detail__metric">
                  <Users size={16} aria-hidden />
                  <div>
                    <strong>{detailRow.beneficiaries ?? '—'}</strong>
                    <span>Families</span>
                  </div>
                </div>
                <div className="dist-detail__metric">
                  <UserRound size={16} aria-hidden />
                  <div>
                    <strong>{detailRow.volunteers ?? 0}</strong>
                    <span>Volunteers</span>
                  </div>
                </div>
                <div className="dist-detail__metric">
                  <Truck size={16} aria-hidden />
                  <div>
                    <strong>{detailRow.vehicles ?? 0}</strong>
                    <span>Vehicles</span>
                  </div>
                </div>
                <div className="dist-detail__metric">
                  <Route size={16} aria-hidden />
                  <div>
                    <strong>
                      {detailRow.distanceKm != null ? `${detailRow.distanceKm} km` : '—'}
                    </strong>
                    <span>Distance</span>
                  </div>
                </div>
              </div>

              <div className="dist-detail__grid">
                <section className="dist-detail__card">
                  <h4>
                    <Package size={15} aria-hidden />
                    Cargo & request
                  </h4>
                  <dl className="dist-detail__list">
                    <div>
                      <dt>Items</dt>
                      <dd>
                        {detailRow.itemsSummary ? (
                          <ul className="dist-detail__items">
                            {String(detailRow.itemsSummary)
                              .split(/;|\n/)
                              .map((item) => item.trim())
                              .filter(Boolean)
                              .map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                          </ul>
                        ) : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Request ID</dt>
                      <dd>
                        {detailRow.request?.id || detailRow.requestId ? (
                          <span className="alloc-request-id">
                            {detailRow.request?.id || `#${detailRow.requestId}`}
                            {detailRow.request?.type ? ` · ${detailRow.request.type}` : ''}
                          </span>
                        ) : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Request status</dt>
                      <dd>
                        {detailRow.request?.status
                          ? <StatusBadge status={detailRow.request.status} />
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Location</dt>
                      <dd>{detailRow.location || '—'}</dd>
                    </div>
                  </dl>
                </section>

                <section className="dist-detail__card">
                  <h4>
                    <Truck size={15} aria-hidden />
                    Logistics
                  </h4>
                  <dl className="dist-detail__list">
                    <div>
                      <dt>Coordinator</dt>
                      <dd>{detailRow.coordinator || 'Unassigned'}</dd>
                    </div>
                    <div>
                      <dt>Type</dt>
                      <dd>{detailRow.type || '—'}</dd>
                    </div>
                    {detailRow.fuelLiters != null && (
                      <div>
                        <dt><span className="dist-detail__dt-inline"><Fuel size={12} aria-hidden /> Fuel</span></dt>
                        <dd>
                          {detailRow.fuelLiters} L
                          {detailRow.fuelCost != null ? ` · ₱${Number(detailRow.fuelCost).toLocaleString()}` : ''}
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt>From allocation</dt>
                      <dd>
                        {(detailRow.allocations || []).length ? (
                          <ul className="dist-detail__items">
                            {detailRow.allocations.map((a) => (
                              <li key={a.dbId || a.id || `${a.resource}-${a.quantity}`}>
                                {a.resource} × {a.quantity}
                              </li>
                            ))}
                          </ul>
                        ) : 'Manual / none'}
                      </dd>
                    </div>
                  </dl>
                </section>

                <section className="dist-detail__card dist-detail__card--wide">
                  <h4>
                    <FileCheck size={15} aria-hidden />
                    Proof & receipt
                  </h4>
                  <div className="dist-detail__status-row">
                    <div className="dist-detail__status-block">
                      <span className="dist-detail__status-label">Proof</span>
                      <StatusBadge status={detailRow.proofStatus} />
                      <small>{detailRow.proofsCount ?? 0} uploaded</small>
                    </div>
                    <div className="dist-detail__status-block">
                      <span className="dist-detail__status-label">Receipt</span>
                      <StatusBadge status={detailRow.receiptStatus} />
                      <small>
                        {detailRow.receivedQuantity != null
                          ? `${detailRow.receivedQuantity} received${detailRow.receivedAt ? ` · ${detailRow.receivedAt}` : ''}`
                          : 'Awaiting confirmation'}
                      </small>
                    </div>
                  </div>
                  {detailRow.receiptNotes ? (
                    <p className="dist-detail__notes-inline">{detailRow.receiptNotes}</p>
                  ) : null}
                </section>

                {detailRow.notes ? (
                  <section className="dist-detail__card dist-detail__card--wide dist-detail__card--notes">
                    <h4>
                      <StickyNote size={15} aria-hidden />
                      Notes
                    </h4>
                    <p className="dist-detail__notes">{detailRow.notes}</p>
                  </section>
                ) : null}
              </div>
            </div>

            <div className="admin-modal__actions">
              <button type="button" className="btn btn--primary" onClick={() => openEdit(detailRow)}>Edit</button>
              {WORKFLOW.indexOf(detailRow.status) < WORKFLOW.length - 1 && (
                <button type="button" className="btn btn--outline" onClick={() => openStatus(detailRow)}>Update status</button>
              )}
              <button type="button" className="btn btn--outline" onClick={() => handleDelete(detailRow)}>Delete</button>
              <button type="button" className="btn btn--ghost" onClick={() => setDetailRow(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {statusRow && (
        <div className="admin-modal-overlay" onClick={() => setStatusRow(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title="Update status" onClose={() => setStatusRow(null)} />
            <form onSubmit={handleUpdateStatus}>
              <p className="dist-status-hint">
                {statusRow.eventName || statusRow.barangay || 'Delivery'}
              </p>
              <label>
                Current progress
                <select required value={statusValue} onChange={(e) => setStatusValue(e.target.value)}>
                  {WORKFLOW.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <div className="admin-modal__actions">
                <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                <button type="button" className="btn btn--ghost" onClick={() => setStatusRow(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {(editRow || showCreate) && (
        <div className="admin-modal-overlay" onClick={closeForm}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title={editRow ? 'Edit delivery' : 'Plan delivery'}
              onClose={closeForm}
            />

            {fromAllocation && (
              <div className="alloc-handoff-banner">
                Items and barangay were filled from Resource Allocation. Add the schedule and logistics, then save.
              </div>
            )}
            {editRow && <WorkflowStepper steps={WORKFLOW} currentStatus={form.status} />}

            <form onSubmit={handleSave} className="dist-form">
              <fieldset className="dist-form-section">
                <legend>1. Where & what</legend>
                <label>
                  Delivery name
                  <input
                    value={form.eventName}
                    onChange={(e) => setForm({ ...form, eventName: e.target.value })}
                    placeholder="e.g. Food pack delivery — Brgy. Talisay"
                  />
                </label>
                <label>
                  Barangay *
                  <select
                    required
                    disabled={fromAllocation}
                    value={form.beneficiaryId}
                    onChange={(e) => {
                      const id = e.target.value
                      const brgy = barangays.find((b) => String(b.dbId) === id)
                      setForm({
                        ...form,
                        beneficiaryId: id,
                        location: form.location || brgy?.barangay || brgy?.name || '',
                        eventName: form.eventName || (brgy ? `Delivery — ${brgy.barangay || brgy.name}` : ''),
                        beneficiaries: form.beneficiaries || String(brgy?.affectedFamilies || ''),
                      })
                    }}
                  >
                    <option value="">Select barangay…</option>
                    {barangays.map((b) => (
                      <option key={b.dbId} value={b.dbId}>{b.barangay || b.name} — {b.affectedFamilies || 0} families</option>
                    ))}
                  </select>
                </label>
                <label>
                  Drop-off location *
                  <input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                </label>
                <label>
                  Items to deliver
                  <textarea
                    rows={2}
                    value={form.itemsSummary}
                    onChange={(e) => setForm({ ...form, itemsSummary: e.target.value })}
                    placeholder="e.g. Rice packs × 50; Hygiene kits × 30"
                    readOnly={fromAllocation}
                  />
                </label>
              </fieldset>

              <fieldset className="dist-form-section">
                <legend>2. When</legend>
                <div className="form-row">
                  <label>
                    Date
                    <input type="date" value={form.distributionDate} onChange={(e) => setForm({ ...form, distributionDate: e.target.value })} />
                  </label>
                  <label>
                    Time
                    <input type="time" value={form.scheduleTime} onChange={(e) => setForm({ ...form, scheduleTime: e.target.value })} />
                  </label>
                  <label>
                    Delivery type
                    <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                      {['Delivery', 'Pickup', 'Mobile Distribution'].map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </label>
                </div>
                <div className="form-row">
                  <label>
                    Families / recipients
                    <input type="number" min="0" value={form.beneficiaries} onChange={(e) => setForm({ ...form, beneficiaries: e.target.value })} />
                  </label>
                  <label>
                    Coordinator
                    <input value={form.coordinator} onChange={(e) => setForm({ ...form, coordinator: e.target.value })} placeholder="Who is in charge?" />
                  </label>
                </div>
              </fieldset>

              <fieldset className="dist-form-section">
                <legend>3. Logistics</legend>
                <div className="form-row">
                  <label>
                    Volunteers needed
                    <input type="number" min="0" value={form.volunteers} onChange={(e) => setForm({ ...form, volunteers: e.target.value })} />
                  </label>
                  <label>
                    Vehicles
                    <input type="number" min="0" value={form.vehicles} onChange={(e) => setForm({ ...form, vehicles: e.target.value })} />
                  </label>
                  {form.type === 'Delivery' && (
                    <label>
                      Distance one-way (km)
                      <input type="number" min="0" step="0.1" value={form.distanceKm} onChange={(e) => setForm({ ...form, distanceKm: e.target.value })} />
                    </label>
                  )}
                </div>

                <button
                  type="button"
                  className="btn btn--ghost btn--sm dist-form-toggle"
                  onClick={() => setShowVolunteerHelp((v) => !v)}
                >
                  {showVolunteerHelp ? 'Hide volunteer suggestions' : 'Suggest volunteers by skill'}
                </button>

                {showVolunteerHelp && (
                  <div className="suggested-volunteers">
                    <SkillTagPicker
                      label="Skills needed"
                      value={manpowerSkills}
                      showOther={false}
                      onChange={setManpowerSkills}
                    />
                    {manpowerSuggestions.length === 0 ? (
                      <p className="beneficiary-view-empty">No matches yet — adjust skills above.</p>
                    ) : (
                      <ul className="suggested-volunteers__list">
                        {manpowerSuggestions.map((s) => (
                          <li key={s.dbId} className="suggested-volunteers__item">
                            <div>
                              <strong>{s.name}</strong>
                              <p>{s.whyMatched}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </fieldset>

              <fieldset className="dist-form-section">
                <legend>4. Status (optional)</legend>
                <div className="form-row">
                  <label>
                    Workflow status
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      {WORKFLOW.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                  <label>
                    Proof requirement
                    <select value={form.proofStatus} onChange={(e) => setForm({ ...form, proofStatus: e.target.value })}>
                      {PROOF_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                </div>
                <label>
                  Notes
                  <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes for the team" />
                </label>
              </fieldset>

              <div className="admin-modal__actions">
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'Saving...' : (editRow ? 'Save changes' : 'Save delivery')}
                </button>
                <button type="button" className="btn btn--ghost" onClick={closeForm}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
