import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Filter,
  Search,
  Calendar,
  User,
  Tag,
  MapPin,
  FileText,
  Truck,
  ArrowRight,
  Eye,
  Play,
  RotateCcw,
  CheckSquare,
} from 'lucide-react'
import ApiState from '../../admin/components/shared/ApiState'
import StatusBadge from '../../admin/components/shared/StatusBadge'
import ModalHeader from '../../admin/components/shared/ModalHeader'
import { tasksApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { usePagination, DEFAULT_PAGE_SIZE } from '../../hooks/usePagination'
import Pagination from '../../admin/components/shared/Pagination'
import { notify, confirmAction, showSuccessModal } from '../../utils/confirm'
import { notifyBadgesChanged } from '../../utils/badgeSync'
import { useLoading } from '../../context/LoadingContext'

export default function StaffTasksPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { showLoading, hideLoading } = useLoading()
  const { data: tasks = [], loading, error, reload } = useApiList(() => tasksApi.list())

  const [filterStatus, setFilterStatus] = useState(() => searchParams.get('status') || 'all')
  const [filterPriority, setFilterPriority] = useState(() => searchParams.get('priority') || 'all')
  const [filterCategory, setFilterCategory] = useState(() => searchParams.get('category') || 'all')
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || searchParams.get('search') || '')
  const [selectedTask, setSelectedTask] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const st = searchParams.get('status')
    if (st && st !== filterStatus) setFilterStatus(st)
    const pr = searchParams.get('priority')
    if (pr && pr !== filterPriority) setFilterPriority(pr)
    const cat = searchParams.get('category')
    if (cat && cat !== filterCategory) setFilterCategory(cat)
  }, [searchParams])

  const categories = useMemo(() => {
    const set = new Set()
    tasks.forEach((t) => {
      const c = t.program || t.category || t.module
      if (c) set.add(c)
    })
    return Array.from(set)
  }, [tasks])

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filterStatus !== 'all') {
        const target = filterStatus.toLowerCase()
        const col = String(task.boardColumn || '').toLowerCase()
        const st = String(task.status || '').toLowerCase()
        if (target === 'todo' && col !== 'todo' && st !== 'to do') return false
        if (target === 'inprogress' && col !== 'inprogress' && st !== 'in progress') return false
        if (target === 'review' && col !== 'review' && st !== 'in review') return false
        if (target === 'done' && col !== 'done' && st !== 'done' && st !== 'completed') return false
      }

      if (filterPriority !== 'all' && task.priority !== filterPriority) return false

      if (filterCategory !== 'all') {
        const c = task.program || task.category || task.module
        if (c !== filterCategory) return false
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchTitle = task.title?.toLowerCase().includes(q)
        const matchDesc = task.description?.toLowerCase().includes(q)
        const matchInst = task.instructions?.toLowerCase().includes(q)
        const matchCode = task.id?.toLowerCase().includes(q)
        const matchDist = task.distributionCode?.toLowerCase().includes(q)
        if (!matchTitle && !matchDesc && !matchInst && !matchCode && !matchDist) return false
      }

      return true
    })
  }, [tasks, filterStatus, filterPriority, filterCategory, searchQuery])

  const paging = usePagination(filteredTasks, DEFAULT_PAGE_SIZE, `${searchQuery}|${filterStatus}|${filterPriority}|${filterCategory}`)

  // Counts
  const statusCounts = useMemo(() => {
    return {
      all: tasks.length,
      todo: tasks.filter((t) => t.boardColumn === 'todo' || t.status === 'To Do').length,
      inProgress: tasks.filter((t) => t.boardColumn === 'inProgress' || t.status === 'In Progress').length,
      review: tasks.filter((t) => t.boardColumn === 'review' || t.status === 'In Review').length,
      done: tasks.filter((t) => t.boardColumn === 'done' || t.status === 'Done' || t.status === 'Completed').length,
    }
  }, [tasks])

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Critical': return '#dc2626'
      case 'High': return '#ea580c'
      case 'Medium': return '#d97706'
      case 'Low': return '#64748b'
      default: return '#64748b'
    }
  }

  // Update task status with confirmation and validation
  const handleUpdateStatus = async (task, nextColumn, actionLabel) => {
    if (!task?.dbId) return

    const ok = await confirmAction({
      title: `${actionLabel}`,
      message: `Update task "${task.title}" status to "${actionLabel}"? This update will persist to the database.`,
      confirmText: actionLabel,
      type: nextColumn === 'done' ? 'success' : 'primary',
    })
    if (!ok) return

    setSaving(true)
    showLoading('Updating task status…')
    try {
      const res = await tasksApi.update(task.dbId, { boardColumn: nextColumn })
      const updated = res?.data || { ...task, boardColumn: nextColumn, status: nextColumn === 'done' ? 'Done' : (nextColumn === 'inProgress' ? 'In Progress' : 'In Review') }
      showSuccessModal(`Task successfully updated: ${updated.status || actionLabel}.`)
      reload()
      notifyBadgesChanged()
      if (selectedTask && selectedTask.dbId === task.dbId) {
        setSelectedTask(updated)
      }
    } catch (err) {
      notify.error(err.message || 'Failed to update task')
    } finally {
      hideLoading()
      setSaving(false)
    }
  }

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      <div className="staff-tasks-page staff-portal-page">
        {/* Status Count Pills */}
        <div className="staff-tasks-summary" style={{ marginBottom: '1.25rem' }}>
          <button
            type="button"
            className={`staff-task-summary-card staff-task-summary-card--clickable ${filterStatus === 'all' ? 'staff-task-summary-card--active' : ''}`}
            onClick={() => setFilterStatus('all')}
          >
            <span className="staff-task-summary-card__value">{statusCounts.all}</span>
            <span className="staff-task-summary-card__label">All Tasks</span>
          </button>
          <button
            type="button"
            className={`staff-task-summary-card staff-task-summary-card--clickable ${filterStatus === 'todo' ? 'staff-task-summary-card--active' : ''}`}
            onClick={() => setFilterStatus('todo')}
          >
            <span className="staff-task-summary-card__value" style={{ color: '#64748b' }}>{statusCounts.todo}</span>
            <span className="staff-task-summary-card__label">To Do</span>
          </button>
          <button
            type="button"
            className={`staff-task-summary-card staff-task-summary-card--clickable ${filterStatus === 'inprogress' ? 'staff-task-summary-card--active' : ''}`}
            onClick={() => setFilterStatus('inprogress')}
          >
            <span className="staff-task-summary-card__value" style={{ color: '#2563eb' }}>{statusCounts.inProgress}</span>
            <span className="staff-task-summary-card__label">In Progress</span>
          </button>
          <button
            type="button"
            className={`staff-task-summary-card staff-task-summary-card--clickable ${filterStatus === 'review' ? 'staff-task-summary-card--active' : ''}`}
            onClick={() => setFilterStatus('review')}
          >
            <span className="staff-task-summary-card__value" style={{ color: '#d97706' }}>{statusCounts.review}</span>
            <span className="staff-task-summary-card__label">In Review</span>
          </button>
          <button
            type="button"
            className={`staff-task-summary-card staff-task-summary-card--clickable ${filterStatus === 'done' ? 'staff-task-summary-card--active' : ''}`}
            onClick={() => setFilterStatus('done')}
          >
            <span className="staff-task-summary-card__value" style={{ color: '#16a34a' }}>{statusCounts.done}</span>
            <span className="staff-task-summary-card__label">Completed</span>
          </button>
        </div>

        {/* Tasks Panel */}
        <section className="portal-panel">
          <div className="portal-panel__header" style={{ flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
            <div>
              <h2>Staff Task Management</h2>
              <span className="portal-panel__hint">
                Showing {filteredTasks.length} of {tasks.length} tasks assigned to you
              </span>
            </div>

            {/* Filter and Search Bar */}
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ width: '260px', position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                <input
                  type="text"
                  className="portal-search-input"
                  style={{
                    paddingLeft: '36px',
                    paddingRight: '12px',
                    width: '100%',
                    height: '38px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                  placeholder="Search task title or details..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select
                className="portal-select"
                style={{ height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', background: '#fff', fontSize: '0.85rem' }}
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="all">All Programs</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <select
                className="portal-select"
                style={{ height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', background: '#fff' }}
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
              >
                <option value="all">All Priorities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="portal-empty" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
              <CheckSquare size={40} style={{ margin: '0 auto 0.75rem', color: '#94a3b8' }} />
              <p style={{ margin: 0, fontWeight: 600, color: '#334155' }}>No tasks found</p>
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Try clearing filters or check back later for new task assignments.</span>
            </div>
          ) : (
            <>
              {/* Task Cards Grid */}
              <div className="staff-record-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                {paging.pageItems.map((task) => {
                  const isDone = task.isDone || task.boardColumn === 'done' || task.status === 'Done'
                  const isTodo = task.boardColumn === 'todo' || task.status === 'To Do'
                  const isProgress = task.boardColumn === 'inProgress' || task.status === 'In Progress'
                  const isReview = task.boardColumn === 'review' || task.status === 'In Review'

                  return (
                    <div
                      key={task.dbId || task.id}
                      className="staff-modern-record-card"
                      style={{
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: '1.15rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      }}
                    >
                      <div>
                        {/* Header Badges */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor: '#f1f5f9',
                              color: '#475569',
                              border: '1px solid #cbd5e1',
                            }}
                          >
                            {task.program || task.module || 'Operations'}
                          </span>

                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: `${getPriorityColor(task.priority)}15`,
                                color: getPriorityColor(task.priority),
                              }}
                            >
                              {task.priority || 'Medium'}
                            </span>
                            <StatusBadge status={task.status} />
                          </div>
                        </div>

                        {/* Title */}
                        <h3 style={{ margin: '0 0 0.65rem', fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.35 }}>
                          {task.title}
                        </h3>

                        {/* Schedule & Location */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.75rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={13} /> {task.schedule || task.due || task.dueDate || 'No due date'}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <MapPin size={13} /> {task.location || 'Depot / Distribution Site'}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <User size={13} /> Assigned: <strong>{task.assignee || 'Staff Member'}</strong>
                          </span>
                        </div>

                        {/* Linked Distribution Badge if applicable */}
                        {task.distributionCode && (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              background: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '0.74rem',
                              color: '#1d4ed8',
                              fontWeight: 600,
                              marginBottom: '0.75rem',
                            }}
                          >
                            <Truck size={12} />
                            <span>Linked Event: {task.distributionCode} ({task.distributionLabel || task.distributionLocation || 'Site'})</span>
                          </div>
                        )}
                      </div>

                      {/* Card Action Buttons */}
                      <div style={{ display: 'flex', gap: '0.45rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                        <button
                          type="button"
                          className="btn btn--sm btn--outline"
                          style={{ flex: 1 }}
                          onClick={() => setSelectedTask(task)}
                        >
                          <Eye size={14} /> Details
                        </button>

                        {isTodo && (
                          <button
                            type="button"
                            className="btn btn--sm btn--success"
                            style={{ flex: 1.2 }}
                            disabled={saving}
                            onClick={() => handleUpdateStatus(task, 'inProgress', 'Start Task')}
                          >
                            <Play size={14} /> Start Task
                          </button>
                        )}

                        {isProgress && (
                          <button
                            type="button"
                            className="btn btn--sm btn--success"
                            style={{ flex: 1.2 }}
                            disabled={saving}
                            onClick={() => handleUpdateStatus(task, 'done', 'Complete Task')}
                          >
                            <CheckCircle2 size={14} /> Complete
                          </button>
                        )}

                        {isReview && (
                          <button
                            type="button"
                            className="btn btn--sm btn--success"
                            style={{ flex: 1.2 }}
                            disabled={saving}
                            onClick={() => handleUpdateStatus(task, 'done', 'Complete Task')}
                          >
                            <CheckCircle2 size={14} /> Finalize
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

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

        {/* Task Details Modal */}
        {selectedTask && (() => {
          const isDone = selectedTask.isDone || selectedTask.boardColumn === 'done' || selectedTask.status === 'Done'
          const isTodo = selectedTask.boardColumn === 'todo' || selectedTask.status === 'To Do'
          const isProgress = selectedTask.boardColumn === 'inProgress' || selectedTask.status === 'In Progress'
          const isReview = selectedTask.boardColumn === 'review' || selectedTask.status === 'In Review'

          return (
            <div className="admin-modal-overlay" onClick={() => setSelectedTask(null)}>
              <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>
                <ModalHeader
                  title={selectedTask.title}
                  onClose={() => setSelectedTask(null)}
                />

                {/* Top Badges */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: '#f1f5f9',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                    }}
                  >
                    {selectedTask.program || selectedTask.module || 'Operations'}
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: `${getPriorityColor(selectedTask.priority)}15`,
                      color: getPriorityColor(selectedTask.priority),
                    }}
                  >
                    {selectedTask.priority} Priority
                  </span>
                  <StatusBadge status={selectedTask.status} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Task Instructions / Description */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', textTransform: 'uppercase', color: '#475569', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FileText size={15} color="#AF101A" /> Task Instructions & Scope
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b', lineHeight: 1.5 }}>
                      {selectedTask.instructions || selectedTask.description || selectedTask.title}
                    </p>
                  </div>

                  {/* Task Details Grid */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', textTransform: 'uppercase', color: '#475569', fontWeight: 700 }}>
                      Operational Details
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', fontSize: '0.85rem' }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Assigned Person</span>
                        <strong style={{ color: '#0f172a' }}>{selectedTask.assignee || 'Staff Member'}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Location / Site</span>
                        <strong style={{ color: '#0f172a' }}>{selectedTask.location || 'Depot / Distribution Site'}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Schedule / Due Date</span>
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>
                          {selectedTask.schedule || selectedTask.due || selectedTask.dueDate || '—'}
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Estimated Duration</span>
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>
                          {selectedTask.estimatedTime || (selectedTask.dutyHours ? `${selectedTask.dutyHours} hrs` : 'Standard Shift')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Related Distribution (if present) */}
                  {selectedTask.distributionCode && (
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 700, color: '#1e40af', marginBottom: '4px' }}>
                        <Truck size={16} /> Related Distribution Event
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#1e3a8a' }}>
                        <strong>{selectedTask.distributionCode}</strong> • {selectedTask.distributionLabel || selectedTask.distributionLocation || 'Distribution Site'}
                        {selectedTask.distributionStatus && (
                          <span style={{ marginLeft: '8px', padding: '1px 6px', borderRadius: '4px', background: '#dbeafe', color: '#1e40af', fontSize: '0.72rem', fontWeight: 600 }}>
                            {selectedTask.distributionStatus}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Completed timestamp if Done */}
                  {isDone && selectedTask.completedAtLabel && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#047857', background: '#ecfdf5', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                      <CheckCircle2 size={16} /> Completed on {selectedTask.completedAtLabel}
                    </div>
                  )}
                </div>

                {/* Modal Footer Actions */}
                <div className="admin-modal__actions" style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: '1.25rem' }}>
                  <button type="button" className="btn btn--ghost" onClick={() => setSelectedTask(null)}>
                    Close
                  </button>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {isTodo && (
                      <button
                        type="button"
                        className="btn btn--primary"
                        disabled={saving}
                        onClick={() => handleUpdateStatus(selectedTask, 'inProgress', 'Start Task')}
                      >
                        <Play size={16} /> Start Task
                      </button>
                    )}

                    {isProgress && (
                      <>
                        <button
                          type="button"
                          className="btn btn--outline"
                          disabled={saving}
                          onClick={() => handleUpdateStatus(selectedTask, 'review', 'Submit for Review')}
                        >
                          Submit for Review
                        </button>
                        <button
                          type="button"
                          className="btn btn--success"
                          disabled={saving}
                          onClick={() => handleUpdateStatus(selectedTask, 'done', 'Complete Task')}
                        >
                          <CheckCircle2 size={16} /> Complete Task
                        </button>
                      </>
                    )}

                    {isReview && (
                      <button
                        type="button"
                        className="btn btn--success"
                        disabled={saving}
                        onClick={() => handleUpdateStatus(selectedTask, 'done', 'Complete Task')}
                      >
                        <CheckCircle2 size={16} /> Finalize &amp; Complete Task
                      </button>
                    )}

                    {isDone && (
                      <span style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={16} /> Status Finalized &amp; Locked
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })()}
      </div>
    </ApiState>
  )
}
