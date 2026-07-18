import { useState } from 'react'
import { tasksApi, volunteersApi } from '../../api/resources'
import { useApiObject, useApiList } from '../../hooks/useApiList'
import PageHeader from '../../components/admin/shared/PageHeader'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import { User, Calendar, Pencil } from 'lucide-react'

const MODULE_OPTIONS = ['Donations', 'Volunteers', 'Beneficiaries', 'Inventory', 'Distribution', 'Reports', 'General']
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Critical']
const COLUMN_OPTIONS = [
  { value: 'todo', label: 'To Do' },
  { value: 'inProgress', label: 'In Progress' },
  { value: 'review', label: 'In Review' },
  { value: 'done', label: 'Done' },
]

const emptyForm = {
  title: '',
  volunteerId: '',
  assignee: '',
  priority: 'Medium',
  dueDate: '',
  module: 'General',
  boardColumn: 'todo',
}

function TaskCard({ task, onEdit }) {
  return (
    <div className="kanban-card" onClick={() => onEdit(task)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onEdit(task)}>
      <div className="kanban-card__header">
        <span className="kanban-card__id">{task.id}</span>
        <StatusBadge status={task.priority} />
      </div>
      <h4>{task.title}</h4>
      <div className="kanban-card__meta">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          <User size={12} />{task.assignee || 'Unassigned'}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          <Calendar size={12} />{task.due || 'No due date'}
        </span>
      </div>
      <div className="kanban-card__footer">
        <span className="kanban-card__module">{task.module}</span>
        <Pencil size={12} className="kanban-card__edit-hint" />
      </div>
    </div>
  )
}

export default function TasksPage() {
  const { data: tasks, loading, error, reload } = useApiObject(() => tasksApi.list())
  const { data: volunteers } = useApiList(() => volunteersApi.list())
  const [showForm, setShowForm] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const columns = tasks ? [
    { id: 'todo', label: 'To Do', items: tasks.todo || [] },
    { id: 'inProgress', label: 'In Progress', items: tasks.inProgress || [] },
    { id: 'review', label: 'In Review', items: tasks.review || [] },
    { id: 'done', label: 'Done', items: tasks.done || [] },
  ] : []

  const openCreate = () => {
    setEditRow(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (task) => {
    const volunteer = volunteers.find((v) => v.name === task.assignee)
    setEditRow(task)
    setForm({
      title: task.title,
      volunteerId: volunteer?.dbId ? String(volunteer.dbId) : '',
      assignee: task.assignee || '',
      priority: task.priority || 'Medium',
      dueDate: task.dueDate || '',
      module: task.module || 'General',
      boardColumn: task.boardColumn || 'todo',
    })
    setShowForm(true)
  }

  const handleVolunteerChange = (volunteerId) => {
    const vol = volunteers.find((v) => String(v.dbId) === volunteerId)
    setForm({
      ...form,
      volunteerId,
      assignee: vol ? vol.name : '',
    })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) {
      alert('Task title is required.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        priority: form.priority,
        dueDate: form.dueDate || null,
        module: form.module,
        boardColumn: form.boardColumn,
      }
      if (form.volunteerId) {
        payload.volunteerId = Number(form.volunteerId)
      } else if (form.assignee.trim()) {
        payload.assignee = form.assignee.trim()
        payload.assigneeUserId = null
      } else {
        payload.assignee = null
        payload.assigneeUserId = null
      }

      if (editRow) {
        await tasksApi.update(editRow.dbId, payload)
      } else {
        await tasksApi.create(payload)
      }
      setShowForm(false)
      reload()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editRow || !window.confirm(`Delete task "${editRow.title}"?`)) return
    try {
      await tasksApi.remove(editRow.dbId)
      setShowForm(false)
      reload()
    } catch (err) {
      alert(err.message)
    }
  }

  const assignableVolunteers = volunteers.filter((v) =>
    ['Approved', 'Active', 'Assigned'].includes(v.status)
  )

  return (
    <>
      <PageHeader
        title="Task Management"
        description="Create tasks and assign them to volunteers. Assigned volunteers are notified in their portal."
        actions={<button type="button" className="btn btn--primary" onClick={openCreate}>+ Create Task</button>}
      />

      <ApiState loading={loading} error={error} onRetry={reload}>
        <div className="kanban-board">
          {columns.map((col) => (
            <div key={col.id} className="kanban-column">
              <div className="kanban-column__header">
                <h3>{col.label}</h3>
                <span className="kanban-column__count">{col.items.length}</span>
              </div>
              <div className="kanban-column__cards">
                {col.items.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '1rem 0', margin: 0 }}>No tasks</p>
                ) : (
                  col.items.map((task) => <TaskCard key={task.id} task={task} onEdit={openEdit} />)
                )}
              </div>
            </div>
          ))}
        </div>
      </ApiState>

      {showForm && (
        <div className="admin-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <h2>{editRow ? `Edit Task ${editRow.id}` : 'Create Task for Volunteer'}</h2>
            <form onSubmit={handleSave}>
              <label>
                Task Title
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Assist with Talisay distribution setup"
                />
              </label>

              <label>
                Assign to Volunteer
                <select value={form.volunteerId} onChange={(e) => handleVolunteerChange(e.target.value)}>
                  <option value="">Select volunteer (optional)</option>
                  {assignableVolunteers.map((v) => (
                    <option key={v.dbId} value={v.dbId}>
                      {v.name} — {v.status}{v.userId ? '' : ' (no portal account)'}
                    </option>
                  ))}
                </select>
              </label>

              {!form.volunteerId && (
                <label>
                  Or assign to staff / team name
                  <input
                    value={form.assignee}
                    onChange={(e) => setForm({ ...form, assignee: e.target.value })}
                    placeholder="e.g. Carlos Mendoza, Staff Team A"
                  />
                </label>
              )}

              <div className="form-row">
                <label>
                  Priority
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
                <label>
                  Module
                  <select value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })}>
                    {MODULE_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
              </div>

              <div className="form-row">
                <label>
                  Due Date
                  <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                </label>
                <label>
                  Board Column
                  <select value={form.boardColumn} onChange={(e) => setForm({ ...form, boardColumn: e.target.value })}>
                    {COLUMN_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </label>
              </div>

              <div className="admin-modal__actions">
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'Saving...' : editRow ? 'Save Changes' : 'Create Task'}
                </button>
                {editRow && (
                  <button type="button" className="btn btn--ghost" onClick={handleDelete}>Delete</button>
                )}
                <button type="button" className="btn btn--ghost" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
