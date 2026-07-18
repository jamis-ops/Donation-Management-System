import { useState } from 'react'
import { distributionsApi, beneficiariesApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import PageHeader from '../../components/admin/shared/PageHeader'
import DataTable from '../../components/admin/shared/DataTable'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import WorkflowStepper from '../../components/admin/shared/WorkflowStepper'
import ApiState from '../../components/admin/shared/ApiState'

const WORKFLOW = ['Planning', 'Preparing', 'In Transit', 'Delivered', 'Awaiting Proof', 'Completed']
const PROOF_STATUS = ['Not Required', 'Awaiting Proof', 'Proof Submitted', 'Proof Verified', 'Proof Rejected']

const emptyForm = {
  location: '', beneficiaryId: '', program: '', distributionDate: '',
  beneficiaries: '', volunteers: '', vehicles: '', status: 'Planning',
  type: 'Delivery', itemsSummary: '', coordinator: '', notes: '', proofStatus: 'Awaiting Proof',
}

export default function DistributionsPage() {
  const { data, loading, error, reload } = useApiList(() => distributionsApi.list())
  const { data: barangays } = useApiList(() => beneficiariesApi.list())
  const [detailRow, setDetailRow] = useState(null)
  const [editRow, setEditRow] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const openEdit = (row) => {
    setEditRow(row)
    setForm({
      location: row.location || '',
      beneficiaryId: row.beneficiaryId || '',
      program: row.program || '',
      distributionDate: row.distributionDate || '',
      beneficiaries: row.beneficiaries || '',
      volunteers: row.volunteers || '',
      vehicles: row.vehicles || '',
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
    setSaving(true)
    try {
      const payload = {
        location: form.location,
        beneficiaryId: form.beneficiaryId ? Number(form.beneficiaryId) : null,
        program: form.program,
        distributionDate: form.distributionDate,
        beneficiaries: Number(form.beneficiaries) || 0,
        volunteers: Number(form.volunteers) || 0,
        vehicles: Number(form.vehicles) || 0,
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
    { key: 'barangay', label: 'Barangay' },
    { key: 'location', label: 'Location' },
    { key: 'program', label: 'Program' },
    { key: 'date', label: 'Date' },
    { key: 'itemsSummary', label: 'Items' },
    { key: 'coordinator', label: 'Coordinator' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'proofStatus', label: 'Proof', render: (row) => <StatusBadge status={row.proofStatus} /> },
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
      <label>Location / Drop-off Point<input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>
      <label>Target Barangay
        <select value={form.beneficiaryId} onChange={(e) => setForm({ ...form, beneficiaryId: e.target.value })}>
          <option value="">Select barangay</option>
          {barangays.map((b) => (
            <option key={b.dbId} value={b.dbId}>{b.barangay} — {b.affectedFamilies} families</option>
          ))}
        </select>
      </label>
      <div className="form-row">
        <label>Program<input value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })} /></label>
        <label>Distribution Date<input type="date" value={form.distributionDate} onChange={(e) => setForm({ ...form, distributionDate: e.target.value })} /></label>
      </div>
      <label>Items Summary<textarea rows={2} value={form.itemsSummary} onChange={(e) => setForm({ ...form, itemsSummary: e.target.value })} placeholder="50 rice sacks, 100 hygiene kits..." /></label>
      <div className="form-row">
        <label>Beneficiaries Count<input type="number" min="0" value={form.beneficiaries} onChange={(e) => setForm({ ...form, beneficiaries: e.target.value })} /></label>
        <label>Volunteers<input type="number" min="0" value={form.volunteers} onChange={(e) => setForm({ ...form, volunteers: e.target.value })} /></label>
        <label>Vehicles<input type="number" min="0" value={form.vehicles} onChange={(e) => setForm({ ...form, vehicles: e.target.value })} /></label>
      </div>
      <label>Coordinator<input value={form.coordinator} onChange={(e) => setForm({ ...form, coordinator: e.target.value })} /></label>
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
        <label>Type
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {['Delivery', 'Pickup', 'Mobile Distribution'].map((t) => <option key={t} value={t}>{t}</option>)}
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
        description="Plan relief distributions, track workflow status, and manage proof verification from barangay representatives."
        actions={<button type="button" className="btn btn--primary" onClick={() => { setShowCreate(true); setForm(emptyForm) }}>+ Plan Distribution</button>}
      />

      <ApiState loading={loading} error={error} onRetry={reload}>
        <DataTable columns={columns} data={data} onRowClick={setDetailRow} />
      </ApiState>

      {detailRow && (
        <div className="admin-modal-overlay" onClick={() => setDetailRow(null)}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <h2>Distribution {detailRow.id}</h2>
            <WorkflowStepper steps={WORKFLOW} currentStatus={detailRow.status} />
            <dl className="detail-list">
              <dt>Barangay</dt><dd>{detailRow.barangay || '—'}</dd>
              <dt>Location</dt><dd>{detailRow.location}</dd>
              <dt>Program</dt><dd>{detailRow.program}</dd>
              <dt>Items</dt><dd>{detailRow.itemsSummary || '—'}</dd>
              <dt>Coordinator</dt><dd>{detailRow.coordinator || '—'}</dd>
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
            <h2>{editRow ? `Edit ${editRow.id}` : 'Plan New Distribution'}</h2>
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
