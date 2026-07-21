import { useState } from 'react'
import { allocationsApi, beneficiariesApi } from '../../api/resources'
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

export default function AllocationPage() {
  const { data, loading, error, reload } = useApiList(() => allocationsApi.list())
  const { data: barangays } = useApiList(() => beneficiariesApi.list())
  const filters = useFilters(data, filterConfig)
  const [editRow, setEditRow] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ resource: '', quantity: '', program: '', beneficiaryId: '', status: 'Pending', priority: 'Medium', notes: '' })
  const [saving, setSaving] = useState(false)

  const openEdit = (row) => {
    setEditRow(row)
    setForm({
      resource: row.resource,
      quantity: row.quantity,
      program: row.program || '',
      beneficiaryId: row.beneficiaryId || '',
      status: row.status,
      priority: row.priority || 'Medium',
      notes: row.notes || '',
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
    { key: 'quantity', label: 'Qty' },
    { key: 'program', label: 'Program' },
    { key: 'beneficiary', label: 'Barangay Target' },
    {
      key: 'priority',
      label: 'Priority',
      render: (row) => <StatusBadge status={row.priority} />,
    },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'date', label: 'Date' },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <button type="button" className="btn btn--sm btn--outline" onClick={() => openEdit(row)}>Edit</button>
      ),
    },
  ]

  const FormFields = (
    <>
      <label>Resource<input required value={form.resource} onChange={(e) => setForm({ ...form, resource: e.target.value })} /></label>
      <div className="form-row">
        <label>Quantity<input type="number" min="1" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label>
        <label>Program<input value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })} /></label>
      </div>
      <label>Target Barangay
        <select value={form.beneficiaryId} onChange={(e) => setForm({ ...form, beneficiaryId: e.target.value })}>
          <option value="">Select barangay</option>
          {barangays.map((b) => (
            <option key={b.dbId} value={b.dbId}>{b.barangay} ({b.affectedFamilies} families)</option>
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
        description="Allocate inventory to barangays. Update priority and status as resources are reserved and delivered."
        actions={<button type="button" className="btn btn--primary" onClick={() => { setShowCreate(true); setForm({ resource: '', quantity: '', program: '', beneficiaryId: '', status: 'Pending', priority: 'Medium', notes: '' }) }}>+ New Allocation</button>}
      />
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
