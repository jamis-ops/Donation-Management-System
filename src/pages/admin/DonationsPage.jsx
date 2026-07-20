import { useState } from 'react'
import { donationsApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { DONATION_CATEGORIES } from '../../constants/options'
import { useFilters } from '../../hooks/useFilters'
import PageHeader from '../../components/admin/shared/PageHeader'
import DataTable from '../../components/admin/shared/DataTable'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import FilterBar from '../../components/admin/shared/FilterBar'

const lifecycle = [
  'Submission', 'Tracking Code', 'Verification', 'Inventory', 'Repacking',
  'Allocation', 'Distribution Planning', 'Distribution', 'Certificate / OR',
]

const emptyForm = {
  donorName: '', email: '', type: 'Monetary', category: '', amount: '', items: '', status: 'Pending Verification',
}

const filterConfig = {
  searchKeys: ['trackingCode', 'donor', 'email'],
  filters: [
    { key: 'status', label: 'Status' },
    { key: 'type', label: 'Type' },
    { key: 'category', label: 'Category' },
  ],
  dateKey: 'date',
}

export default function DonationsPage() {
  const { data: donations, loading, error, reload } = useApiList(() => donationsApi.list())
  const categoryOptions = DONATION_CATEGORIES
  const [selected, setSelected] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const filters = useFilters(donations, filterConfig)

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
        category: form.category,
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
    { key: 'category', label: 'Category', render: (row) => row.category || '—' },
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

      <FilterBar
        controller={filters}
        searchPlaceholder="Search by tracking code, donor, or email..."
        exportConfig={{ filename: 'donation-report', title: 'Donation Report', columns, rows: filters.filtered }}
      />

      <ApiState loading={loading} error={error} onRetry={reload}>
        <DataTable columns={columns} data={filters.filtered} onRowClick={setSelected} />
      </ApiState>

      {showForm && (
        <div className="admin-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Record Donation</h2>
            <form onSubmit={handleSave}>
              <label>Donor Name<input required value={form.donorName} onChange={(e) => setForm({ ...form, donorName: e.target.value })} /></label>
              <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              <div className="form-row">
                <label>Type
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    <option value="Monetary">Monetary</option>
                    <option value="In-Kind">In-Kind</option>
                  </select>
                </label>
                <label>Category
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    <option value="">Uncategorized</option>
                    {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              </div>
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
              <dt>Category</dt><dd>{selected.category || '—'}</dd>
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
