import { useState, useMemo } from 'react'
import { CheckCircle2, Clock, AlertCircle, Filter, Search, Calendar, User, Tag } from 'lucide-react'
import ApiState from '../../components/admin/shared/ApiState'
import { getPortalData, tasksApi } from '../../api/resources'
import { useApiObject } from '../../hooks/useApiList'
import { notify } from '../../utils/toast'

export default function StaffTasksPage() {
  const { data: portalData, loading, error, reload } = useApiObject(() => getPortalData())
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTask, setSelectedTask] = useState(null)
  const [saving, setSaving] = useState(false)

  const tasks = portalData?.tasks || []

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (filterStatus !== 'all' && task.status !== filterStatus) return false
      if (filterPriority !== 'all' && task.priority !== filterPriority) return false
      if (filterCategory !== 'all' && task.category !== filterCategory) return false
      if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !task.description?.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })
  }, [tasks, filterStatus, filterPriority, filterCategory, searchQuery])

  const categories = [...new Set(tasks.map(t => t.category))]
  const statusCounts = {
    'In Progress': tasks.filter(t => t.status === 'In Progress').length,
    'Assigned': tasks.filter(t => t.status === 'Assigned').length,
    'Pending': tasks.filter(t => t.status === 'Pending').length,
    'Completed': tasks.filter(t => t.status === 'Completed').length,
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High': return '#dc2626'
      case 'Medium': return '#f59e0b'
      case 'Low': return '#6b7280'
      default: return '#6b7280'
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'In Progress': return '#3b82f6'
      case 'Assigned': return '#f59e0b'
      case 'Pending': return '#6b7280'
      case 'Completed': return '#16a34a'
      default: return '#6b7280'
    }
  }

  const getCategoryColor = (category) => {
    const colors = {
      'Verification': '#d97706',
      'Distribution': '#16a34a',
      'Inventory': '#0891b2',
      'Beneficiary': '#7c3aed',
      'Volunteer': '#2563eb',
      'Reporting': '#6b7280',
      'Programs': '#dc2626',
      'Admin': '#4b5563',
    }
    return colors[category] || '#6b7280'
  }

  const getDaysUntilDue = (dueDate) => {
    if (!dueDate || dueDate === '—') return 999
    const key = String(dueDate).slice(0, 10)
    const parts = key.split('-').map(Number)
    const due = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date(dueDate)
    if (Number.isNaN(due.getTime())) return 999
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Math.ceil((due - today) / (1000 * 60 * 60 * 24))
  }

  const handleComplete = async (task) => {
    if (!task?.dbId) return
    if (!window.confirm(`Mark "${task.title}" as completed?`)) return
    setSaving(true)
    try {
      await tasksApi.update(task.dbId, { boardColumn: 'done' })
      notify.success('Task marked as completed.')
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
      {portalData && (
        <div className="staff-tasks-page">
          {/* Summary Cards */}
          <div className="staff-tasks-summary">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div 
                key={status} 
                className={`staff-task-summary-card ${filterStatus === status ? 'staff-task-summary-card--active' : ''}`}
                onClick={() => setFilterStatus(filterStatus === status ? 'all' : status)}
              >
                <span className="staff-task-summary-card__value">{count}</span>
                <span className="staff-task-summary-card__label">{status}</span>
                <div 
                  className="staff-task-summary-card__indicator" 
                  style={{ backgroundColor: getStatusColor(status) }}
                ></div>
              </div>
            ))}
          </div>

          <section className="portal-panel">
            <div className="portal-panel__header">
              <h2>Task Management</h2>
              <span className="portal-panel__hint">
                {filteredTasks.length} of {tasks.length} tasks
              </span>
            </div>

            {/* Filters */}
            <div className="staff-tasks-filters">
              <div className="staff-tasks-filters__search">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="staff-tasks-filters__input"
                />
              </div>

              <div className="staff-tasks-filters__group">
                <div className="staff-tasks-filters__item">
                  <Filter size={16} />
                  <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                    <option value="all">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="staff-tasks-filters__item">
                  <AlertCircle size={16} />
                  <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
                    <option value="all">All Priorities</option>
                    <option value="High">High Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="Low">Low Priority</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Task List */}
            {filteredTasks.length === 0 ? (
              <div className="portal-empty">
                <p>No tasks match your filters.</p>
              </div>
            ) : (
              <div className="staff-tasks-grid">
                {filteredTasks.map((task) => {
                  const daysUntil = getDaysUntilDue(task.dueDate)
                  const isOverdue = daysUntil < 0 && task.status !== 'Completed'
                  const isDueSoon = daysUntil >= 0 && daysUntil <= 2 && task.status !== 'Completed'

                  return (
                    <div 
                      key={task.id} 
                      className={`staff-task-detail-card ${task.status === 'Completed' ? 'staff-task-detail-card--completed' : ''}`}
                      onClick={() => setSelectedTask(task)}
                    >
                      <div className="staff-task-detail-card__header">
                        <div className="staff-task-detail-card__badges">
                          <span 
                            className="staff-task-detail-card__category"
                            style={{ 
                              backgroundColor: `${getCategoryColor(task.category)}15`,
                              color: getCategoryColor(task.category)
                            }}
                          >
                            <Tag size={12} />
                            {task.category}
                          </span>
                          <span 
                            className="staff-task-detail-card__priority"
                            style={{ 
                              backgroundColor: `${getPriorityColor(task.priority)}15`,
                              color: getPriorityColor(task.priority)
                            }}
                          >
                            <AlertCircle size={12} />
                            {task.priority}
                          </span>
                        </div>
                        <span 
                          className="staff-task-detail-card__status"
                          style={{ 
                            backgroundColor: `${getStatusColor(task.status)}15`,
                            color: getStatusColor(task.status)
                          }}
                        >
                          {task.status}
                        </span>
                      </div>

                      <h3 className="staff-task-detail-card__title">{task.title}</h3>
                      <p className="staff-task-detail-card__description">{task.description}</p>

                      <div className="staff-task-detail-card__meta">
                        <div className="staff-task-detail-card__meta-item">
                          <Calendar size={14} />
                          <span className={isOverdue ? 'text-danger' : isDueSoon ? 'text-warning' : ''}>
                            {isOverdue ? `Overdue by ${Math.abs(daysUntil)} days` : 
                             isDueSoon ? `Due in ${daysUntil} ${daysUntil === 1 ? 'day' : 'days'}` :
                             task.dueDate}
                          </span>
                        </div>
                        <div className="staff-task-detail-card__meta-item">
                          <Clock size={14} />
                          <span>{task.estimatedTime}</span>
                        </div>
                        {task.assignedTo && (
                          <div className="staff-task-detail-card__meta-item">
                            <User size={14} />
                            <span>{task.assignedTo}</span>
                          </div>
                        )}
                      </div>

                      {task.completionRate > 0 && task.status !== 'Completed' && (
                        <div className="staff-task-detail-card__progress">
                          <div className="staff-task-detail-card__progress-info">
                            <span>Progress</span>
                            <span>{task.completionRate}%</span>
                          </div>
                          <div className="staff-task-progress">
                            <div 
                              className="staff-task-progress__bar" 
                              style={{ width: `${task.completionRate}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {task.completedDate && (
                        <div className="staff-task-detail-card__completed">
                          <CheckCircle2 size={14} />
                          <span>Completed on {task.completedDate}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Task Detail Modal */}
          {selectedTask && (
            <div className="staff-task-modal-overlay" onClick={() => setSelectedTask(null)}>
              <div className="staff-task-modal" onClick={(e) => e.stopPropagation()}>
                <div className="staff-task-modal__header">
                  <h2>{selectedTask.title}</h2>
                  <button 
                    className="staff-task-modal__close"
                    onClick={() => setSelectedTask(null)}
                  >
                    ×
                  </button>
                </div>
                <div className="staff-task-modal__content">
                  <div className="staff-task-modal__badges">
                    <span style={{ backgroundColor: `${getCategoryColor(selectedTask.category)}15`, color: getCategoryColor(selectedTask.category) }}>
                      {selectedTask.category}
                    </span>
                    <span style={{ backgroundColor: `${getPriorityColor(selectedTask.priority)}15`, color: getPriorityColor(selectedTask.priority) }}>
                      {selectedTask.priority} Priority
                    </span>
                    <span style={{ backgroundColor: `${getStatusColor(selectedTask.status)}15`, color: getStatusColor(selectedTask.status) }}>
                      {selectedTask.status}
                    </span>
                  </div>
                  <p className="staff-task-modal__description">{selectedTask.description}</p>
                  <div className="staff-task-modal__details">
                    <div className="staff-task-modal__detail-item">
                      <strong>Due Date:</strong>
                      <span>{selectedTask.dueDate}</span>
                    </div>
                    <div className="staff-task-modal__detail-item">
                      <strong>Created:</strong>
                      <span>{selectedTask.createdDate}</span>
                    </div>
                    <div className="staff-task-modal__detail-item">
                      <strong>Estimated Time:</strong>
                      <span>{selectedTask.estimatedTime}</span>
                    </div>
                    <div className="staff-task-modal__detail-item">
                      <strong>Assigned To:</strong>
                      <span>{selectedTask.assignedTo}</span>
                    </div>
                    {selectedTask.completedDate && (
                      <div className="staff-task-modal__detail-item">
                        <strong>Completed:</strong>
                        <span>{selectedTask.completedDate}</span>
                      </div>
                    )}
                  </div>
                  {selectedTask.status !== 'Completed' && (
                    <div className="staff-task-modal__actions">
                      <button
                        type="button"
                        className="btn btn--primary"
                        disabled={saving}
                        onClick={() => handleComplete(selectedTask)}
                      >
                        <CheckCircle2 size={16} />
                        {saving ? 'Saving...' : 'Mark as Completed'}
                      </button>
                      {selectedTask.boardColumn !== 'inProgress' && (
                        <button
                          type="button"
                          className="btn btn--outline"
                          disabled={saving}
                          onClick={async () => {
                            setSaving(true)
                            try {
                              await tasksApi.update(selectedTask.dbId, { boardColumn: 'inProgress' })
                              notify.success('Task started.')
                              setSelectedTask(null)
                              reload()
                            } catch (err) {
                              notify.error(err.message || 'Failed to update task')
                            } finally {
                              setSaving(false)
                            }
                          }}
                        >
                          Start Task
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </ApiState>
  )
}
