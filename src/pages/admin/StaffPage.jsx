import { useState } from 'react'
import { Link } from 'react-router-dom'
import { createStaffAccount, getStaff } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { useFilters } from '../../hooks/useFilters'
import PageHeader from '../../components/admin/shared/PageHeader'
import DataTable from '../../components/admin/shared/DataTable'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import FilterBar from '../../components/admin/shared/FilterBar'
import ModalHeader from '../../components/admin/shared/ModalHeader'
import Req from '../../components/shared/Req'

const filterConfig = {
  searchKeys: ['id', 'name', 'email'],
  filters: [
    { key: 'role', label: 'Role' },
    { key: 'department', label: 'Department' },
    { key: 'status', label: 'Status' },
  ],
}

const emptyForm = { name: '', email: '', role: 'Staff', acceptedPolicies: false }

export default function StaffPage() {
  const { data, loading, error, reload } = useApiList(() => getStaff())
  const filters = useFilters(data, filterConfig)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await createStaffAccount(form)
      if (res?.credentialsSent) {
        alert('Staff account created. Login credentials were emailed via NodeMailer.')
      } else {
        alert([
          'Staff account was created, but the credential email was NOT delivered.',
          res?.mailError ? `Reason: ${res.mailError}` : '',
          res?.temporaryPassword ? `Temporary password (share securely): ${res.temporaryPassword}` : '',
          'Ensure `npm run mail` is running and mail-service/.env has a valid Gmail App Password.',
        ].filter(Boolean).join('\n\n'))
      }
      setShowForm(false)
      setForm(emptyForm)
      reload()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role' },
    { key: 'department', label: 'Department' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ]

  return (
    <>
      <PageHeader
        title="Staff Management"
        description="Manage Admin and Staff accounts. New accounts receive emailed login credentials."
        actions={<button type="button" className="btn btn--primary" onClick={() => setShowForm(true)}>+ Add Staff</button>}
      />
      <FilterBar controller={filters} searchPlaceholder="Search by ID, name, or email..." />
      <ApiState loading={loading} error={error} onRetry={reload}>
        <DataTable columns={columns} data={filters.filtered} />
      </ApiState>

      {showForm && (
        <div className="admin-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title="Create Staff Account" onClose={() => setShowForm(false)} />
            <form onSubmit={handleSave}>
              <label><Req required>Full Name</Req><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label><Req required>Email</Req><input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              <label><Req required>Role</Req>
                <select required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="Staff">Staff</option>
                  <option value="Admin">Admin</option>
                </select>
              </label>
              <label className="need-check">
                <input
                  type="checkbox"
                  required
                  checked={form.acceptedPolicies}
                  onChange={(e) => setForm({ ...form, acceptedPolicies: e.target.checked })}
                />
                <span>
                  User accepts the{' '}
                  <Link to="/privacy" target="_blank" rel="noreferrer">Data Privacy Policy</Link>
                  {' '}and{' '}
                  <Link to="/terms" target="_blank" rel="noreferrer">Terms &amp; Conditions</Link>
                  <span className="req"> *</span>
                </span>
              </label>
              <div className="admin-modal__actions">
                <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Creating...' : 'Create & Email Credentials'}</button>
                <button type="button" className="btn btn--ghost" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
