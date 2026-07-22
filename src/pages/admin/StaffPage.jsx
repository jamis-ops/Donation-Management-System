import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ListTodo, Mail, UserCog } from 'lucide-react'
import { createStaffAccount, getStaff, tasksApi } from '../../api/resources'
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
const emptyTaskForm = {
  title: '',
  priority: 'Medium',
  dueDate: '',
  module: 'Operations',
}

export default function StaffPage() {
  const { data, loading, error, reload } = useApiList(() => getStaff())
  const filters = useFilters(data, filterConfig)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(null)
  const [tasks, setTasks] = useState([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [taskForm, setTaskForm] = useState(emptyTaskForm)

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
    setSelected(row)
    loadTasks(row)
  }

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
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <button type="button" className="btn btn--sm btn--outline" onClick={(e) => { e.stopPropagation(); openStaff(row) }}>
          Manage
        </button>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Staff Management"
        description="Manage Admin and Staff accounts, and assign operational tasks."
        actions={<button type="button" className="btn btn--primary" onClick={() => setShowForm(true)}>+ Add Staff</button>}
      />
      <FilterBar controller={filters} searchPlaceholder="Search by ID, name, or email..." />
      <ApiState loading={loading} error={error} onRetry={reload}>
        <DataTable columns={columns} data={filters.filtered} onRowClick={openStaff} />
      </ApiState>

      {selected && (
        <div className="admin-modal-overlay" onClick={() => setSelected(null)}>
          <div className="admin-modal admin-modal--wide volunteer-manage-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title={selected.name}
              subtitle={`${selected.id} · ${selected.role} · ${selected.email || 'No email'}`}
              onClose={() => setSelected(null)}
            />

            <section className="volunteer-panel-section">
              <h3>Staff Information</h3>
              <dl className="detail-list">
                <dt>Status</dt><dd><StatusBadge status={selected.status} /></dd>
                <dt>Role</dt><dd>{selected.role}</dd>
                <dt>Department</dt><dd>{selected.department}</dd>
                <dt>Email</dt>
                <dd>
                  <span className="volunteer-inline-meta"><Mail size={13} /> {selected.email || '—'}</span>
                </dd>
                <dt>Assigned Tasks</dt>
                <dd>
                  <span className="volunteer-inline-meta"><ListTodo size={13} /> {tasks.length}</span>
                </dd>
              </dl>
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
                <p className="beneficiary-view-empty">Task assignment is available for Staff accounts. Admins manage the system.</p>
              ) : tasksLoading ? (
                <p className="beneficiary-view-empty">Loading tasks…</p>
              ) : tasks.length === 0 ? (
                <p className="beneficiary-view-empty">No tasks assigned to this staff member yet.</p>
              ) : (
                <div className="volunteer-task-list">
                  {tasks.map((t) => (
                    <article key={t.dbId || t.id} className="volunteer-task-card">
                      <div className="volunteer-task-card__top">
                        <strong>{t.title}</strong>
                        <StatusBadge status={t.status || t.boardColumn} />
                      </div>
                      <div className="volunteer-task-card__meta">
                        <span>Priority: {t.priority}</span>
                        <span>Due: {t.due || '—'}</span>
                        <span>{t.module || 'Operations'}</span>
                        {t.completedAtLabel ? <span>Completed: {t.completedAtLabel}</span> : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
              <p className="volunteer-panel-hint">
                <UserCog size={14} /> Staff mark tasks Done from their Staff Portal → My Tasks.
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
                </span>
              </label>
              <div className="admin-modal__actions">
                <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Creating…' : 'Create Account'}</button>
                <button type="button" className="btn btn--ghost" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
