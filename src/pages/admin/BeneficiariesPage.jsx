import { useState } from 'react'
import { beneficiariesApi, assistanceRequestsApi, getDistributionProofs, reviewProof } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import PageHeader from '../../components/admin/shared/PageHeader'
import DataTable from '../../components/admin/shared/DataTable'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'

const STATUS_OPTIONS = ['Pending Approval', 'Approved', 'Active', 'Suspended']
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High']

const emptyForm = {
  barangay: '', municipality: '', category: 'Disaster Relief', affectedFamilies: '',
  representativeName: '', representativePhone: '', representativeEmail: '', notes: '', status: 'Pending Approval',
}

export default function BeneficiariesPage() {
  const { data: beneficiaries, loading, error, reload } = useApiList(() => beneficiariesApi.list())
  const { data: assistanceRequests, loading: reqLoading, error: reqError, reload: reloadReq } = useApiList(() => assistanceRequestsApi.list())
  const { data: proofs, loading: proofLoading, error: proofError, reload: reloadProofs } = useApiList(() => getDistributionProofs())
  const [tab, setTab] = useState('barangays')
  const [showForm, setShowForm] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const openCreate = () => { setEditRow(null); setForm(emptyForm); setShowForm(true) }
  const openEdit = (row) => {
    setEditRow(row)
    setForm({
      barangay: row.barangay || row.name,
      municipality: row.municipality || '',
      category: row.category || '',
      affectedFamilies: row.affectedFamilies || '',
      representativeName: row.representativeName || '',
      representativePhone: row.representativePhone || '',
      representativeEmail: row.representativeEmail || '',
      notes: row.notes || '',
      status: row.status,
    })
    setShowForm(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        barangay: form.barangay,
        municipality: form.municipality,
        category: form.category,
        affectedFamilies: Number(form.affectedFamilies) || 0,
        representativeName: form.representativeName,
        representativePhone: form.representativePhone,
        representativeEmail: form.representativeEmail,
        notes: form.notes,
        status: form.status,
      }
      if (editRow) {
        await beneficiariesApi.update(editRow.dbId, payload)
      } else {
        await beneficiariesApi.create(payload)
      }
      setShowForm(false)
      reload()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const totalFamilies = beneficiaries.reduce((s, b) => s + (b.affectedFamilies || 0), 0)

  const barangayColumns = [
    { key: 'id', label: 'Code' },
    { key: 'barangay', label: 'Barangay' },
    { key: 'municipality', label: 'Municipality/City' },
    { key: 'affectedFamilies', label: 'Affected Families' },
    { key: 'representativeName', label: 'Representative' },
    { key: 'category', label: 'Program' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'proofsSubmitted', label: 'Proofs' },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions">
          <button type="button" className="btn btn--sm btn--outline" onClick={() => openEdit(row)}>Edit</button>
        </div>
      ),
    },
  ]

  const requestColumns = [
    { key: 'id', label: 'Reference' },
    { key: 'beneficiary', label: 'Barangay' },
    { key: 'type', label: 'Assistance Type' },
    { key: 'date', label: 'Submitted' },
    {
      key: 'priority',
      label: 'Priority',
      render: (row) => (
        <select
          className="inline-select"
          value={row.priority}
          onChange={(e) => assistanceRequestsApi.update(row.dbId, { priority: e.target.value }).then(reloadReq)}
        >
          {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <select
          className="inline-select"
          value={row.status}
          onChange={(e) => assistanceRequestsApi.update(row.dbId, { status: e.target.value }).then(reloadReq)}
        >
          {['Pending Review', 'Under Review', 'Approved', 'Allocated', 'Rejected'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      ),
    },
  ]

  const proofColumns = [
    { key: 'distributionCode', label: 'Distribution' },
    { key: 'barangay', label: 'Barangay' },
    { key: 'fileName', label: 'File' },
    { key: 'submittedAt', label: 'Submitted' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions">
          <a href={row.fileUrl} target="_blank" rel="noreferrer" className="btn btn--sm btn--outline">View</a>
          {row.status === 'Pending Review' && (
            <>
              <button type="button" className="btn btn--sm btn--primary" onClick={() => reviewProof(row.id, 'Verified').then(reloadProofs)}>Verify</button>
              <button type="button" className="btn btn--sm btn--outline" onClick={() => reviewProof(row.id, 'Rejected').then(reloadProofs)}>Reject</button>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Barangay Beneficiary Management"
        description="Manage barangays, affected families, assistance requests, and distribution proof submissions."
        actions={<button type="button" className="btn btn--primary" onClick={openCreate}>+ Register Barangay</button>}
      />

      <div className="admin-stats-grid admin-stats-grid--compact">
        <div className="admin-stat-card"><span className="admin-stat-card__value">{beneficiaries.length}</span><span className="admin-stat-card__label">Barangays Registered</span></div>
        <div className="admin-stat-card"><span className="admin-stat-card__value">{totalFamilies.toLocaleString()}</span><span className="admin-stat-card__label">Total Affected Families</span></div>
        <div className="admin-stat-card"><span className="admin-stat-card__value">{proofs.filter((p) => p.status === 'Pending Review').length}</span><span className="admin-stat-card__label">Proofs Pending Review</span></div>
      </div>

      <div className="admin-tabs">
        <button type="button" className={`admin-tab${tab === 'barangays' ? ' admin-tab--active' : ''}`} onClick={() => setTab('barangays')}>Barangays</button>
        <button type="button" className={`admin-tab${tab === 'requests' ? ' admin-tab--active' : ''}`} onClick={() => setTab('requests')}>Assistance Requests</button>
        <button type="button" className={`admin-tab${tab === 'proofs' ? ' admin-tab--active' : ''}`} onClick={() => setTab('proofs')}>Distribution Proofs</button>
      </div>

      {tab === 'barangays' && (
        <ApiState loading={loading} error={error} onRetry={reload}>
          <DataTable columns={barangayColumns} data={beneficiaries} onRowClick={openEdit} />
        </ApiState>
      )}
      {tab === 'requests' && (
        <ApiState loading={reqLoading} error={reqError} onRetry={reloadReq}>
          <DataTable columns={requestColumns} data={assistanceRequests} />
        </ApiState>
      )}
      {tab === 'proofs' && (
        <ApiState loading={proofLoading} error={proofError} onRetry={reloadProofs}>
          <DataTable columns={proofColumns} data={proofs} />
        </ApiState>
      )}

      {showForm && (
        <div className="admin-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <h2>{editRow ? 'Edit Barangay' : 'Register Barangay'}</h2>
            <form onSubmit={handleSave}>
              <div className="form-row">
                <label>Barangay Name<input required value={form.barangay} onChange={(e) => setForm({ ...form, barangay: e.target.value })} placeholder="Brgy. Talisay" /></label>
                <label>Municipality/City<input value={form.municipality} onChange={(e) => setForm({ ...form, municipality: e.target.value })} placeholder="Talisay City" /></label>
              </div>
              <div className="form-row">
                <label>Affected Families<input type="number" min="0" required value={form.affectedFamilies} onChange={(e) => setForm({ ...form, affectedFamilies: e.target.value })} /></label>
                <label>Program Category<input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label>
              </div>
              <div className="form-row">
                <label>Representative Name<input value={form.representativeName} onChange={(e) => setForm({ ...form, representativeName: e.target.value })} /></label>
                <label>Representative Phone<input value={form.representativePhone} onChange={(e) => setForm({ ...form, representativePhone: e.target.value })} /></label>
              </div>
              <label>Representative Email<input type="email" value={form.representativeEmail} onChange={(e) => setForm({ ...form, representativeEmail: e.target.value })} /></label>
              <label>Status
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label>Notes<textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
              <div className="admin-modal__actions">
                <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                <button type="button" className="btn btn--ghost" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
