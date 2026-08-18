import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Mail, Shield } from 'lucide-react'
import { createStaffAccount, getStaff, updateStaff } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { useFilters } from '../../hooks/useFilters'
import { useAuth } from '../../context/AuthContext'
import { isSuperAdminRole } from '../../utils/roleRoutes'
import PageHeader from '../../components/admin/shared/PageHeader'
import DataTable from '../../components/admin/shared/DataTable'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import FilterBar from '../../components/admin/shared/FilterBar'
import ModalHeader from '../../components/admin/shared/ModalHeader'
import Req from '../../components/shared/Req'
import PolicyLinks from '../../components/shared/PolicyLinks'
import NameFields from '../../components/shared/NameFields'
import { emptyNameParts, formatFullName } from '../../utils/personName'
import { notify } from '../../utils/toast'
import PhoneInput from '../../components/shared/PhoneInput'
import { phoneError, emailError } from '../../utils/validation'

const filterConfig = {
  searchKeys: ['id', 'name', 'email', 'firstName', 'lastName'],
  filters: [
    { key: 'status', label: 'Status' },
  ],
}

const emptyForm = {
  ...emptyNameParts(),
  email: '',
  phone: '',
  role: 'Admin',
  acceptedPolicies: false,
}

/**
 * Super Admin only — manage database Admin accounts (separate from Staff).
 */
export default function AdminsPage() {
  const { user } = useAuth()
  const isSuperAdmin = isSuperAdminRole(user?.role, user)
  const { data, loading, error, reload } = useApiList(() => getStaff())
  const adminData = useMemo(
    () => (Array.isArray(data) ? data.filter((row) => row.role === 'Admin') : []),
    [data],
  )
  const filters = useFilters(adminData, filterConfig)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [successMsg, setSuccessMsg] = useState('')

  if (!isSuperAdmin) {
    return <Navigate to="/admin/staff" replace />
  }

  const openAdmin = (row) => {
    setSelected(row)
    setEditForm({
      lastName: row.lastName || '',
      firstName: row.firstName || '',
      middleInitial: row.middleInitial || '',
      email: row.email || '',
      phone: row.phone || '',
      status: row.status === 'Inactive' ? 'Inactive' : 'Active',
    })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSuccessMsg('')
    if (!form.lastName.trim() || !form.firstName.trim()) {
      notify.warning('Last Name and First Name are required.')
      return
    }
    const emailMsg = emailError(form.email)
    if (emailMsg) {
      notify.warning(emailMsg)
      return
    }
    const phoneMsg = phoneError(form.phone, { required: false })
    if (phoneMsg) {
      notify.warning(phoneMsg)
      return
    }
    setSaving(true)
    try {
      const res = await createStaffAccount({
        lastName: form.lastName,
        firstName: form.firstName,
        middleInitial: form.middleInitial,
        name: formatFullName(form),
        email: form.email,
        phone: form.phone,
        role: 'Admin',
        acceptedPolicies: form.acceptedPolicies,
      })
      if (!res?.ok && !res?.data) {
        throw new Error(res?.error || 'Failed to create admin account.')
      }
      if (res?.credentialsSent) {
        const msg = res.message || 'Admin account created and credentials emailed successfully.'
        setSuccessMsg(msg)
        notify.success(msg)
      } else {
        const temp = res?.temporaryPassword
          ? `\n\nTemporary password (share securely): ${res.temporaryPassword}`
          : ''
        const mailHint = res?.mailError ? `\nMail note: ${res.mailError}` : ''
        setSuccessMsg(
          (res?.message || 'Admin account created.')
          + temp
          + mailHint
          + '\n\nTip: run `npm run mail` with a valid Gmail App Password to email credentials automatically.',
        )
        notify.warning(
          [
            res?.message || 'Admin account was created.',
            res?.temporaryPassword ? `Temporary password: ${res.temporaryPassword}` : '',
            res?.mailError ? `Email issue: ${res.mailError}` : 'Credential email was not delivered.',
            'Share the temporary password securely, or fix mail settings and recreate/resend later.',
          ].filter(Boolean).join('. '),
        )
      }
      setShowForm(false)
      setForm(emptyForm)
      reload()
    } catch (err) {
      notify.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    if (!selected || !editForm) return
    const phoneMsg = phoneError(editForm.phone, { required: false })
    if (phoneMsg) {
      notify.warning(phoneMsg)
      return
    }
    setSaving(true)
    try {
      await updateStaff(selected.dbId, {
        lastName: editForm.lastName,
        firstName: editForm.firstName,
        middleInitial: editForm.middleInitial,
        email: editForm.email,
        phone: editForm.phone,
        status: editForm.status,
      })
      setSuccessMsg('Admin profile updated.')
      notify.success('Admin profile updated.')
      reload()
      setSelected(null)
    } catch (err) {
      notify.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (row) => {
    const next = row.status === 'Active' ? 'Inactive' : 'Active'
    if (!window.confirm(`Set ${row.name} to ${next}?`)) return
    try {
      const res = await updateStaff(row.dbId, { status: next })
      const status = res?.data?.status || next
      notify.success(`Status successfully updated to: ${status}.`)
      reload()
      if (selected?.dbId === row.dbId) {
        setSelected({ ...row, status })
        setEditForm((f) => (f ? { ...f, status } : f))
      }
    } catch (err) {
      notify.error(err.message)
    }
  }

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'department', label: 'Department' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="btn btn--sm btn--outline" onClick={() => openAdmin(row)}>Manage</button>
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => toggleStatus(row)}>
            {row.status === 'Active' ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Admin Management"
        description="Super Admin only: create and manage database Admin accounts, then email their login credentials. Separate from Staff management."
        actions={(
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setForm(emptyForm)
              setShowForm(true)
              setSuccessMsg('')
            }}
          >
            + Add Admin
          </button>
        )}
      />

      {successMsg ? (
        <div className="admin-banner admin-banner--success" role="status">{successMsg}</div>
      ) : null}

      <FilterBar controller={filters} searchPlaceholder="Search by ID, name, or email..." />
      <ApiState loading={loading} error={error} onRetry={reload}>
        <DataTable
          columns={columns}
          data={filters.filtered}
          onRowClick={openAdmin}
          pageSize={10}
          resetKey={`${filters.search}|${JSON.stringify(filters.values)}`}
        />
      </ApiState>

      {selected && editForm && (
        <div className="admin-modal-overlay" onClick={() => setSelected(null)}>
          <div className="admin-modal admin-modal--wide volunteer-manage-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title={selected.name}
              subtitle={`${selected.id} · Admin · ${selected.email || 'No email'}`}
              onClose={() => setSelected(null)}
            />

            <section className="volunteer-panel-section">
              <h3>Admin Profile</h3>
              <form onSubmit={handleUpdateProfile}>
                <NameFields
                  value={editForm}
                  onChange={(parts) => setEditForm({ ...editForm, ...parts })}
                />
                <div className="form-row">
                  <label>
                    <Req required>Email</Req>
                    <input type="email" required value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                  </label>
                  <label>
                    Phone
                    <PhoneInput
                      value={editForm.phone}
                      onChange={(phone) => setEditForm({ ...editForm, phone })}
                    />
                  </label>
                </div>
                <label>
                  Account Status
                  <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </label>
                <dl className="detail-list" style={{ marginTop: '0.75rem' }}>
                  <dt>Role</dt><dd>Admin</dd>
                  <dt>Department</dt><dd>{selected.department || 'Management'}</dd>
                  <dt>Email</dt>
                  <dd><span className="volunteer-inline-meta"><Mail size={13} /> {selected.email || '—'}</span></dd>
                </dl>
                <p className="volunteer-panel-hint">
                  <Shield size={14} /> Database Admin accounts access the Admin portal. This is separate from the hardcoded Super Admin.
                </p>
                <div className="admin-modal__actions">
                  <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Save Profile'}</button>
                  <button type="button" className="btn btn--ghost" onClick={() => setSelected(null)}>Close</button>
                </div>
              </form>
            </section>
          </div>
        </div>
      )}

      {showForm && (
        <div className="admin-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title="Create Admin Account" onClose={() => setShowForm(false)} />
            <form onSubmit={handleSave}>
              <NameFields
                value={form}
                onChange={(parts) => setForm({ ...form, ...parts })}
              />
              <div className="form-row">
                <label>
                  <Req required>Email</Req>
                  <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="admin@email.com" />
                </label>
                <label>
                  Phone
                  <PhoneInput
                    value={form.phone}
                    onChange={(phone) => setForm({ ...form, phone })}
                  />
                </label>
              </div>
              <p className="field-hint">
                Creates a database <strong>Admin</strong> account (separate from Super Admin and Staff). Credentials are emailed after creation.
              </p>
              <label className="need-check">
                <input
                  type="checkbox"
                  required
                  checked={form.acceptedPolicies}
                  onChange={(e) => setForm({ ...form, acceptedPolicies: e.target.checked })}
                />
                <span>
                  User accepts the{' '}
                  <PolicyLinks />
                  <Req required />
                </span>
              </label>
              <p className="field-hint">
                Temporary login credentials are emailed when the mail service is running. If email delivery fails, the account is still created and the temporary password is shown so you can share it securely.
              </p>
              <div className="admin-modal__actions">
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'Creating & emailing…' : 'Create & Email Credentials'}
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
