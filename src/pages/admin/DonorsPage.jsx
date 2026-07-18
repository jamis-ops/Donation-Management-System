import { useState } from 'react'
import { donorsApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import PageHeader from '../../components/admin/shared/PageHeader'
import DataTable from '../../components/admin/shared/DataTable'
import ApiState from '../../components/admin/shared/ApiState'

export default function DonorsPage() {
  const { data: donors, loading, error, reload } = useApiList(() => donorsApi.list())
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [saving, setSaving] = useState(false)

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await donorsApi.create(form)
      setShowForm(false)
      setForm({ name: '', email: '', phone: '' })
      reload()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    if (!confirm(`Delete donor ${row.name}?`)) return
    await donorsApi.remove(row.dbId)
    reload()
  }

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'totalDonated', label: 'Total Donated' },
    { key: 'donations', label: 'Donations' },
    { key: 'lastDonation', label: 'Last Donation' },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions">
          <button type="button" className="btn btn--sm btn--outline" onClick={() => handleDelete(row)}>Delete</button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Donor Management"
        description="Manage donor profiles, donation history, and communications."
        actions={<button type="button" className="btn btn--primary" onClick={() => setShowForm(true)}>+ Add Donor</button>}
      />
      <ApiState loading={loading} error={error} onRetry={reload}>
        <DataTable columns={columns} data={donors} />
      </ApiState>

      {showForm && (
        <div className="admin-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Donor</h2>
            <form onSubmit={handleSave}>
              <label>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              <label>Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
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
