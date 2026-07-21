import { useState } from 'react'
import { tasksApi, volunteersApi } from '../../api/resources'
import { useApiObject, useApiList } from '../../hooks/useApiList'
import { TASK_TYPES } from '../../constants/options'
import { useFilters } from '../../hooks/useFilters'
import PageHeader from '../../components/admin/shared/PageHeader'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import FilterBar from '../../components/admin/shared/FilterBar'
import { User, Calendar, Clock, Pencil } from 'lucide-react'
import ModalHeader from '../../components/admin/shared/ModalHeader'

const filterConfig = {
  searchKeys: ['id', 'title', 'assignee'],
  filters: [
    { key: 'priority', label: 'Priority', options: ['Low', 'Medium', 'High', 'Critical'] },
    { key: 'module', label: 'Module' },
  ],
  dateKey: 'dueDate',
}

const MODULE_OPTIONS = [...new Set([...TASK_TYPES, 'Donations', 'Volunteers', 'Beneficiaries', 'Inventory', 'Distribution', 'Reports', 'General'])]
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
  dutyStart: '',
  dutyEnd: '',
  dutyHours: '',
  module: 'General',
  boardColumn: 'todo',
}

function computeDutyHours(start, end) {
  if (!start || !end) return null
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let diff = (eh * 60 + em - (sh * 60 + sm)) / 60
  if (diff <= 0) diff += 24
  return Math.round(diff * 100) / 100
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
        {task.dutyLabel && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <Clock size={12} />{task.dutyLabel}
          </span>
        )}
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
  const taskTypeOptions = MODULE_OPTIONS
  const [showForm, setShowForm] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const allTasks = tasks
    ? [...(tasks.todo || []), ...(tasks.inProgress || []), ...(tasks.review || []), ...(tasks.done || [])]
    : []
  const filters = useFilters(allTasks, filterConfig)
  const matchedIds = new Set(filters.filtered.map((t) => t.dbId))

  const columns = tasks ? [
    { id: 'todo', label: 'To Do', items: (tasks.todo || []).filter((t) => matchedIds.has(t.dbId)) },
    { id: 'inProgress', label: 'In Progress', items: (tasks.inProgress || []).filter((t) => matchedIds.has(t.dbId)) },
    { id: 'review', label: 'In Review', items: (tasks.review || []).filter((t) => matchedIds.has(t.dbId)) },
    { id: 'done', label: 'Done', items: (tasks.done || []).filter((t) => matchedIds.has(t.dbId)) },
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
      dutyStart: task.dutyStart || '',
      dutyEnd: task.dutyEnd || '',
      dutyHours: task.dutyHours != null ? String(task.dutyHours) : '',
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
    const hasAssignee = form.volunteerId || form.assignee.trim()
    const hasSchedule = form.dutyStart && form.dutyEnd
    const hasHours = Number(form.dutyHours) > 0
    if (hasAssignee && !hasSchedule && !hasHours) {
      alert('Duty Hours are required: set a start and end time, or enter total hours.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        priority: form.priority,
        dueDate: form.dueDate || null,
        dutyStart: form.dutyStart || null,
        dutyEnd: form.dutyEnd || null,
        dutyHours: hasHours ? Number(form.dutyHours) : (computeDutyHours(form.dutyStart, form.dutyEnd) ?? null),
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

      <FilterBar controller={filters} searchPlaceholder="Search tasks by ID, title, or assignee..." />

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
            <ModalHeader
              title={editRow ? `Edit Task ${editRow.id}` : 'Create Task for Volunteer'}
              onClose={() => setShowForm(false)}
            />
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
                  Task Type / Module
                  <select value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })}>
                    {taskTypeOptions.map((m) => <option key={m} value={m}>{m}</option>)}
                    {form.module && !taskTypeOptions.includes(form.module) && (
                      <option value={form.module}>{form.module}</option>
                    )}
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

              <fieldset className="duty-fieldset">
                <legend>Duty Hours {form.volunteerId || form.assignee.trim() ? '(required)' : ''}</legend>
                <div className="form-row">
                  <label>
                    Start Time
                    <input type="time" value={form.dutyStart} onChange={(e) => setForm({ ...form, dutyStart: e.target.value })} />
                  </label>
                  <label>
                    End Time
                    <input type="time" value={form.dutyEnd} onChange={(e) => setForm({ ...form, dutyEnd: e.target.value })} />
                  </label>
                </div>
                <label>
                  Total Hours {form.dutyStart && form.dutyEnd ? '(auto-computed if left blank)' : ''}
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.dutyHours}
                    onChange={(e) => setForm({ ...form, dutyHours: e.target.value })}
                    placeholder={form.dutyStart && form.dutyEnd ? String(computeDutyHours(form.dutyStart, form.dutyEnd) ?? '') : 'e.g. 4'}
                  />
                </label>
                <p className="duty-hint">Set a start &amp; end time, or just the total hours. The volunteer sees this with the task.</p>
              </fieldset>

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
