import { useState } from 'react'
import { donationsApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import PageHeader from '../../components/admin/shared/PageHeader'
import DataTable from '../../components/admin/shared/DataTable'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'

const lifecycle = [
  'Submission', 'Tracking Code', 'Verification', 'Inventory', 'Repacking',
  'Allocation', 'Distribution Planning', 'Distribution', 'Certificate / OR',
]

const emptyForm = {
  donorName: '', email: '', type: 'Monetary', amount: '', items: '', status: 'Pending Verification',
}

export default function DonationsPage() {
  const { data: donations, loading, error, reload } = useApiList(() => donationsApi.list())
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const filtered = filter === 'all' ? donations : donations.filter((d) => d.status === filter)
  const statuses = ['all', ...new Set(donations.map((d) => d.status))]

  const handleVerify = async (row) => {
    await donationsApi.update(row.dbId, { status: 'Verified' })
    reload()
    setSelected(null)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await donationsApi.create({
        donorName: form.donorName,
        email: form.email,
        type: form.type,
        amount: form.type === 'Monetary' ? Number(form.amount) : undefined,
        items: form.type === 'In-Kind' ? form.items : undefined,
        status: form.status,
      })
      setShowForm(false)
      setForm(emptyForm)
      reload()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    if (!confirm(`Delete donation ${row.trackingCode}?`)) return
    await donationsApi.remove(row.dbId)
    reload()
    setSelected(null)
  }

  const columns = [
    { key: 'trackingCode', label: 'Tracking Code' },
    { key: 'donor', label: 'Donor' },
    { key: 'type', label: 'Type' },
    { key: 'amount', label: 'Amount / Items' },
    { key: 'date', label: 'Date' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions">
          {row.status === 'Pending Verification' && (
            <button type="button" className="btn btn--sm btn--primary" onClick={(e) => { e.stopPropagation(); handleVerify(row) }}>
              Verify
            </button>
          )}
          <button type="button" className="btn btn--sm btn--outline" onClick={(e) => { e.stopPropagation(); setSelected(row) }}>
            View
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Donation Processing"
        description="Verify donations, monitor status, and manage the donation lifecycle."
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setShowForm(true)}>
            + Record Donation
          </button>
        }
      />

      <div className="admin-lifecycle">
        {lifecycle.map((step, i) => (
          <span key={step} className="admin-lifecycle__step">
            {step}
            {i < lifecycle.length - 1 && <span className="admin-lifecycle__arrow">›</span>}
          </span>
        ))}
      </div>

      <div className="admin-filters">
        {statuses.map((s) => (
          <button key={s} type="button" className={`admin-filter${filter === s ? ' admin-filter--active' : ''}`} onClick={() => setFilter(s)}>
            {s === 'all' ? 'All' : s}
          </button>
        ))}
      </div>

      <ApiState loading={loading} error={error} onRetry={reload}>
        <DataTable columns={columns} data={filtered} onRowClick={setSelected} />
      </ApiState>

      {showForm && (
        <div className="admin-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Record Donation</h2>
            <form onSubmit={handleSave}>
              <label>Donor Name<input required value={form.donorName} onChange={(e) => setForm({ ...form, donorName: e.target.value })} /></label>
              <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              <label>Type
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="Monetary">Monetary</option>
                  <option value="In-Kind">In-Kind</option>
                </select>
              </label>
              {form.type === 'Monetary' ? (
                <label>Amount (PHP)<input type="number" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
              ) : (
                <label>Items Description<input required value={form.items} onChange={(e) => setForm({ ...form, items: e.target.value })} /></label>
              )}
              <div className="admin-modal__actions">
                <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                <button type="button" className="btn btn--ghost" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selected && (
        <div className="admin-modal-overlay" onClick={() => setSelected(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Donation Details</h2>
            <dl className="detail-list">
              <dt>Tracking Code</dt><dd>{selected.trackingCode}</dd>
              <dt>Donor</dt><dd>{selected.donor}</dd>
              <dt>Type</dt><dd>{selected.type}</dd>
              <dt>Amount</dt><dd>{selected.amount}</dd>
              <dt>Status</dt><dd><StatusBadge status={selected.status} /></dd>
              <dt>Date</dt><dd>{selected.date}</dd>
            </dl>
            <div className="admin-modal__actions">
              {selected.status === 'Pending Verification' && (
                <button type="button" className="btn btn--primary" onClick={() => handleVerify(selected)}>Verify &amp; Approve</button>
              )}
              <button type="button" className="btn btn--outline" onClick={() => handleDelete(selected)}>Delete</button>
              <button type="button" className="btn btn--ghost" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
