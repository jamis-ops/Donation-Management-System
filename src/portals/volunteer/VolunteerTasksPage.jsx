import { useState } from 'react'
import { Clock, Search, CheckCircle, Eye, Truck, PackageCheck, MapPin } from 'lucide-react'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import { tasksApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { usePagination, DEFAULT_PAGE_SIZE } from '../../hooks/usePagination'
import Pagination from '../../components/admin/shared/Pagination'
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
      task.category?.toLowerCase().includes(q) ||
      task.distributionCode?.toLowerCase().includes(q) ||
      task.distributionLabel?.toLowerCase().includes(q)
    return matchesStatus && matchesSearch
  })

  const paging = usePagination(filteredTasks, DEFAULT_PAGE_SIZE, `${searchQuery}|${statusFilter}`)

  const statusCounts = STATUS_FILTERS.reduce((acc, status) => {
    acc[status] = status === 'All'
      ? data.length
      : data.filter((t) => t.status === status).length
    return acc
  }, {})

  const applyTaskUpdate = (updated) => {
    if (!updated) {
      reload()
      return
    }
    setSelectedTask((prev) => (prev && (prev.dbId === updated.dbId) ? { ...prev, ...updated } : prev))
    reload()
  }

  const handleMarkComplete = async (task) => {
    if (!task?.dbId) return
    if (task.isDistributionTask && !task.isDone) {
      notify.warning('For delivery tasks, use In Transit / Delivered to update the distribution.')
      setSelectedTask(task)
      return
    }
    if (!confirm(`Mark "${task.title}" as done?`)) return
    setSaving(true)
    try {
      const res = await tasksApi.update(task.dbId, { boardColumn: 'done' })
      notify.success('Task marked as done.')
      setSelectedTask(null)
      applyTaskUpdate(res?.data)
    } catch (err) {
      notify.error(err.message || 'Failed to update task')
    } finally {
      setSaving(false)
    }
  }

  const handleDistributionStatus = async (task, distributionStatus) => {
    if (!task?.dbId || !task.distributionId) return
    const label = distributionStatus === 'In Transit' ? 'In Transit' : 'Delivered'
    if (!confirm(`Update distribution ${task.distributionCode || ''} to “${label}”? This will sync to Admin, Staff, and Barangay portals.`)) {
      return
    }
    setSaving(true)
    try {
      const res = await tasksApi.update(task.dbId, { distributionStatus })
      notify.success(`Distribution updated to ${label}.`)
      applyTaskUpdate(res?.data)
      if (distributionStatus === 'Delivered') {
        setSelectedTask(null)
      }
    } catch (err) {
      notify.error(err.message || 'Failed to update distribution status')
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
              placeholder="Search tasks or distributions..."
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
          <>
            <ul className="portal-task-list portal-task-list--enhanced">
              {paging.pageItems.map((t) => (
                <li key={t.dbId || t.id} className={`portal-task-item portal-task-item--enhanced${t.isDistributionTask ? ' portal-task-item--distribution' : ''}`}>
                  <div className="portal-task-item__main">
                    <div className="portal-task-item__header">
                      <strong>{t.title}</strong>
                      <div className="portal-task-item__badges">
                        <StatusBadge status={t.status} />
                        {t.isDistributionTask && t.distributionStatus && (
                          <StatusBadge status={t.distributionStatus} />
                        )}
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
                    {t.isDistributionTask && (
                      <div className="portal-task-dist">
                        <MapPin size={14} />
                        <span>
                          <strong>{t.distributionCode}</strong>
                          {t.distributionLabel ? ` · ${t.distributionLabel}` : ''}
                          {t.distributionLocation ? ` · ${t.distributionLocation}` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="portal-task-item__actions">
                    {t.isDistributionTask && t.canMarkInTransit && (
                      <button
                        type="button"
                        className="btn btn--sm btn--outline"
                        disabled={saving}
                        onClick={() => handleDistributionStatus(t, 'In Transit')}
                      >
                        <Truck size={14} /> In Transit
                      </button>
                    )}
                    {t.isDistributionTask && t.canMarkDelivered && (
                      <button
                        type="button"
                        className="btn btn--sm btn--primary"
                        disabled={saving}
                        onClick={() => handleDistributionStatus(t, 'Delivered')}
                      >
                        <PackageCheck size={14} /> Delivered
                      </button>
                    )}
                    {!t.isDistributionTask && !t.isDone && t.status !== 'Done' && (
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
            <Pagination
              page={paging.page}
              totalPages={paging.totalPages}
              total={paging.total}
              startIndex={paging.startIndex}
              endIndex={paging.endIndex}
              onPageChange={paging.setPage}
              className="pagination--portal"
              noun="tasks"
            />
          </>
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
                  <label>Task Status</label>
                  <StatusBadge status={selectedTask.status} />
                </div>
                {selectedTask.isDistributionTask && (
                  <>
                    <div className="portal-task-detail__row">
                      <label>Distribution</label>
                      <span>{selectedTask.distributionCode || '—'}{selectedTask.distributionLabel ? ` · ${selectedTask.distributionLabel}` : ''}</span>
                    </div>
                    <div className="portal-task-detail__row">
                      <label>Delivery Status</label>
                      <StatusBadge status={selectedTask.distributionStatus || '—'} />
                    </div>
                    {selectedTask.distributionLocation && (
                      <div className="portal-task-detail__row">
                        <label>Location</label>
                        <span>{selectedTask.distributionLocation}</span>
                      </div>
                    )}
                    <div className="portal-task-detail__row portal-task-detail__row--full">
                      <label>Delivery updates</label>
                      <p>
                        Use <strong>In Transit</strong> when goods are on the way, then <strong>Delivered</strong> when handed over.
                        These match Admin distribution statuses and update Staff and Barangay views automatically.
                      </p>
                    </div>
                  </>
                )}
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
            <div className="admin-modal__footer portal-task-detail__actions">
              {selectedTask.isDistributionTask && selectedTask.canMarkInTransit && (
                <button
                  type="button"
                  className="btn btn--outline"
                  disabled={saving}
                  onClick={() => handleDistributionStatus(selectedTask, 'In Transit')}
                >
                  <Truck size={16} /> {saving ? 'Saving…' : 'Mark In Transit'}
                </button>
              )}
              {selectedTask.isDistributionTask && selectedTask.canMarkDelivered && (
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={saving}
                  onClick={() => handleDistributionStatus(selectedTask, 'Delivered')}
                >
                  <PackageCheck size={16} /> {saving ? 'Saving…' : 'Mark Delivered'}
                </button>
              )}
              {!selectedTask.isDistributionTask && !selectedTask.isDone && selectedTask.status !== 'Done' && (
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
