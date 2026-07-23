import { useEffect, useState } from 'react'
import { allocationsApi, beneficiariesApi, needsStockApi, assistanceRequestsApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { useFilters } from '../../hooks/useFilters'
import PageHeader from '../../components/admin/shared/PageHeader'
import DataTable from '../../components/admin/shared/DataTable'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import FilterBar from '../../components/admin/shared/FilterBar'
import ModalHeader from '../../components/admin/shared/ModalHeader'

const STATUS_OPTIONS = ['Pending', 'Reserved', 'Allocated', 'Delivered', 'Cancelled']
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Critical']

const filterConfig = {
  searchKeys: ['id', 'resource', 'program', 'beneficiary'],
  filters: [
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Priority' },
    { key: 'program', label: 'Program' },
  ],
  dateKey: 'date',
}

const emptyForm = {
  resource: '', quantity: '', program: '', beneficiaryId: '', assistanceRequestId: '',
  status: 'Pending', priority: 'Medium', notes: '',
}

export default function AllocationPage() {
  const { data, loading, error, reload } = useApiList(() => allocationsApi.list())
  const { data: barangays } = useApiList(() => beneficiariesApi.list())
  const { data: requests } = useApiList(() => assistanceRequestsApi.list())
  const filters = useFilters(data, filterConfig)
  const [editRow, setEditRow] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [recs, setRecs] = useState([])
  const [needsSummary, setNeedsSummary] = useState(null)

  useEffect(() => {
    needsStockApi.get()
      .then((res) => {
        setRecs(res.data?.recommendations || [])
        setNeedsSummary(res.data?.summary || null)
      })
      .catch(() => {
        setRecs([])
        setNeedsSummary(null)
      })
  }, [data])

  const openEdit = (row) => {
    setEditRow(row)
    setForm({
      resource: row.resource,
      quantity: row.quantity,
      program: row.program || '',
      beneficiaryId: row.beneficiaryId || '',
      assistanceRequestId: row.assistanceRequestId || '',
      status: row.status,
      priority: row.priority || 'Medium',
      notes: row.notes || '',
    })
  }

  const applyRecommendation = (rec) => {
    setShowCreate(true)
    setEditRow(null)
    setForm({
      resource: rec.resource,
      quantity: String(rec.quantity),
      program: rec.requestType || '',
      beneficiaryId: rec.beneficiaryId || '',
      assistanceRequestId: rec.assistanceRequestId || '',
      status: 'Reserved',
      priority: rec.priority || 'Medium',
      notes: rec.reason || '',
    })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const ben = barangays.find((b) => b.dbId === Number(form.beneficiaryId))
      const payload = {
        resource: form.resource,
        quantity: Number(form.quantity),
        program: form.program,
        beneficiaryId: form.beneficiaryId ? Number(form.beneficiaryId) : null,
        beneficiary: ben?.barangay || ben?.name,
        assistanceRequestId: form.assistanceRequestId ? Number(form.assistanceRequestId) : null,
        status: form.status,
        priority: form.priority,
        notes: form.notes,
      }
      if (editRow) {
        await allocationsApi.update(editRow.dbId, payload)
        setEditRow(null)
      } else {
        await allocationsApi.create(payload)
        setShowCreate(false)
      }
      reload()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'resource', label: 'Resource' },
    { key: 'quantity', label: 'Qty (packs)' },
    { key: 'beneficiary', label: 'Barangay' },
    { key: 'priority', label: 'Priority', render: (row) => <StatusBadge status={row.priority} /> },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'date', label: 'Date' },
  ]

  const FormFields = (
    <>
      <label>Resource (packs)<input required value={form.resource} onChange={(e) => setForm({ ...form, resource: e.target.value })} /></label>
      <div className="form-row">
        <label>Quantity<input type="number" min="1" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label>
        <label>Program<input value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })} /></label>
      </div>
      <label>Linked Assistance Request
        <select value={form.assistanceRequestId} onChange={(e) => setForm({ ...form, assistanceRequestId: e.target.value })}>
          <option value="">None</option>
          {(requests || []).map((r) => (
            <option key={r.dbId} value={r.dbId}>{r.id || r.code} — {r.type} ({r.status})</option>
          ))}
        </select>
      </label>
      <label>Target Barangay
        <select value={form.beneficiaryId} onChange={(e) => setForm({ ...form, beneficiaryId: e.target.value })}>
          <option value="">Select barangay</option>
          {barangays.map((b) => (
            <option key={b.dbId} value={b.dbId}>{b.barangay || b.name} ({b.affectedFamilies} families)</option>
          ))}
        </select>
      </label>
      <div className="form-row">
        <label>Priority
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label>Status
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <label>Notes<textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
    </>
  )

  return (
    <>
      <PageHeader
        title="Resource Allocation"
        description="Allocate pack inventory to barangays from approved assistance requests. Recommendations use needs vs available stock."
        actions={<button type="button" className="btn btn--primary" onClick={() => { setShowCreate(true); setForm(emptyForm) }}>+ New Allocation</button>}
      />

      {needsSummary && (
        <div className="needs-summary-strip">
          <span className="needs-chip needs-chip--shortage">{needsSummary.shortage} shortages</span>
          <span className="needs-chip needs-chip--ok">{needsSummary.sufficient} sufficient</span>
          <span className="needs-chip needs-chip--excess">{needsSummary.excess} excess</span>
          <span className="needs-chip">{needsSummary.totalAvailablePacks} packs available</span>
        </div>
      )}

      {recs.length > 0 && (
        <section className="admin-panel" style={{ marginBottom: '1rem' }}>
          <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Recommended Allocations</h2>
          <div className="volunteer-task-list">
            {recs.slice(0, 6).map((rec) => (
              <article key={`${rec.assistanceRequestId}-${rec.inventoryId}`} className="volunteer-task-card">
                <div className="volunteer-task-card__top">
                  <strong>{rec.resource} × {rec.quantity} {rec.unit}</strong>
                  <StatusBadge status={rec.priority} />
                </div>
                <div className="volunteer-task-card__meta">
                  <span>{rec.requestCode} · {rec.requestType}</span>
                  <span>{rec.beneficiary || '—'}</span>
                  <span>Stock: {rec.available}</span>
                </div>
                <p style={{ margin: '0.4rem 0 0.6rem', fontSize: '0.82rem', color: '#64748b' }}>{rec.reason}</p>
                <button type="button" className="btn btn--sm btn--primary" onClick={() => applyRecommendation(rec)}>
                  Use Recommendation
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      <FilterBar controller={filters} searchPlaceholder="Search by ID, resource, program, or barangay..." />

      <ApiState loading={loading} error={error} onRetry={reload}>
        <DataTable columns={columns} data={filters.filtered} onRowClick={openEdit} />
      </ApiState>

      {(editRow || showCreate) && (
        <div className="admin-modal-overlay" onClick={() => { setEditRow(null); setShowCreate(false) }}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title={editRow ? `Edit Allocation ${editRow.id}` : 'New Allocation'}
              onClose={() => { setEditRow(null); setShowCreate(false) }}
            />
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
