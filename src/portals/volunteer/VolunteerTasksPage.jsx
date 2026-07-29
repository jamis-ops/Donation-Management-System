import { useState } from 'react'
import { Clock, Search, CheckCircle, Eye } from 'lucide-react'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import { tasksApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { notify } from '../../utils/toast'

const STATUS_FILTERS = ['All', 'To Do', 'In Progress', 'In Review', 'Done']

export default function VolunteerTasksPage() {
  const { data, loading, error, reload } = useApiList(() =>
    tasksApi.list().then((r) => ({
      data: Array.isArray(r.data) ? r.data : (r.list || []),
    }))
  )

  const [statusFilter, setStatusFilter] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTask, setSelectedTask] = useState(null)
  const [saving, setSaving] = useState(false)

  const filteredTasks = data.filter((task) => {
    const matchesStatus = statusFilter === 'All' || task.status === statusFilter
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      !q ||
      task.title?.toLowerCase().includes(q) ||
      task.module?.toLowerCase().includes(q) ||
      task.category?.toLowerCase().includes(q)
    return matchesStatus && matchesSearch
  })

  const statusCounts = STATUS_FILTERS.reduce((acc, status) => {
    acc[status] = status === 'All'
      ? data.length
      : data.filter((t) => t.status === status).length
    return acc
  }, {})

  const handleMarkComplete = async (task) => {
    if (!task?.dbId) return
    if (!confirm(`Mark "${task.title}" as done?`)) return
    setSaving(true)
    try {
      await tasksApi.update(task.dbId, { boardColumn: 'done' })
      notify.success('Task marked as done.')
      setSelectedTask(null)
      reload()
    } catch (err) {
      notify.error(err.message || 'Failed to update task')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      <section className="portal-panel">
        <div className="portal-panel__header">
          <h2>My Tasks</h2>
          <span className="portal-panel__count">{filteredTasks.length} tasks</span>
        </div>

        <div className="portal-filter-bar">
          <div className="portal-filter-bar__search">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="portal-search-input"
            />
          </div>
          <div className="portal-filter-bar__filters">
            {STATUS_FILTERS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`portal-filter-btn ${statusFilter === status ? 'active' : ''}`}
              >
                {status} <span className="portal-filter-btn__count">({statusCounts[status]})</span>
              </button>
            ))}
          </div>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="portal-empty">
            <CheckCircle size={36} />
            <p>
              {searchQuery
                ? `No tasks found matching "${searchQuery}"`
                : statusFilter !== 'All'
                  ? `No ${statusFilter.toLowerCase()} tasks`
                  : 'No tasks assigned yet'}
            </p>
          </div>
        ) : (
          <ul className="portal-task-list portal-task-list--enhanced">
            {filteredTasks.map((t) => (
              <li key={t.dbId || t.id} className="portal-task-item portal-task-item--enhanced">
                <div className="portal-task-item__main">
                  <div className="portal-task-item__header">
                    <strong>{t.title}</strong>
                    <div className="portal-task-item__badges">
                      <StatusBadge status={t.status} />
                      {t.priority && (
                        <span className={`portal-priority-badge portal-priority-badge--${String(t.priority).toLowerCase()}`}>
                          {t.priority}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="portal-task-item__meta">
                    <span>
                      <Clock size={14} /> Due: {t.due || '—'}
                    </span>
                    <span className="portal-task-item__category">{t.module || t.category || 'General'}</span>
                    {(t.dutyHours || t.hours) && (
                      <span className="portal-task-item__hours">{t.dutyHours || t.hours}h estimated</span>
                    )}
                    {t.dutyLabel && <span>{t.dutyLabel}</span>}
                  </div>
                </div>
                <div className="portal-task-item__actions">
                  {!t.isDone && t.status !== 'Done' && (
                    <button
                      type="button"
                      className="btn btn--sm btn--primary"
                      disabled={saving}
                      onClick={() => handleMarkComplete(t)}
                    >
                      <CheckCircle size={14} /> Complete
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn--sm btn--outline"
                    onClick={() => setSelectedTask(t)}
                  >
                    <Eye size={14} /> Details
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedTask && (
        <div className="admin-modal-overlay" onClick={() => setSelectedTask(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal__header">
              <h3>{selectedTask.title}</h3>
              <button type="button" onClick={() => setSelectedTask(null)} className="admin-modal__close">×</button>
            </div>
            <div className="admin-modal__body">
              <div className="portal-task-detail">
                <div className="portal-task-detail__row">
                  <label>Task ID</label>
                  <span>{selectedTask.id}</span>
                </div>
                <div className="portal-task-detail__row">
                  <label>Status</label>
                  <StatusBadge status={selectedTask.status} />
                </div>
                <div className="portal-task-detail__row">
                  <label>Priority</label>
                  <span className={`portal-priority-badge portal-priority-badge--${String(selectedTask.priority || '').toLowerCase()}`}>
                    {selectedTask.priority || '—'}
                  </span>
                </div>
                <div className="portal-task-detail__row">
                  <label>Category</label>
                  <span>{selectedTask.module || selectedTask.category || 'General'}</span>
                </div>
                <div className="portal-task-detail__row">
                  <label>Due Date</label>
                  <span>{selectedTask.due || '—'}</span>
                </div>
                {(selectedTask.dutyHours || selectedTask.hours) && (
                  <div className="portal-task-detail__row">
                    <label>Duty Hours</label>
                    <span>{selectedTask.dutyHours || selectedTask.hours} hours</span>
                  </div>
                )}
                {selectedTask.dutyLabel && (
                  <div className="portal-task-detail__row">
                    <label>Duty</label>
                    <span>{selectedTask.dutyLabel}</span>
                  </div>
                )}
                {(selectedTask.completedAtLabel || selectedTask.completedDate) && (
                  <div className="portal-task-detail__row">
                    <label>Completed</label>
                    <span>{selectedTask.completedAtLabel || selectedTask.completedDate}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="admin-modal__footer">
              {!selectedTask.isDone && selectedTask.status !== 'Done' && (
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={saving}
                  onClick={() => handleMarkComplete(selectedTask)}
                >
                  <CheckCircle size={16} /> {saving ? 'Saving...' : 'Mark as Complete'}
                </button>
              )}
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => setSelectedTask(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </ApiState>
  )
}
