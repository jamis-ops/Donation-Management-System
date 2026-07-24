import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Eye, Pencil, Trash2, ArrowRightCircle } from 'lucide-react'
import { distributionsApi, beneficiariesApi, volunteerMatchApi, allocationsApi } from '../../api/resources'
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

const WORKFLOW = ['Planning', 'Preparing', 'In Transit', 'Delivered', 'Awaiting Proof', 'Completed']
const PROOF_STATUS = ['Not Required', 'Awaiting Proof', 'Proof Submitted', 'Proof Verified', 'Proof Rejected']

const filterConfig = {
  searchKeys: ['id', 'barangay', 'location', 'program', 'coordinator', 'eventName'],
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

const KM_PER_LITER = 8
const FUEL_PRICE = 65
const BENEFICIARIES_PER_VOLUNTEER = 40

function estimateLogistics({ distanceKm, vehicles, beneficiaries }) {
  const dist = Number(distanceKm) || 0
  const veh = Number(vehicles) || 0
  const ben = Number(beneficiaries) || 0
  const liters = dist > 0 && veh > 0 ? +(((dist * 2) / KM_PER_LITER) * veh).toFixed(1) : 0
  const cost = +(liters * FUEL_PRICE).toFixed(2)
  const suggestedManpower = ben > 0 ? Math.max(veh, Math.ceil(ben / BENEFICIARIES_PER_VOLUNTEER)) : veh
  return { liters, cost, suggestedManpower }
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
  const { data: readyAllocations, reload: reloadReady } = useApiList(() => allocationsApi.listReadyForDistribution())
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
  const [selectedReadyIds, setSelectedReadyIds] = useState([])
  const [showVolunteerHelp, setShowVolunteerHelp] = useState(false)

  const readyByBarangay = useMemo(() => {
    const map = new Map()
    for (const a of readyAllocations || []) {
      const key = a.beneficiaryId || a.beneficiary || 'unknown'
      if (!map.has(key)) {
        map.set(key, { label: a.beneficiary || 'Barangay', items: [] })
      }
      map.get(key).items.push(a)
    }
    return [...map.values()]
  }, [readyAllocations])

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

  const openCreateFromReady = () => {
    const picked = (readyAllocations || []).filter((a) => selectedReadyIds.includes(a.dbId))
    if (!picked.length) {
      alert('Select the packs you want to deliver for one barangay.')
      return
    }
    const benIds = [...new Set(picked.map((a) => a.beneficiaryId))]
    if (benIds.length !== 1) {
      alert('Please select packs for only one barangay at a time.')
      return
    }
    const prefilled = formFromAllocations(picked, barangays)
    setForm(prefilled)
    setShowCreate(true)
    setEditRow(null)
    setShowVolunteerHelp(false)
  }

  const selectBarangayGroup = (items) => {
    const ids = items.map((i) => i.dbId)
    const allSelected = ids.every((id) => selectedReadyIds.includes(id))
    setSelectedReadyIds((prev) => (
      allSelected
        ? prev.filter((id) => !ids.includes(id))
        : [...new Set([...prev, ...ids])]
    ))
  }

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
      alert('Please select a barangay for this delivery.')
      return
    }
    setSaving(true)
    try {
      const est = estimateLogistics(form)
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
        fuelLiters: form.type === 'Delivery' ? est.liters : '',
        fuelCost: form.type === 'Delivery' ? est.cost : '',
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
        setSelectedReadyIds([])
        reloadReady()
      }
      setShowVolunteerHelp(false)
      reload()
    } catch (err) {
      alert(err.message)
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
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    if (!confirm(`Delete delivery ${row.id}? This cannot be undone.`)) return
    try {
      await distributionsApi.remove(row.dbId)
      setDetailRow(null)
      setEditRow(null)
      reload()
      reloadReady()
    } catch (err) {
      alert(err.message || 'Failed to delete distribution')
    }
  }

  const fromAllocation = !!form.allocationIds?.length
  const est = estimateLogistics(form)

  const columns = [
    { key: 'id', label: 'ID' },
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
        <div className="table-actions" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="icon-btn" title="View details" aria-label="View details" onClick={() => setDetailRow(row)}>
            <Eye size={15} />
          </button>
          <button type="button" className="icon-btn" title="Edit" aria-label="Edit" onClick={() => openEdit(row)}>
            <Pencil size={15} />
          </button>
          {WORKFLOW.indexOf(row.status) < WORKFLOW.length - 1 && (
            <button type="button" className="icon-btn icon-btn--success" title="Update status" aria-label="Update status" onClick={() => openStatus(row)}>
              <ArrowRightCircle size={15} />
            </button>
          )}
          <button type="button" className="icon-btn icon-btn--danger" title="Delete" aria-label="Delete" onClick={() => handleDelete(row)}>
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Logistics & Distribution"
        description="Schedule and track deliveries. Packs and barangay come from Resource Allocation — add date, vehicles, and manpower here."
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

      {(readyAllocations || []).length > 0 && (
        <section className="admin-panel dist-ready-panel">
          <div className="dist-ready-panel__head">
            <div>
              <h2>Ready to deliver</h2>
              <p>These packs are already reserved/allocated. Pick one barangay’s items, then plan the delivery.</p>
            </div>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={!selectedReadyIds.length}
              onClick={openCreateFromReady}
            >
              Plan selected ({selectedReadyIds.length})
            </button>
          </div>

          <div className="dist-ready-groups">
            {readyByBarangay.map((group) => {
              const ids = group.items.map((i) => i.dbId)
              const selectedCount = ids.filter((id) => selectedReadyIds.includes(id)).length
              const allSelected = selectedCount === ids.length
              return (
                <div key={group.label} className="dist-ready-group">
                  <div className="dist-ready-group__head">
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => selectBarangayGroup(group.items)}
                    >
                      {allSelected ? 'Clear' : 'Select all'} · {group.label}
                    </button>
                    <span>{group.items.length} item{group.items.length === 1 ? '' : 's'}</span>
                  </div>
                  <div className="dist-ready-list">
                    {group.items.map((a) => {
                      const checked = selectedReadyIds.includes(a.dbId)
                      return (
                        <label key={a.dbId} className={`dist-ready-item${checked ? ' dist-ready-item--selected' : ''}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedReadyIds((prev) => (
                                checked ? prev.filter((id) => id !== a.dbId) : [...prev, a.dbId]
                              ))
                            }}
                          />
                          <div>
                            <strong>{a.resource} × {a.quantity}</strong>
                            <span>{a.id}</span>
                          </div>
                          <StatusBadge status={a.status} />
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <FilterBar
        controller={filters}
        searchPlaceholder="Search deliveries by ID, barangay, or event..."
        exportConfig={{ filename: 'distribution-report', title: 'Distribution Report', columns, rows: filters.filtered }}
      />

      <ApiState loading={loading} error={error} onRetry={reload}>
        <DataTable columns={columns} data={filters.filtered} onRowClick={setDetailRow} />
      </ApiState>

      {detailRow && (
        <div className="admin-modal-overlay" onClick={() => setDetailRow(null)}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title="Delivery details" onClose={() => setDetailRow(null)} />
            <WorkflowStepper steps={WORKFLOW} currentStatus={detailRow.status} />

            <div className="dist-detail-grid">
              <section className="dist-detail-card">
                <h3>Overview</h3>
                <dl className="detail-list detail-list--compact">
                  <dt>ID</dt><dd>{detailRow.id}</dd>
                  <dt>Event</dt><dd>{detailRow.eventName || '—'}</dd>
                  <dt>Barangay</dt><dd>{detailRow.barangay || '—'}</dd>
                  <dt>Location</dt><dd>{detailRow.location || '—'}</dd>
                  <dt>Items</dt><dd>{detailRow.itemsSummary || '—'}</dd>
                  <dt>Schedule</dt><dd>{detailRow.date || '—'}{detailRow.scheduleTime ? ` · ${detailRow.scheduleTime}` : ''}</dd>
                  <dt>Status</dt><dd><StatusBadge status={detailRow.status} /></dd>
                </dl>
              </section>

              <section className="dist-detail-card">
                <h3>Logistics</h3>
                <dl className="detail-list detail-list--compact">
                  <dt>Type</dt><dd>{detailRow.type || '—'}</dd>
                  <dt>Coordinator</dt><dd>{detailRow.coordinator || '—'}</dd>
                  <dt>Families / recipients</dt><dd>{detailRow.beneficiaries ?? '—'}</dd>
                  <dt>Volunteers</dt><dd>{detailRow.volunteers ?? 0}</dd>
                  <dt>Vehicles</dt><dd>{detailRow.vehicles ?? 0}</dd>
                  {detailRow.type === 'Delivery' && (
                    <>
                      <dt>Distance</dt><dd>{detailRow.distanceKm != null ? `${detailRow.distanceKm} km` : '—'}</dd>
                      <dt>Est. fuel</dt>
                      <dd>
                        {detailRow.fuelLiters != null
                          ? `${detailRow.fuelLiters} L · ₱${Number(detailRow.fuelCost || 0).toLocaleString()}`
                          : '—'}
                      </dd>
                    </>
                  )}
                </dl>
              </section>

              <section className="dist-detail-card">
                <h3>Proof & receipt</h3>
                <dl className="detail-list detail-list--compact">
                  <dt>Proof</dt><dd><StatusBadge status={detailRow.proofStatus} /></dd>
                  <dt>Proofs uploaded</dt><dd>{detailRow.proofsCount ?? 0}</dd>
                  <dt>Receipt</dt>
                  <dd>
                    <StatusBadge status={detailRow.receiptStatus} />
                    {detailRow.receivedQuantity != null ? ` · ${detailRow.receivedQuantity} received` : ''}
                  </dd>
                  <dt>From allocation</dt>
                  <dd>
                    {(detailRow.allocations || []).length
                      ? detailRow.allocations.map((a) => `${a.resource} × ${a.quantity}`).join('; ')
                      : 'Manual / none'}
                  </dd>
                  <dt>Notes</dt><dd>{detailRow.notes || '—'}</dd>
                </dl>
              </section>
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
                {statusRow.eventName || statusRow.barangay || statusRow.id}
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
              title={editRow ? `Edit ${editRow.id}` : 'Plan delivery'}
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
                {form.type === 'Delivery' && (
                  <div className="logistics-estimate">
                    <div><span>Est. fuel</span><strong>{est.liters} L</strong></div>
                    <div><span>Est. cost</span><strong>₱{est.cost.toLocaleString()}</strong></div>
                    <div><span>Suggested volunteers</span><strong>{est.suggestedManpower}</strong></div>
                  </div>
                )}

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
