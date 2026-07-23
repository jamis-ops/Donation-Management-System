import { useEffect, useState } from 'react'
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

const WORKFLOW = ['Planning', 'Preparing', 'In Transit', 'Delivered', 'Awaiting Proof', 'Completed']
const PROOF_STATUS = ['Not Required', 'Awaiting Proof', 'Proof Submitted', 'Proof Verified', 'Proof Rejected']

const filterConfig = {
  searchKeys: ['id', 'barangay', 'location', 'program', 'coordinator'],
  filters: [
    { key: 'status', label: 'Status' },
    { key: 'proofStatus', label: 'Proof', allLabel: 'All Proof States' },
    { key: 'receiptStatus', label: 'Receipt', allLabel: 'All Receipt States' },
    { key: 'type', label: 'Type' },
    { key: 'program', label: 'Program' },
  ],
  dateKey: 'date',
}

const emptyForm = {
  eventName: '', location: '', beneficiaryId: '', program: '', distributionDate: '', scheduleTime: '',
  beneficiaries: '', volunteers: '', vehicles: '', distanceKm: '', status: 'Planning',
  type: 'Delivery', itemsSummary: '', coordinator: '', notes: '', proofStatus: 'Awaiting Proof',
}

// Fuel/manpower estimation constants (editable defaults).
const KM_PER_LITER = 8
const FUEL_PRICE = 65 // ₱ per liter
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

export default function DistributionsPage() {
  const { data, loading, error, reload } = useApiList(() => distributionsApi.list())
  const { data: barangays } = useApiList(() => beneficiariesApi.list())
  const filters = useFilters(data, filterConfig)
  const [detailRow, setDetailRow] = useState(null)
  const [editRow, setEditRow] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [manpowerSkills, setManpowerSkills] = useState(['Logistics / Driving', 'Packing / Repacking'])
  const [manpowerSuggestions, setManpowerSuggestions] = useState([])

  useEffect(() => {
    if (!(showCreate || editRow)) return
    if (!manpowerSkills.length) {
      setManpowerSuggestions([])
      return
    }
    volunteerMatchApi.suggest({ skills: manpowerSkills, programs: form.program ? [form.program] : [], limit: 5 })
      .then((res) => setManpowerSuggestions(Array.isArray(res.data) ? res.data : []))
      .catch(() => setManpowerSuggestions([]))
  }, [showCreate, editRow, manpowerSkills, form.program])

  const openEdit = (row) => {
    setEditRow(row)
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
    })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.beneficiaryId) {
      alert('Please select a Target Barangay for this distribution event.')
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
        await distributionsApi.create(payload)
        setShowCreate(false)
      }
      reload()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const advanceStatus = async (row) => {
    const idx = WORKFLOW.indexOf(row.status)
    if (idx < 0 || idx >= WORKFLOW.length - 1) return
    await distributionsApi.update(row.dbId, { status: WORKFLOW[idx + 1] })
    reload()
  }

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'eventName', label: 'Event', render: (row) => row.eventName || row.location },
    { key: 'barangay', label: 'Barangay' },
    { key: 'location', label: 'Location' },
    { key: 'program', label: 'Program' },
    { key: 'date', label: 'Date' },
    { key: 'itemsSummary', label: 'Items' },
    { key: 'coordinator', label: 'Coordinator' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'proofStatus', label: 'Proof', render: (row) => <StatusBadge status={row.proofStatus} /> },
    {
      key: 'receiptStatus',
      label: 'Receipt',
      render: (row) => (
        <span title={row.receiptNotes || ''}>
          <StatusBadge status={row.receiptStatus} />
          {row.receivedQuantity != null ? <small style={{ display: 'block', color: '#64748b' }}>{row.receivedQuantity} recvd</small> : null}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions">
          <button type="button" className="btn btn--sm btn--outline" onClick={() => setDetailRow(row)}>Details</button>
          <button type="button" className="btn btn--sm btn--outline" onClick={() => openEdit(row)}>Edit</button>
          {WORKFLOW.indexOf(row.status) < WORKFLOW.length - 1 && (
            <button type="button" className="btn btn--sm btn--primary" onClick={() => advanceStatus(row)}>Advance</button>
          )}
        </div>
      ),
    },
  ]

  const FormFields = (
    <>
      <label>Distribution Event Name
        <input
          value={form.eventName}
          onChange={(e) => setForm({ ...form, eventName: e.target.value })}
          placeholder="e.g. July Food Pack Delivery — Brgy. Talisay"
        />
      </label>
      <label>Target Barangay *
        <select
          required
          value={form.beneficiaryId}
          onChange={(e) => {
            const id = e.target.value
            const brgy = barangays.find((b) => String(b.dbId) === id)
            setForm({
              ...form,
              beneficiaryId: id,
              location: form.location || brgy?.barangay || brgy?.name || '',
              eventName: form.eventName || (brgy ? `Distribution — ${brgy.barangay || brgy.name}` : ''),
            })
          }}
        >
          <option value="">Select barangay…</option>
          {barangays.map((b) => (
            <option key={b.dbId} value={b.dbId}>{b.barangay || b.name} — {b.affectedFamilies} families</option>
          ))}
        </select>
      </label>
      <label>Location / Drop-off Point<input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>
      <div className="form-row">
        <label>Program<input value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })} /></label>
        <label>Distribution Date<input type="date" value={form.distributionDate} onChange={(e) => setForm({ ...form, distributionDate: e.target.value })} /></label>
        <label>Schedule Time<input type="time" value={form.scheduleTime} onChange={(e) => setForm({ ...form, scheduleTime: e.target.value })} /></label>
      </div>
      <label>Items Summary<textarea rows={2} value={form.itemsSummary} onChange={(e) => setForm({ ...form, itemsSummary: e.target.value })} placeholder="50 rice sacks, 100 hygiene kits..." /></label>
      <div className="form-row">
        <label>Fulfillment Type
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {['Delivery', 'Pickup', 'Mobile Distribution'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>Beneficiaries Count<input type="number" min="0" value={form.beneficiaries} onChange={(e) => setForm({ ...form, beneficiaries: e.target.value })} /></label>
        <label>Coordinator<input value={form.coordinator} onChange={(e) => setForm({ ...form, coordinator: e.target.value })} /></label>
      </div>

      {form.type === 'Delivery' && (
        <fieldset className="logistics-fieldset">
          <legend>Delivery Logistics</legend>
          <div className="form-row">
            <label>Manpower (Volunteers)<input type="number" min="0" value={form.volunteers} onChange={(e) => setForm({ ...form, volunteers: e.target.value })} /></label>
            <label>Vehicles<input type="number" min="0" value={form.vehicles} onChange={(e) => setForm({ ...form, vehicles: e.target.value })} /></label>
            <label>Distance one-way (km)<input type="number" min="0" step="0.1" value={form.distanceKm} onChange={(e) => setForm({ ...form, distanceKm: e.target.value })} /></label>
          </div>
          {(() => {
            const est = estimateLogistics(form)
            return (
              <div className="logistics-estimate">
                <div><span>Est. Fuel</span><strong>{est.liters} L</strong></div>
                <div><span>Est. Fuel Cost</span><strong>₱{est.cost.toLocaleString()}</strong></div>
                <div><span>Suggested Manpower</span><strong>{est.suggestedManpower}</strong></div>
              </div>
            )
          })()}
          <p className="logistics-hint">Estimates assume round trip at {KM_PER_LITER} km/L, ₱{FUEL_PRICE}/L, and 1 volunteer per {BENEFICIARIES_PER_VOLUNTEER} beneficiaries.</p>
        </fieldset>
      )}
      {form.type !== 'Delivery' && (
        <div className="form-row">
          <label>Manpower (Volunteers)<input type="number" min="0" value={form.volunteers} onChange={(e) => setForm({ ...form, volunteers: e.target.value })} /></label>
          <label>Vehicles<input type="number" min="0" value={form.vehicles} onChange={(e) => setForm({ ...form, vehicles: e.target.value })} /></label>
        </div>
      )}

      <section className="suggested-volunteers">
        <div className="suggested-volunteers__head">
          <h4>Suggested volunteers (manpower)</h4>
          <span>For planning — assign tasks from Volunteers after confirming</span>
        </div>
        <SkillTagPicker
          label="Skills needed for this distribution"
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
      </section>

      <div className="form-row">
        <label>Status
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {WORKFLOW.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>Proof Status
          <select value={form.proofStatus} onChange={(e) => setForm({ ...form, proofStatus: e.target.value })}>
            {PROOF_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <label>Notes<textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
    </>
  )

  return (
    <>
      <PageHeader
        title="Distribution Logistics"
        description="Plan relief distributions, track logistics workflow, and assign events to barangays. Proof review is handled under Beneficiaries → Proofs."
        actions={<button type="button" className="btn btn--primary" onClick={() => { setShowCreate(true); setForm(emptyForm) }}>+ Plan Distribution</button>}
      />

      <FilterBar
        controller={filters}
        searchPlaceholder="Search by ID, barangay, location, or coordinator..."
        exportConfig={{ filename: 'distribution-report', title: 'Distribution Report', columns, rows: filters.filtered }}
      />

      <ApiState loading={loading} error={error} onRetry={reload}>
        <DataTable columns={columns} data={filters.filtered} onRowClick={setDetailRow} />
      </ApiState>

      {detailRow && (
        <div className="admin-modal-overlay" onClick={() => setDetailRow(null)}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title={`Distribution ${detailRow.id}`} onClose={() => setDetailRow(null)} />
            <WorkflowStepper steps={WORKFLOW} currentStatus={detailRow.status} />
            <dl className="detail-list">
              <dt>Barangay</dt><dd>{detailRow.barangay || '—'}</dd>
              <dt>Location</dt><dd>{detailRow.location}</dd>
              <dt>Program</dt><dd>{detailRow.program}</dd>
              <dt>Type</dt><dd>{detailRow.type}</dd>
              <dt>Schedule</dt><dd>{detailRow.date}{detailRow.scheduleTime ? ` at ${detailRow.scheduleTime}` : ''}</dd>
              <dt>Items</dt><dd>{detailRow.itemsSummary || '—'}</dd>
              <dt>Coordinator</dt><dd>{detailRow.coordinator || '—'}</dd>
              <dt>Manpower / Vehicles</dt><dd>{detailRow.volunteers} volunteers · {detailRow.vehicles} vehicles</dd>
              {detailRow.type === 'Delivery' && (
                <>
                  <dt>Distance</dt><dd>{detailRow.distanceKm != null ? `${detailRow.distanceKm} km (one-way)` : '—'}</dd>
                  <dt>Est. Fuel</dt><dd>{detailRow.fuelLiters != null ? `${detailRow.fuelLiters} L · ₱${Number(detailRow.fuelCost || 0).toLocaleString()}` : '—'}</dd>
                </>
              )}
              <dt>Receipt Status</dt><dd><StatusBadge status={detailRow.receiptStatus} />{detailRow.receivedQuantity != null ? ` · ${detailRow.receivedQuantity} received` : ''}</dd>
              <dt>Proof Status</dt><dd><StatusBadge status={detailRow.proofStatus} /></dd>
              <dt>Proofs Uploaded</dt><dd>{detailRow.proofsCount}</dd>
              <dt>Notes</dt><dd>{detailRow.notes || '—'}</dd>
            </dl>
            <div className="admin-modal__actions">
              <button type="button" className="btn btn--primary" onClick={() => { openEdit(detailRow); setDetailRow(null) }}>Edit Record</button>
              <button type="button" className="btn btn--ghost" onClick={() => setDetailRow(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {(editRow || showCreate) && (
        <div className="admin-modal-overlay" onClick={() => { setEditRow(null); setShowCreate(false) }}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title={editRow ? `Edit ${editRow.id}` : 'Plan New Distribution'}
              onClose={() => { setEditRow(null); setShowCreate(false) }}
            />
            {editRow && <WorkflowStepper steps={WORKFLOW} currentStatus={form.status} />}
            <form onSubmit={handleSave}>
              {FormFields}
              <div className="admin-modal__actions">
                <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                <button type="button" className="btn btn--ghost" onClick={() => { setEditRow(null); setShowCreate(false) }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
