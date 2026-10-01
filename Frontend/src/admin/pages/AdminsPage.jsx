import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Mail, Shield, Trash2 } from 'lucide-react'
import { createStaffAccount, deleteStaff, getStaff, updateStaff } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { useFilters } from '../../hooks/useFilters'
import { useAuth } from '../../context/AuthContext'
import { isSuperAdminRole } from '../../utils/roleRoutes'
import PageHeader from '../components/shared/PageHeader'
import DataTable from '../components/shared/DataTable'
import StatusBadge from '../components/shared/StatusBadge'
import ApiState from '../components/shared/ApiState'
import FilterBar from '../components/shared/FilterBar'
import ModalHeader from '../components/shared/ModalHeader'
import Req from '../../components/shared/Req'
import NameFields from '../../components/shared/NameFields'
import { emptyNameParts, formatFullName } from '../../utils/personName'
import { notify, confirmAction, showSuccessModal } from '../../utils/confirm'
import PhoneInput from '../../components/shared/PhoneInput'
import { phoneError, emailError } from '../../utils/validation'
import { useLoading } from '../../context/LoadingContext'

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
  birthDate: '',
  address: '',
  emergencyContactNumber: '',
  emergencyContactRelation: '',
  role: 'Admin',
  acceptedTerms: true,
  acceptedPrivacy: true,
  acceptedPolicies: true,
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
  const { showLoading, hideLoading } = useLoading()
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
      birthDate: row.birthDate || row.dateOfBirth || '',
      address: row.address || '',
      emergencyContactNumber: row.emergencyContactNumber || row.emergencyContactPhone || '',
      emergencyContactRelation: row.emergencyContactRelation || '',
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
    const phoneMsg = phoneError(form.phone, { required: false, allowInternational: true })
    if (phoneMsg) {
      notify.warning(phoneMsg)
      return
    }
    if (form.emergencyContactNumber) {
      const ecMsg = phoneError(form.emergencyContactNumber, { required: false, allowInternational: true })
      if (ecMsg) {
        notify.warning(`Emergency Contact: ${ecMsg}`)
        return
      }
    }
    const ok = await confirmAction({
      title: 'Create Admin Account',
      message: `Create a database Admin account for ${formatFullName(form)} (${form.email}) and email their temporary password?`,
      confirmText: 'Create & Email Credentials',
      type: 'primary',
    })
    if (!ok) return

    setSaving(true)
    showLoading('Saving…')
    try {
      const res = await createStaffAccount({
        lastName: form.lastName,
        firstName: form.firstName,
        middleInitial: form.middleInitial,
        name: formatFullName(form),
        email: form.email,
        phone: form.phone,
        birthDate: form.birthDate,
        address: form.address,
        emergencyContactNumber: form.emergencyContactNumber,
        emergencyContactRelation: form.emergencyContactRelation,
        role: 'Admin',
        acceptedTerms: true,
        acceptedPrivacy: true,
        acceptedPolicies: true,
      })
      if (!res?.ok && !res?.data) {
        throw new Error(res?.error || 'Failed to create admin account.')
      }
      if (res?.credentialsSent) {
        const msg = res.message || 'Admin account created and credentials emailed successfully.'
        setSuccessMsg(msg)
        notify.success(msg)
        showSuccessModal('Credentials successfully sent.')
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
        showSuccessModal('Successfully added.')
      }
      setShowForm(false)
      setForm(emptyForm)
      reload()
    } catch (err) {
      notify.error(err.message)
    } finally {
      hideLoading()
      setSaving(false)
    }
  }

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    if (!selected || !editForm) return
    const phoneMsg = phoneError(editForm.phone, { required: false, allowInternational: true })
    if (phoneMsg) {
      notify.warning(phoneMsg)
      return
    }
    if (editForm.emergencyContactNumber) {
      const ecMsg = phoneError(editForm.emergencyContactNumber, { required: false, allowInternational: true })
      if (ecMsg) {
        notify.warning(`Emergency Contact: ${ecMsg}`)
        return
      }
    }
    setSaving(true)
    showLoading('Saving…')
    try {
      await updateStaff(selected.dbId, {
        lastName: editForm.lastName,
        firstName: editForm.firstName,
        middleInitial: editForm.middleInitial,
        email: editForm.email,
        phone: editForm.phone,
        birthDate: editForm.birthDate,
        address: editForm.address,
        emergencyContactNumber: editForm.emergencyContactNumber,
        emergencyContactRelation: editForm.emergencyContactRelation,
        status: editForm.status,
      })
      setSuccessMsg('Admin profile updated.')
      notify.success('Admin profile updated.')
      showSuccessModal('Successfully updated.')
      reload()
      setSelected((prev) => (prev ? {
        ...prev,
        ...editForm,
        name: formatFullName(editForm),
      } : null))
    } catch (err) {
      notify.error(err.message)
    } finally {
      hideLoading()
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    const ok = await confirmAction({
      title: 'Delete Admin Account',
      message: `Are you sure you want to permanently delete admin account "${row.name}" (${row.email})? This action removes the account from the database and cannot be undone.`,
      confirmText: 'Delete Admin',
      type: 'danger',
    })
    if (!ok) return

    showLoading('Deleting admin…')
    try {
      await deleteStaff(row.dbId)
      showSuccessModal('Successfully deleted.')
      if (selected?.dbId === row.dbId) {
        setSelected(null)
      }
      reload()
    } catch (err) {
      notify.error(err.message || 'Failed to delete admin account')
    } finally {
      hideLoading()
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
          <button type="button" className="btn btn--sm btn--danger" onClick={() => handleDelete(row)}>
            Delete
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

      <FilterBar
        controller={filters}
        searchPlaceholder="Search by ID, name, or email..."
        exportConfig={{
          filename: 'admin-accounts-report',
          title: 'Admin Accounts Report',
          columns,
          rows: filters.filtered,
        }}
      />
      <ApiState loading={loading} error={error} message="Loading administrators…" onRetry={reload}>
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
                    Phone Number
                    <PhoneInput
                      allowInternational
                      value={editForm.phone}
                      onChange={(phone) => setEditForm({ ...editForm, phone })}
                    />
                  </label>
                </div>
                <div className="form-row">
                  <label>
                    Date of Birth
                    <input
                      type="date"
                      value={editForm.birthDate}
                      onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })}
                    />
                  </label>
                  <label>
                    Address
                    <input
                      type="text"
                      placeholder="e.g., Cebu City, Philippines"
                      value={editForm.address}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    />
                  </label>
                </div>
                <div className="form-row">
                  <label>
                    Emergency Contact Number
                    <PhoneInput
                      allowInternational
                      value={editForm.emergencyContactNumber}
                      onChange={(num) => setEditForm({ ...editForm, emergencyContactNumber: num })}
                    />
                  </label>
                  <label>
                    Emergency Contact Relation
                    <input
                      type="text"
                      placeholder="e.g., Parent, Spouse, Sibling"
                      value={editForm.emergencyContactRelation}
                      onChange={(e) => setEditForm({ ...editForm, emergencyContactRelation: e.target.value })}
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
                  <dt>Phone Number</dt><dd>{selected.phone || '—'}</dd>
                  <dt>Date of Birth</dt><dd>{selected.birthDate || selected.dateOfBirth || '—'}</dd>
                  <dt>Address</dt><dd>{selected.address || '—'}</dd>
                  <dt>Emergency Contact</dt>
                  <dd>{selected.emergencyContactNumber ? `${selected.emergencyContactNumber} ${selected.emergencyContactRelation ? `(${selected.emergencyContactRelation})` : ''}` : '—'}</dd>
                </dl>
                <p className="volunteer-panel-hint">
                  <Shield size={14} /> Database Admin accounts access the Admin portal. This is separate from the hardcoded Super Admin.
                </p>
                <div className="admin-modal__actions admin-modal__actions--split" style={{ marginTop: '1.25rem' }}>
                  <button type="button" className="btn btn--ghost" onClick={() => setSelected(null)}>Close</button>
                  <div className="admin-modal__actions-group">
                    <button
                      type="button"
                      className="btn btn--danger"
                      onClick={() => handleDelete(selected)}
                    >
                      <Trash2 size={14} /> Delete Account
                    </button>
                    <button type="submit" className="btn btn--primary" disabled={saving}>Save Profile</button>
                  </div>
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
                  Phone Number
                  <PhoneInput
                    allowInternational
                    value={form.phone}
                    onChange={(phone) => setForm({ ...form, phone })}
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Date of Birth
                  <input
                    type="date"
                    value={form.birthDate}
                    onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                  />
                </label>
                <label>
                  Address
                  <input
                    type="text"
                    placeholder="e.g., Cebu City, Philippines"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Emergency Contact Number
                  <PhoneInput
                    allowInternational
                    value={form.emergencyContactNumber}
                    onChange={(num) => setForm({ ...form, emergencyContactNumber: num })}
                  />
                </label>
                <label>
                  Emergency Contact Relation
                  <input
                    type="text"
                    placeholder="e.g., Parent, Spouse, Sibling"
                    value={form.emergencyContactRelation}
                    onChange={(e) => setForm({ ...form, emergencyContactRelation: e.target.value })}
                  />
                </label>
              </div>
              <p className="field-hint">
                Creates a database <strong>Admin</strong> account (separate from Super Admin and Staff). Credentials are emailed after creation.
              </p>

              <div className="admin-modal__actions" style={{ marginTop: '1.25rem' }}>
                <button type="button" className="btn btn--danger" onClick={() => setShowForm(false)}>Cancel</button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={saving}
                >
                  Create & Email Credentials
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
