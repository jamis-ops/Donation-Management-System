import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Pencil, Trash2, ArrowRightCircle, Truck } from 'lucide-react'
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
  const navigate = useNavigate()
  const { data, loading, error, reload } = useApiList(() => allocationsApi.list())
  const { data: barangays } = useApiList(() => beneficiariesApi.list())
  const { data: requests } = useApiList(() => assistanceRequestsApi.list())
  const filters = useFilters(data, filterConfig)
  const [detailRow, setDetailRow] = useState(null)
  const [editRow, setEditRow] = useState(null)
  const [statusRow, setStatusRow] = useState(null)
  const [statusValue, setStatusValue] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [recs, setRecs] = useState([])
  const [needsSummary, setNeedsSummary] = useState(null)
  const [beneficiaryNeeds, setBeneficiaryNeeds] = useState([])

  useEffect(() => {
    needsStockApi.get()
      .then((res) => {
        setRecs(res.data?.recommendations || [])
        setNeedsSummary(res.data?.summary || null)
        setBeneficiaryNeeds(res.data?.beneficiaries || [])
      })
      .catch(() => {
        setRecs([])
        setNeedsSummary(null)
        setBeneficiaryNeeds([])
      })
  }, [data])

  const openEdit = (row) => {
    setEditRow(row)
    setDetailRow(null)
    setStatusRow(null)
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

  const openStatus = (row) => {
    setStatusRow(row)
    setStatusValue(row.status)
    setDetailRow(null)
  }

  const applyRecommendation = (rec) => {
    setShowCreate(true)
    setEditRow(null)
    setDetailRow(null)
    setForm({
      resource: rec.resource,
      quantity: String(rec.quantity),
      program: rec.requestType || rec.need || '',
      beneficiaryId: rec.beneficiaryId || '',
      assistanceRequestId: rec.assistanceRequestId || '',
      status: 'Reserved',
      priority: rec.priority || 'Medium',
      notes: rec.reason || '',
    })
  }

  const planDistribution = (rows) => {
    const list = Array.isArray(rows) ? rows : [rows]
    const ready = list.filter((r) => ['Reserved', 'Allocated'].includes(r.status) && !r.distributionId)
    if (!ready.length) {
      alert('Select Reserved/Allocated items that are not yet linked to a distribution.')
      return
    }
    const benIds = [...new Set(ready.map((r) => r.beneficiaryId).filter(Boolean))]
    if (benIds.length !== 1) {
      alert('Plan distribution for one barangay at a time. Select allocations for the same barangay.')
      return
    }
    navigate('/admin/distributions', {
      state: {
        fromAllocations: ready.map((r) => ({
          dbId: r.dbId,
          id: r.id,
          resource: r.resource,
          quantity: r.quantity,
          beneficiaryId: r.beneficiaryId,
          beneficiary: r.beneficiary,
          program: r.program,
          affectedFamilies: r.affectedFamilies,
        })),
      },
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

  const handleUpdateStatus = async (e) => {
    e.preventDefault()
    if (!statusRow) return
    setSaving(true)
    try {
      await allocationsApi.update(statusRow.dbId, { status: statusValue })
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
    if (!confirm(`Delete allocation ${row.id}? This cannot be undone.`)) return
    try {
      await allocationsApi.remove(row.dbId)
      setDetailRow(null)
      setEditRow(null)
      reload()
    } catch (err) {
      alert(err.message || 'Failed to delete allocation')
    }
  }

  const linkedRequest = (row) => {
    if (!row?.assistanceRequestId) return null
    return (requests || []).find((r) => Number(r.dbId) === Number(row.assistanceRequestId))
  }

  const canPlan = (row) => ['Reserved', 'Allocated'].includes(row.status) && !row.distributionId

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'resource', label: 'Resource' },
    { key: 'quantity', label: 'Qty' },
    { key: 'beneficiary', label: 'Barangay' },
    {
      key: 'needs',
      label: 'Needs',
      render: (row) => (
        <span className="alloc-needs-cell" title={(row.beneficiaryNeeds || []).join(', ')}>
          {(row.beneficiaryNeeds || []).slice(0, 2).join(', ') || '—'}
          {(row.beneficiaryNeeds || []).length > 2 ? '…' : ''}
        </span>
      ),
    },
    { key: 'priority', label: 'Priority', render: (row) => <StatusBadge status={row.priority} /> },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'date', label: 'Date' },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="icon-btn" title="View" aria-label="View" onClick={() => setDetailRow(row)}>
            <Eye size={15} />
          </button>
          <button type="button" className="icon-btn" title="Edit" aria-label="Edit" onClick={() => openEdit(row)}>
            <Pencil size={15} />
          </button>
          {row.status !== 'Delivered' && row.status !== 'Cancelled' && (
            <button type="button" className="icon-btn icon-btn--success" title="Update Status" aria-label="Update Status" onClick={() => openStatus(row)}>
              <ArrowRightCircle size={15} />
            </button>
          )}
          {canPlan(row) && (
            <button type="button" className="icon-btn" title="Plan Distribution" aria-label="Plan Distribution" onClick={() => planDistribution(row)}>
              <Truck size={15} />
            </button>
          )}
          <button type="button" className="icon-btn icon-btn--danger" title="Delete" aria-label="Delete" onClick={() => handleDelete(row)}>
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ]

  const FormFields = (
    <>
      <label>Resource (packs)<input required value={form.resource} onChange={(e) => setForm({ ...form, resource: e.target.value })} /></label>
      <div className="form-row">
        <label>Quantity<input type="number" min="1" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label>
        <label>Program / Need<input value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })} /></label>
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
            <option key={b.dbId} value={b.dbId}>
              {b.barangay || b.name} — {b.affectedFamilies || 0} families
              {(b.needs || []).length ? ` · needs: ${(b.needs || []).join(', ')}` : ''}
            </option>
          ))}
        </select>
      </label>
      {form.beneficiaryId && (() => {
        const b = barangays.find((x) => String(x.dbId) === String(form.beneficiaryId))
        if (!b) return null
        return (
          <div className="alloc-ben-context">
            <strong>Barangay context</strong>
            <p>{b.affectedFamilies || 0} affected families</p>
            <div className="alloc-need-tags">
              {(b.needs || []).length
                ? (b.needs || []).map((n) => <span key={n} className="alloc-need-tag">{n}</span>)
                : <span className="alloc-need-tag alloc-need-tag--muted">No needs listed</span>}
            </div>
          </div>
        )
      })()}
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
        description="Match barangay needs and affected families to available inventory. Confirm quantities here, then use Plan Distribution to schedule delivery."
        actions={
          <button type="button" className="btn btn--primary" onClick={() => { setShowCreate(true); setForm(emptyForm) }}>+ New Allocation</button>
        }
      />

      {needsSummary && (
        <div className="needs-summary-strip">
          <span className="needs-chip needs-chip--shortage">{needsSummary.shortage} shortages</span>
          <span className="needs-chip needs-chip--ok">{needsSummary.sufficient} sufficient</span>
          <span className="needs-chip needs-chip--excess">{needsSummary.excess} excess</span>
          <span className="needs-chip">{needsSummary.totalAvailablePacks} packs available</span>
        </div>
      )}

      {beneficiaryNeeds.length > 0 && (
        <section className="admin-panel alloc-needs-panel">
          <h2>Barangay Needs Overview</h2>
          <p className="alloc-panel-hint">Needs and family counts used to calculate recommended pack quantities (≈ 1 pack per family per need).</p>
          <div className="alloc-needs-grid">
            {beneficiaryNeeds.slice(0, 8).map((b) => (
              <article key={b.beneficiaryId} className="alloc-needs-card">
                <div className="alloc-needs-card__top">
                  <strong>{b.name}</strong>
                  <StatusBadge status={b.status} />
                </div>
                <p className="alloc-needs-card__meta">{b.affectedFamilies} affected families</p>
                <div className="alloc-need-tags">
                  {(b.needs || []).length
                    ? b.needs.map((n) => <span key={n} className="alloc-need-tag">{n}</span>)
                    : <span className="alloc-need-tag alloc-need-tag--muted">No needs listed</span>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {recs.length > 0 && (
        <section className="admin-panel alloc-recs-panel">
          <h2>Recommended Allocations</h2>
          <p className="alloc-panel-hint">Auto-matched from barangay needs × affected families against available inventory.</p>
          <div className="volunteer-task-list">
            {recs.slice(0, 8).map((rec) => (
              <article key={`${rec.assistanceRequestId || 'b'}-${rec.beneficiaryId}-${rec.inventoryId}-${rec.need}`} className="volunteer-task-card">
                <div className="volunteer-task-card__top">
                  <strong>{rec.resource} × {rec.quantity} {rec.unit}</strong>
                  <StatusBadge status={rec.priority} />
                </div>
                <div className="volunteer-task-card__meta">
                  <span>{rec.beneficiary || '—'}</span>
                  <span>{rec.affectedFamilies || 0} families</span>
                  <span>Need: {rec.need || rec.requestType}</span>
                  <span>Stock: {rec.available}</span>
                </div>
                {(rec.beneficiaryNeeds || []).length > 0 && (
                  <div className="alloc-need-tags" style={{ marginTop: '0.45rem' }}>
                    {rec.beneficiaryNeeds.map((n) => <span key={n} className="alloc-need-tag">{n}</span>)}
                  </div>
                )}
                <p style={{ margin: '0.4rem 0 0.6rem', fontSize: '0.82rem', color: '#64748b' }}>{rec.reason}</p>
                <button type="button" className="btn btn--sm btn--primary" onClick={() => applyRecommendation(rec)}>
                  Use Recommendation
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      <FilterBar
        controller={filters}
        searchPlaceholder="Search by ID, resource, program, or barangay..."
        exportConfig={{ filename: 'allocation-report', title: 'Resource Allocation Report', columns, rows: filters.filtered }}
      />

      <ApiState loading={loading} error={error} onRetry={reload}>
        <DataTable columns={columns} data={filters.filtered} onRowClick={setDetailRow} />
      </ApiState>

      {detailRow && (
        <div className="admin-modal-overlay" onClick={() => setDetailRow(null)}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title="Allocation Details" onClose={() => setDetailRow(null)} />
            <dl className="detail-list">
              <dt>ID</dt><dd>{detailRow.id}</dd>
              <dt>Resource</dt><dd>{detailRow.resource}</dd>
              <dt>Quantity</dt><dd>{detailRow.quantity}</dd>
              <dt>Program / Need</dt><dd>{detailRow.program || '—'}</dd>
              <dt>Barangay</dt><dd>{detailRow.beneficiary || '—'}</dd>
              <dt>Affected Families</dt><dd>{detailRow.affectedFamilies ?? '—'}</dd>
              <dt>Barangay Needs</dt>
              <dd>
                {(detailRow.beneficiaryNeeds || []).length
                  ? detailRow.beneficiaryNeeds.join(', ')
                  : '—'}
              </dd>
              <dt>Priority</dt><dd><StatusBadge status={detailRow.priority} /></dd>
              <dt>Status</dt><dd><StatusBadge status={detailRow.status} /></dd>
              <dt>Linked Distribution</dt>
              <dd>{detailRow.distributionId ? `Distribution #${detailRow.distributionId}` : 'Not planned yet'}</dd>
              <dt>Date</dt><dd>{detailRow.date || detailRow.allocationDate || '—'}</dd>
              <dt>Assistance Request</dt>
              <dd>
                {(() => {
                  const req = linkedRequest(detailRow)
                  if (!req) return detailRow.assistanceRequestId ? `#${detailRow.assistanceRequestId}` : '—'
                  return `${req.id || req.code} — ${req.type} (${req.status})`
                })()}
              </dd>
              <dt>Notes</dt><dd>{detailRow.notes || '—'}</dd>
            </dl>
            <div className="admin-modal__actions">
              <button type="button" className="btn btn--primary" onClick={() => openEdit(detailRow)}>Edit</button>
              {canPlan(detailRow) && (
                <button type="button" className="btn btn--outline" onClick={() => planDistribution(detailRow)}>
                  Plan Distribution
                </button>
              )}
              {detailRow.status !== 'Delivered' && detailRow.status !== 'Cancelled' && (
                <button type="button" className="btn btn--outline" onClick={() => openStatus(detailRow)}>Update Status</button>
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
            <ModalHeader title="Update Status" onClose={() => setStatusRow(null)} />
            <form onSubmit={handleUpdateStatus}>
              <p style={{ margin: '0 0 1rem', color: '#64748b', fontSize: '0.9rem' }}>
                {statusRow.id} — {statusRow.resource} × {statusRow.quantity}
              </p>
              <label>
                Status
                <select required value={statusValue} onChange={(e) => setStatusValue(e.target.value)}>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <div className="admin-modal__actions">
                <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving...' : 'Save Status'}</button>
                <button type="button" className="btn btn--ghost" onClick={() => setStatusRow(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
