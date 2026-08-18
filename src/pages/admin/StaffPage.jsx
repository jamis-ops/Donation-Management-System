import { useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { ListTodo, Mail, UserCog } from 'lucide-react'
import { createStaffAccount, getStaff, updateStaff, tasksApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { useFilters } from '../../hooks/useFilters'
import PageHeader from '../../components/admin/shared/PageHeader'
import DataTable from '../../components/admin/shared/DataTable'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import FilterBar from '../../components/admin/shared/FilterBar'
import ModalHeader from '../../components/admin/shared/ModalHeader'
import Req from '../../components/shared/Req'
import PolicyLinks from '../../components/shared/PolicyLinks'
import { useSeeMore } from '../../hooks/useSeeMore'
import { SeeMoreToggle } from '../../components/admin/shared/SeeMoreList'
import NameFields from '../../components/shared/NameFields'
import { emptyNameParts, formatFullName } from '../../utils/personName'
import { notify } from '../../utils/toast'
import { emailError, phoneError } from '../../utils/validation'
import PhoneInput from '../../components/shared/PhoneInput'
import { useCatalogOptions } from '../../hooks/useCatalogOptions'
import { CatalogFieldLabel } from '../../components/admin/shared/CatalogQuickAdd'
import { TASK_TYPES as FALLBACK_TASK_TYPES } from '../../constants/options'

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
  role: 'Staff',
  acceptedPolicies: false,
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
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(null)
  const [editForm, setEditForm] = useState(null)
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

  const openStaff = (row) => {
    if (row.role !== 'Staff') {
      notify.warning('Admin accounts are managed under Admin Management.')
      return
    }
    setSelected(row)
    setEditForm({
      lastName: row.lastName || '',
      firstName: row.firstName || '',
      middleInitial: row.middleInitial || '',
      email: row.email || '',
      phone: row.phone || '',
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
    setSaving(true)
    try {
      const res = await createStaffAccount({
        lastName: form.lastName,
        firstName: form.firstName,
        middleInitial: form.middleInitial,
        name: formatFullName(form),
        email: form.email,
        phone: form.phone,
        role: 'Staff',
        acceptedPolicies: form.acceptedPolicies,
      })
      if (!res?.ok && !res?.data) {
        throw new Error(res?.error || 'Failed to create staff account.')
      }
      if (res?.credentialsSent) {
        const msg = res.message || 'Staff account created and credentials emailed successfully.'
        setSuccessMsg(msg)
        notify.success(msg)
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
      setSuccessMsg('Staff profile updated.')
      notify.success('Staff profile updated.')
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

  const handleCreateTask = async (e) => {
    e.preventDefault()
    if (!selected) return
    setSaving(true)
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
    } catch (err) {
      notify.error(err.message)
    } finally {
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
          <button type="button" className="btn btn--sm btn--outline" onClick={() => openStaff(row)}>Manage</button>
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

      <FilterBar controller={filters} searchPlaceholder="Search by ID, name, or email..." />
      <ApiState loading={loading} error={error} onRetry={reload}>
        <DataTable
          columns={columns}
          data={filters.filtered}
          onRowClick={openStaff}
          pageSize={10}
          resetKey={`${filters.search}|${JSON.stringify(filters.values)}`}
        />
      </ApiState>

      {selected && editForm && (
        <div className="admin-modal-overlay" onClick={() => setSelected(null)}>
          <div className="admin-modal admin-modal--wide volunteer-manage-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title={selected.name}
              subtitle={`${selected.id} · Staff · ${selected.email || 'No email'}`}
              onClose={() => setSelected(null)}
            />

            <section className="volunteer-panel-section">
              <h3>Staff Profile</h3>
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
                  <dt>Role</dt><dd>Staff</dd>
                  <dt>Department</dt><dd>{selected.department}</dd>
                  <dt>Email</dt>
                  <dd><span className="volunteer-inline-meta"><Mail size={13} /> {selected.email || '—'}</span></dd>
                  <dt>Assigned Tasks</dt>
                  <dd><span className="volunteer-inline-meta"><ListTodo size={13} /> {tasks.length}</span></dd>
                </dl>
                <div className="admin-modal__actions">
                  <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Save Profile'}</button>
                </div>
              </form>
            </section>

            <section className="volunteer-panel-section">
              <div className="volunteer-panel-section__head">
                <h3>Assigned Tasks</h3>
                <button type="button" className="btn btn--sm btn--primary" onClick={() => setShowTaskForm(true)}>
                  + Assign Task
                </button>
              </div>
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

            <div className="admin-modal__actions">
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
                  <input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} />
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
                <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Assign Task'}</button>
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
                  Phone
                  <PhoneInput
                    value={form.phone}
                    onChange={(phone) => setForm({ ...form, phone })}
                  />
                </label>
              </div>
              <p className="field-hint">
                Creates a <strong>Staff</strong> account. Admin accounts are managed separately under Admin Management (Super Admin only).
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
