import { useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { ListTodo, Mail, UserCog, Trash2, Pencil } from 'lucide-react'
import { createStaffAccount, getStaff, updateStaff, deleteStaff, tasksApi } from '../../api/resources'
import { getTodayDateString, isPastDateString } from '../../utils/date'
import { useApiList } from '../../hooks/useApiList'
import { useFilters } from '../../hooks/useFilters'
import PageHeader from '../../components/admin/shared/PageHeader'
import DataTable from '../../components/admin/shared/DataTable'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import FilterBar from '../../components/admin/shared/FilterBar'
import ModalHeader from '../../components/admin/shared/ModalHeader'
import Req from '../../components/shared/Req'
import { useSeeMore } from '../../hooks/useSeeMore'
import { SeeMoreToggle } from '../../components/admin/shared/SeeMoreList'
import NameFields from '../../components/shared/NameFields'
import { emptyNameParts, formatFullName } from '../../utils/personName'
import { notify } from '../../utils/toast'
import { confirmAction, showSuccessModal } from '../../utils/confirm'
import { emailError, phoneError } from '../../utils/validation'
import PhoneInput from '../../components/shared/PhoneInput'
import { useCatalogOptions } from '../../hooks/useCatalogOptions'
import { CatalogFieldLabel } from '../../components/admin/shared/CatalogQuickAdd'
import { TASK_TYPES as FALLBACK_TASK_TYPES } from '../../constants/options'
import { useLoading } from '../../context/LoadingContext'

const filterConfig = {
  searchKeys: ['id', 'name', 'email', 'firstName', 'lastName'],
  filters: [
    { key: 'department', label: 'Department' },
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
  role: 'Staff',
  acceptedTerms: true,
  acceptedPrivacy: true,
  acceptedPolicies: true,
}

const emptyTaskForm = {
  title: '',
  priority: 'Medium',
  dueDate: '',
  module: 'Operations',
}

const FALLBACK_MODULES = ['Operations', 'Donations', 'Inventory', 'Distributions', ...FALLBACK_TASK_TYPES]

/**
 * Admin portal — Staff account management & task assignment only.
 * Admin accounts are managed separately by Super Admin at /admin/admins.
 */
export default function StaffPage() {
  const [searchParams] = useSearchParams()
  const { data, loading, error, reload } = useApiList(() => getStaff())
  const staffData = useMemo(
    () => (Array.isArray(data) ? data.filter((row) => row.role === 'Staff') : []),
    [data],
  )
  const filters = useFilters(staffData, filterConfig)
  const { options: taskTypeOptions, applyList: applyTaskTypes } = useCatalogOptions('task_types', FALLBACK_MODULES)
  const [showForm, setShowForm] = useState(false)
  const { showLoading, hideLoading } = useLoading()
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [tasks, setTasks] = useState([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const tasksSeeMore = useSeeMore(tasks, 3)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [taskForm, setTaskForm] = useState(emptyTaskForm)
  const [successMsg, setSuccessMsg] = useState('')

  // Legacy deep-link from when Admin accounts lived under Staff
  if (searchParams.get('role') === 'Admin') {
    return <Navigate to="/admin/admins" replace />
  }

  const loadTasks = async (staff) => {
    if (!staff) {
      setTasks([])
      return
    }
    setTasksLoading(true)
    try {
      const res = await tasksApi.list(`?assigneeUserId=${staff.dbId}&mine=0`)
      setTasks(Array.isArray(res.data) ? res.data : (res.list || []))
    } catch {
      setTasks([])
    } finally {
      setTasksLoading(false)
    }
  }

  const openStaff = (row, startInEditMode = false) => {
    if (row.role !== 'Staff') {
      notify.warning('Admin accounts are managed under Admin Management.')
      return
    }
    setSelected(row)
    setIsEditing(startInEditMode)
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
    loadTasks(row)
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
    if (form.emergencyContactNumber) {
      const ecMsg = phoneError(form.emergencyContactNumber, { required: false })
      if (ecMsg) {
        notify.warning(`Emergency Contact: ${ecMsg}`)
        return
      }
    }
    const ok = await confirmAction({
      title: 'Create Staff Account',
      message: `Create a staff portal account for ${formatFullName(form)} (${form.email}) and email their temporary password?`,
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
        role: 'Staff',
        acceptedTerms: true,
        acceptedPrivacy: true,
        acceptedPolicies: true,
      })
      if (!res?.ok && !res?.data) {
        throw new Error(res?.error || 'Failed to create staff account.')
      }
      if (res?.credentialsSent) {
        const msg = res.message || 'Staff account created and credentials emailed successfully.'
        setSuccessMsg(msg)
        notify.success(msg)
        showSuccessModal('Credentials successfully sent.')
      } else {
        const temp = res?.temporaryPassword
          ? `\n\nTemporary password (share securely): ${res.temporaryPassword}`
          : ''
        const mailHint = res?.mailError ? `\nMail note: ${res.mailError}` : ''
        setSuccessMsg(
          (res?.message || 'Staff account created.')
          + temp
          + mailHint
          + '\n\nTip: run `npm run mail` with a valid Gmail App Password to email credentials automatically.',
        )
        notify.warning(
          [
            res?.message || 'Staff account was created.',
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
    if (!editForm.lastName.trim() || !editForm.firstName.trim()) {
      notify.warning('Last Name and First Name are required.')
      return
    }
    const emailMsg = emailError(editForm.email)
    if (emailMsg) {
      notify.warning(emailMsg)
      return
    }
    const phoneMsg = phoneError(editForm.phone, { required: false })
    if (phoneMsg) {
      notify.warning(phoneMsg)
      return
    }
    if (editForm.emergencyContactNumber) {
      const ecMsg = phoneError(editForm.emergencyContactNumber, { required: false })
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
      notify.success('Staff profile updated.')
      showSuccessModal('Successfully updated.')
      reload()
      setSelected((prev) => (prev ? {
        ...prev,
        ...editForm,
        name: formatFullName(editForm),
      } : null))
      setIsEditing(false)
    } catch (err) {
      notify.error(err.message)
    } finally {
      hideLoading()
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    const ok = await confirmAction({
      title: 'Delete Staff Account',
      message: `Are you sure you want to permanently delete staff account "${row.name}" (${row.email})? This action removes the account from the system and database and cannot be undone.`,
      confirmText: 'Delete Staff',
      type: 'danger',
    })
    if (!ok) return

    showLoading('Deleting staff…')
    try {
      await deleteStaff(row.dbId)
      notify.success(`Staff account "${row.name}" deleted.`)
      showSuccessModal('Successfully deleted.')
      if (selected?.dbId === row.dbId) {
        setSelected(null)
      }
      reload()
    } catch (err) {
      notify.error(err.message || 'Failed to delete staff account')
    } finally {
      hideLoading()
    }
  }

  const handleCreateTask = async (e) => {
    e.preventDefault()
    if (!selected) return
    if (['Inactive', 'Suspended', 'Terminated'].includes(selected.status)) {
      notify.error(`Cannot assign task: ${selected.name}'s account is ${selected.status}.`)
      return
    }
    if (taskForm.dueDate && isPastDateString(taskForm.dueDate)) {
      notify.error('Due date cannot be in the past. Please select today or a future date.')
      return
    }
    setSaving(true)
    showLoading('Saving…')
    try {
      await tasksApi.create({
        title: taskForm.title,
        priority: taskForm.priority,
        dueDate: taskForm.dueDate || null,
        module: taskForm.module || 'Operations',
        assigneeUserId: selected.dbId,
        assignee: selected.name,
        boardColumn: 'todo',
      })
      setShowTaskForm(false)
      setTaskForm(emptyTaskForm)
      loadTasks(selected)
      notify.success('Task assigned successfully.')
      showSuccessModal('Successfully added.')
    } catch (err) {
      notify.error(err.message)
    } finally {
      hideLoading()
      setSaving(false)
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
          <button type="button" className="btn btn--sm btn--outline" onClick={() => openStaff(row, false)}>Manage</button>
          <button type="button" className="btn btn--sm btn--outline" onClick={() => openStaff(row, true)}>
            <Pencil size={13} /> Edit
          </button>
          <button type="button" className="btn btn--sm btn--danger" onClick={() => handleDelete(row)}>
            <Trash2 size={14} /> Delete
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Staff Accounts"
        description="Create Staff accounts, email temporary credentials, and assign operational tasks."
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
            + Add Staff
          </button>
        )}
      />

      {successMsg ? (
        <div className="admin-banner admin-banner--success" role="status">{successMsg}</div>
      ) : null}

      <div className="admin-stats-grid admin-stats-grid--compact" style={{ marginBottom: '1.25rem' }}>
        <div
          className={`admin-stat-card admin-stat-card--clickable ${filters.values.status === 'all' ? 'admin-stat-card--active' : ''}`}
          onClick={() => filters.setValue('status', 'all')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); filters.setValue('status', 'all') } }}
          title="View all staff members"
        >
          <div className="admin-stat-card__header">
            <span className="admin-stat-card__label">Total Staff</span>
            <UserCog className="admin-stat-card__icon" size={15} />
          </div>
          <div className="admin-stat-card__body">
            <span className="admin-stat-card__value">{staffData.length}</span>
          </div>
        </div>
        <div
          className={`admin-stat-card admin-stat-card--clickable ${filters.values.status === 'Active' ? 'admin-stat-card--active' : ''}`}
          onClick={() => filters.setValue('status', filters.values.status === 'Active' ? 'all' : 'Active')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); filters.setValue('status', filters.values.status === 'Active' ? 'all' : 'Active') } }}
          title="Filter by Active staff"
        >
          <div className="admin-stat-card__header">
            <span className="admin-stat-card__label">Active Staff</span>
            <UserCog className="admin-stat-card__icon" size={15} style={{ color: '#16a34a' }} />
          </div>
          <div className="admin-stat-card__body">
            <span className="admin-stat-card__value">{staffData.filter((s) => s.status === 'Active').length}</span>
          </div>
        </div>
        <div
          className={`admin-stat-card admin-stat-card--clickable ${filters.values.status === 'Inactive' ? 'admin-stat-card--active' : ''}`}
          onClick={() => filters.setValue('status', filters.values.status === 'Inactive' ? 'all' : 'Inactive')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); filters.setValue('status', filters.values.status === 'Inactive' ? 'all' : 'Inactive') } }}
          title="Filter by Inactive staff"
        >
          <div className="admin-stat-card__header">
            <span className="admin-stat-card__label">Inactive Staff</span>
            <UserCog className="admin-stat-card__icon" size={15} style={{ color: '#dc2626' }} />
          </div>
          <div className="admin-stat-card__body">
            <span className="admin-stat-card__value">{staffData.filter((s) => s.status !== 'Active').length}</span>
          </div>
        </div>
      </div>

      <FilterBar controller={filters} searchPlaceholder="Search by ID, name, or email..." />
      <ApiState loading={loading} error={error} onRetry={reload}>
        <DataTable
          columns={columns}
          data={filters.filtered}
          onRowClick={(row) => openStaff(row, false)}
          pageSize={10}
          resetKey={`${filters.search}|${JSON.stringify(filters.values)}`}
        />
      </ApiState>

      {selected && (
        <div className="admin-modal-overlay" onClick={() => setSelected(null)}>
          <div className="admin-modal admin-modal--wide volunteer-manage-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title={selected.name}
              subtitle={`${selected.id} · Staff · ${selected.email || 'No email'}`}
              onClose={() => setSelected(null)}
            />

            <section className="volunteer-panel-section">
              <div className="volunteer-panel-section__head" style={{ marginBottom: '0.75rem' }}>
                <h3 style={{ margin: 0 }}>Staff Profile</h3>
                {!isEditing && (
                  <button
                    type="button"
                    className="btn btn--sm btn--outline"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil size={13} /> Edit Profile
                  </button>
                )}
              </div>

              {isEditing && editForm ? (
                <form onSubmit={handleUpdateProfile}>
                  <NameFields
                    value={editForm}
                    onChange={(parts) => setEditForm({ ...editForm, ...parts })}
                  />
                  <div className="form-row">
                    <label>
                      <Req required>Email</Req>
                      <input
                        type="email"
                        required
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      />
                    </label>
                    <label>
                      Phone Number
                      <PhoneInput
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
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </label>

                  <div className="admin-modal__actions" style={{ marginTop: '1rem', justifyContent: 'flex-start', gap: '0.5rem' }}>
                    <button type="submit" className="btn btn--primary" disabled={saving}>
                      Save Changes
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => {
                        setIsEditing(false)
                        setEditForm({
                          lastName: selected.lastName || '',
                          firstName: selected.firstName || '',
                          middleInitial: selected.middleInitial || '',
                          email: selected.email || '',
                          phone: selected.phone || '',
                          birthDate: selected.birthDate || selected.dateOfBirth || '',
                          address: selected.address || '',
                          emergencyContactNumber: selected.emergencyContactNumber || selected.emergencyContactPhone || '',
                          emergencyContactRelation: selected.emergencyContactRelation || '',
                          status: selected.status === 'Inactive' ? 'Inactive' : 'Active',
                        })
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <dl className="detail-list">
                  <dt>Full Name</dt>
                  <dd>{selected.name || formatFullName(selected) || '—'}</dd>
                  <dt>Status</dt>
                  <dd><StatusBadge status={selected.status} /></dd>
                  <dt>Role</dt>
                  <dd>Staff</dd>
                  <dt>Department</dt>
                  <dd>{selected.department || 'Operations'}</dd>
                  <dt>Email</dt>
                  <dd><span className="volunteer-inline-meta"><Mail size={13} /> {selected.email || '—'}</span></dd>
                  <dt>Phone Number</dt>
                  <dd>{selected.phone || '—'}</dd>
                  <dt>Date of Birth</dt>
                  <dd>{selected.birthDate || selected.dateOfBirth || '—'}</dd>
                  <dt>Address</dt>
                  <dd>{selected.address || '—'}</dd>
                  <dt>Emergency Contact</dt>
                  <dd>{selected.emergencyContactNumber ? `${selected.emergencyContactNumber} ${selected.emergencyContactRelation ? `(${selected.emergencyContactRelation})` : ''}` : '—'}</dd>
                  <dt>Assigned Tasks</dt>
                  <dd><span className="volunteer-inline-meta"><ListTodo size={13} /> {tasks.length}</span></dd>
                </dl>
              )}
            </section>

            <section className="volunteer-panel-section">
              <div className="volunteer-panel-section__head">
                <h3>Assigned Tasks</h3>
                <button
                  type="button"
                  className="btn btn--sm btn--primary"
                  onClick={() => setShowTaskForm(true)}
                  disabled={['Inactive', 'Suspended', 'Terminated'].includes(selected.status)}
                  title={['Inactive', 'Suspended', 'Terminated'].includes(selected.status) ? 'Cannot assign tasks to an inactive staff member' : ''}
                >
                  + Assign Task
                </button>
              </div>
              {['Inactive', 'Suspended', 'Terminated'].includes(selected.status) && (
                <div className="action-locked-banner action-locked-banner--accent" style={{ margin: '0.5rem 0 0.85rem' }}>
                  <UserCog size={14} />
                  <span>This staff account is <strong>{selected.status}</strong>. Task assignment is locked.</span>
                </div>
              )}
              {tasksLoading ? (
                <p className="beneficiary-view-empty">Loading tasks…</p>
              ) : tasks.length === 0 ? (
                <p className="beneficiary-view-empty">No tasks assigned yet.</p>
              ) : (
                <div className="see-more-wrap">
                  <div className="volunteer-task-list">
                    {tasksSeeMore.visible.map((t) => (
                      <article key={t.dbId || t.id} className="volunteer-task-card">
                        <div className="volunteer-task-card__top">
                          <strong>{t.title}</strong>
                          <StatusBadge status={t.status || t.boardColumn} />
                        </div>
                        <div className="volunteer-task-card__meta">
                          <span>Priority: {t.priority}</span>
                          <span>Due: {t.due || '—'}</span>
                          {t.completedAtLabel ? <span>Completed: {t.completedAtLabel}</span> : null}
                        </div>
                      </article>
                    ))}
                  </div>
                  {tasksSeeMore.needsToggle && (
                    <SeeMoreToggle
                      expanded={tasksSeeMore.expanded}
                      onToggle={tasksSeeMore.toggle}
                      hiddenCount={tasksSeeMore.hiddenCount}
                    />
                  )}
                </div>
              )}
              <p className="volunteer-panel-hint">
                <UserCog size={14} /> Staff mark tasks Done from Staff Portal → My Tasks. First login requires a password change.
              </p>
            </section>

            <div className="admin-modal__actions" style={{ justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => handleDelete(selected)}
              >
                <Trash2 size={14} /> Delete Staff Account
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showTaskForm && selected && (
        <div className="admin-modal-overlay" onClick={() => setShowTaskForm(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title={`Assign Task — ${selected.name}`} onClose={() => setShowTaskForm(false)} />
            <form onSubmit={handleCreateTask}>
              <label>
                <Req required>Task Title</Req>
                <input required value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} />
              </label>
              <div className="form-row">
                <label>
                  Priority
                  <select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}>
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </label>
                <label>
                  Due Date
                  <input
                    type="date"
                    min={getTodayDateString()}
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                  />
                </label>
              </div>
              <label>
                <CatalogFieldLabel catalog="task_types" onUpdated={applyTaskTypes}>
                  Task Type / Module
                </CatalogFieldLabel>
                <select value={taskForm.module} onChange={(e) => setTaskForm({ ...taskForm, module: e.target.value })}>
                  {taskTypeOptions.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  {taskForm.module && !taskTypeOptions.includes(taskForm.module) && (
                    <option value={taskForm.module}>{taskForm.module}</option>
                  )}
                </select>
              </label>
              <div className="admin-modal__actions">
                <button type="submit" className="btn btn--primary" disabled={saving}>Assign Task</button>
                <button type="button" className="btn btn--ghost" onClick={() => setShowTaskForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showForm && (
        <div className="admin-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title="Create Staff Account" onClose={() => setShowForm(false)} />
            <form onSubmit={handleSave}>
              <NameFields
                value={form}
                onChange={(parts) => setForm({ ...form, ...parts })}
              />
              <div className="form-row">
                <label>
                  <Req required>Email</Req>
                  <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="staff@email.com" />
                </label>
                <label>
                  Phone Number
                  <PhoneInput
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

              <div className="admin-modal__actions" style={{ marginTop: '1.25rem' }}>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={saving}
                >
                  Create & Email Credentials
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
