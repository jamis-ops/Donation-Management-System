import { useState } from 'react'
import { ListTodo, Mail, UserCog } from 'lucide-react'
import { createStaffAccount, getStaff, updateStaff, tasksApi } from '../../api/resources'
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
import { useSeeMore } from '../../hooks/useSeeMore'
import { SeeMoreToggle } from '../../components/admin/shared/SeeMoreList'
import NameFields from '../../components/shared/NameFields'
import { emptyNameParts, formatFullName } from '../../utils/personName'
import { notify } from '../../utils/toast'

const filterConfig = {
  searchKeys: ['id', 'name', 'email', 'firstName', 'lastName'],
  filters: [
    { key: 'role', label: 'Role' },
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

export default function StaffPage() {
  const { user } = useAuth()
  const isSuperAdmin = isSuperAdminRole(user?.role, user)
  const { data, loading, error, reload } = useApiList(() => getStaff())
  const filters = useFilters(data, filterConfig)
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
    if (row.role === 'Admin' && !isSuperAdmin) {
      notify.warning('Only the Super Admin can manage Admin accounts.')
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
    setSaving(true)
    try {
      const res = await createStaffAccount({
        lastName: form.lastName,
        firstName: form.firstName,
        middleInitial: form.middleInitial,
        name: formatFullName(form),
        email: form.email,
        phone: form.phone,
        role: form.role,
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
      await updateStaff(row.dbId, { status: next })
      notify.success(`${row.name} is now ${next}.`)
      reload()
      if (selected?.dbId === row.dbId) {
        setSelected({ ...row, status: next })
        setEditForm((f) => (f ? { ...f, status: next } : f))
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
    { key: 'role', label: 'Role' },
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
        title="Staff & Admin Accounts"
        description={
          isSuperAdmin
            ? 'Super Admin only: create and manage database Admin accounts, email their credentials, and manage Staff.'
            : 'Create Staff accounts and email temporary credentials. Only the Super Admin can create Admin accounts.'
        }
        actions={(
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setForm({ ...emptyForm, role: 'Staff' })
              setShowForm(true)
              setSuccessMsg('')
            }}
          >
            {isSuperAdmin ? '+ Add Account' : '+ Add Staff'}
          </button>
        )}
      />

      {successMsg ? (
        <div className="admin-banner admin-banner--success" role="status">{successMsg}</div>
      ) : null}

      <FilterBar controller={filters} searchPlaceholder="Search by ID, name, or email..." />
      <ApiState loading={loading} error={error} onRetry={reload}>
        <DataTable columns={columns} data={filters.filtered} onRowClick={openStaff} initialVisible={5} />
      </ApiState>

      {selected && editForm && (
        <div className="admin-modal-overlay" onClick={() => setSelected(null)}>
          <div className="admin-modal admin-modal--wide volunteer-manage-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title={selected.name}
              subtitle={`${selected.id} · ${selected.role} · ${selected.email || 'No email'}`}
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
                    <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
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
                  <dt>Role</dt><dd>{selected.role}</dd>
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
                {selected.role === 'Staff' && (
                  <button type="button" className="btn btn--sm btn--primary" onClick={() => setShowTaskForm(true)}>
                    + Assign Task
                  </button>
                )}
              </div>
              {selected.role !== 'Staff' ? (
                <p className="beneficiary-view-empty">Task assignment is available for Staff accounts.</p>
              ) : tasksLoading ? (
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
                Module
                <select value={taskForm.module} onChange={(e) => setTaskForm({ ...taskForm, module: e.target.value })}>
                  <option>Operations</option>
                  <option>Donations</option>
                  <option>Inventory</option>
                  <option>Distributions</option>
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
            <ModalHeader
              title={isSuperAdmin ? 'Create Account' : 'Create Staff Account'}
              onClose={() => setShowForm(false)}
            />
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
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+63 9xx xxx xxxx" />
                </label>
              </div>
              <label>
                <Req required>Role</Req>
                <select required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="Staff">Staff</option>
                  {isSuperAdmin ? <option value="Admin">Admin</option> : null}
                </select>
              </label>
              {!isSuperAdmin ? (
                <p className="field-hint">Admin accounts can only be created by the Super Admin.</p>
              ) : (
                <p className="field-hint">
                  Choose <strong>Admin</strong> to create a database Admin (separate from the hardcoded Super Admin). Credentials are emailed after creation.
                </p>
              )}
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
