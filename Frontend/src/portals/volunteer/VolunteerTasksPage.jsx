import { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Clock,
  Search,
  CheckCircle,
  Eye,
  Truck,
  PackageCheck,
  MapPin,
  CalendarDays,
  ShieldCheck,
  Layers,
  Tag,
  X,
  Check,
  Award,
  Sparkles,
  CheckCircle2,
} from 'lucide-react'
import StatusBadge from '../../admin/components/shared/StatusBadge'
import ApiState from '../../admin/components/shared/ApiState'
import { tasksApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { usePagination, DEFAULT_PAGE_SIZE } from '../../hooks/usePagination'
import Pagination from '../../admin/components/shared/Pagination'
import { notify, confirmAction, showSuccessModal } from '../../utils/confirm'
import { useLoading } from '../../context/LoadingContext'

const STATUS_FILTERS = ['All', 'Ongoing', 'Completed', 'Distributions']

function isDistributionTask(task) {
  if (!task) return false
  const m = String(task.module || task.category || '').toLowerCase()
  const t = String(task.title || '').toLowerCase()
  const isDistType =
    m.includes('distribution') ||
    m.includes('logistics') ||
    m.includes('delivery') ||
    m.includes('relief') ||
    t.includes('distribution') ||
    t.includes('delivery') ||
    t.includes('logistics')
  return Boolean(task.isDistributionTask || task.distributionId || task.distributionCode) && isDistType
}

function getVolunteerTaskStatus(task) {
  if (!task) return 'Ongoing'
  if (task.isDone || task.boardColumn === 'done' || task.status === 'Done' || task.status === 'Completed') {
    return 'Completed'
  }
  return 'Ongoing'
}

function mapParamToStatus(param) {
  if (!param) return 'All'
  const p = param.toLowerCase()
  if (p === 'completed' || p === 'done') return 'Completed'
  if (p === 'ongoing' || p === 'active' || p === 'in progress') return 'Ongoing'
  if (p === 'distributions' || p === 'distribution') return 'Distributions'
  return 'All'
}

export default function VolunteerTasksPage() {
  const [searchParams] = useSearchParams()
  const { data, loading, error, reload } = useApiList(() =>
    tasksApi.list().then((r) => ({
      data: Array.isArray(r.data) ? r.data : (r.list || []),
    }))
  )

  const [statusFilter, setStatusFilter] = useState(() => mapParamToStatus(searchParams.get('status') || searchParams.get('filter')))
  const { showLoading, hideLoading } = useLoading()
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || searchParams.get('search') || '')
  const [selectedTask, setSelectedTask] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const s = searchParams.get('status') || searchParams.get('filter')
    if (s) setStatusFilter(mapParamToStatus(s))
  }, [searchParams])

  const stats = useMemo(() => {
    const list = Array.isArray(data) ? data : []
    const total = list.length
    const ongoing = list.filter((t) => getVolunteerTaskStatus(t) === 'Ongoing').length
    const completed = list.filter((t) => getVolunteerTaskStatus(t) === 'Completed').length
    const distributions = list.filter(isDistributionTask).length
    return { total, ongoing, completed, distributions }
  }, [data])

  const filteredTasks = useMemo(() => {
    return (data || []).filter((task) => {
      const vStatus = getVolunteerTaskStatus(task)
      const isDist = isDistributionTask(task)
      
      let matchesStatus = true
      if (statusFilter === 'Ongoing') matchesStatus = vStatus === 'Ongoing'
      else if (statusFilter === 'Completed') matchesStatus = vStatus === 'Completed'
      else if (statusFilter === 'Distributions') matchesStatus = isDist

      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        task.title?.toLowerCase().includes(q) ||
        task.module?.toLowerCase().includes(q) ||
        task.category?.toLowerCase().includes(q) ||
        (isDist && (
          task.distributionCode?.toLowerCase().includes(q) ||
          task.distributionLabel?.toLowerCase().includes(q) ||
          task.distributionLocation?.toLowerCase().includes(q)
        ))
      return matchesStatus && matchesSearch
    })
  }, [data, statusFilter, searchQuery])

  const paging = usePagination(filteredTasks, DEFAULT_PAGE_SIZE, `${searchQuery}|${statusFilter}`)

  const statusCounts = {
    All: stats.total,
    Ongoing: stats.ongoing,
    Completed: stats.completed,
    Distributions: stats.distributions,
  }

  const applyTaskUpdate = (updated) => {
    if (!updated) {
      reload()
      return
    }
    setSelectedTask((prev) => (prev && (prev.dbId === updated.dbId) ? { ...prev, ...updated } : prev))
    reload()
  }

  const handleDistributionStatus = async (task, distributionStatus) => {
    if (!task?.dbId || !task.distributionId) return
    const label = distributionStatus === 'In Transit' ? 'In Transit' : 'Delivered'
    const ok = await confirmAction({
      title: 'Update Distribution Status',
      message: `Update distribution ${task.distributionCode || ''} to “${label}”? This will sync to Admin, Staff, and Barangay portals.`,
      confirmText: `Set to ${label}`,
      type: 'primary',
    })
    if (!ok) return

    setSaving(true)
    showLoading('Saving…')
    try {
      const res = await tasksApi.update(task.dbId, { distributionStatus })
      showSuccessModal(`Status successfully updated to: ${label}.`)
      applyTaskUpdate(res?.data)
      if (distributionStatus === 'Delivered') {
        setSelectedTask(null)
      }
    } catch (err) {
      notify.error(err.message || 'Failed to update distribution status')
    } finally {
      hideLoading()
      setSaving(false)
    }
  }

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      {/* Volunteer KPI Header Cards */}
      <div className="volunteer-kpi-grid">
        <div 
          className={`volunteer-kpi-card volunteer-kpi-card--total volunteer-kpi-card--clickable ${statusFilter === 'All' ? 'volunteer-kpi-card--active' : ''}`}
          onClick={() => setStatusFilter('All')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setStatusFilter('All') } }}
          title="Filter: All Tasks"
        >
          <div className="volunteer-kpi-card__icon">
            <Layers size={20} />
          </div>
          <div>
            <div className="volunteer-kpi-card__value">{stats.total}</div>
            <div className="volunteer-kpi-card__label">Assigned Tasks</div>
          </div>
        </div>

        <div 
          className={`volunteer-kpi-card volunteer-kpi-card--ongoing volunteer-kpi-card--clickable ${statusFilter === 'Ongoing' ? 'volunteer-kpi-card--active' : ''}`}
          onClick={() => setStatusFilter('Ongoing')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setStatusFilter('Ongoing') } }}
          title="Filter: Ongoing Tasks"
        >
          <div className="volunteer-kpi-card__icon">
            <Clock size={20} />
          </div>
          <div>
            <div className="volunteer-kpi-card__value">{stats.ongoing}</div>
            <div className="volunteer-kpi-card__label">Ongoing Duties</div>
          </div>
        </div>

        <div 
          className={`volunteer-kpi-card volunteer-kpi-card--completed volunteer-kpi-card--clickable ${statusFilter === 'Completed' ? 'volunteer-kpi-card--active' : ''}`}
          onClick={() => setStatusFilter('Completed')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setStatusFilter('Completed') } }}
          title="Filter: Completed Tasks"
        >
          <div className="volunteer-kpi-card__icon">
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="volunteer-kpi-card__value">{stats.completed}</div>
            <div className="volunteer-kpi-card__label">Completed Tasks</div>
          </div>
        </div>

        <div 
          className={`volunteer-kpi-card volunteer-kpi-card--dist volunteer-kpi-card--clickable ${statusFilter === 'Distributions' ? 'volunteer-kpi-card--active' : ''}`}
          onClick={() => setStatusFilter('Distributions')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setStatusFilter('Distributions') } }}
          title="Filter: Distribution Operations"
        >
          <div className="volunteer-kpi-card__icon">
            <Truck size={20} />
          </div>
          <div>
            <div className="volunteer-kpi-card__value">{stats.distributions}</div>
            <div className="volunteer-kpi-card__label">Distribution Ops</div>
          </div>
        </div>
      </div>

      <section className="portal-panel">
        <div className="portal-panel__header">
          <div>
            <h2>My Tasks &amp; Deployments</h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.825rem', color: '#64748b' }}>
              Track assigned volunteer duties and distribution operations.
            </p>
          </div>
          <span className="portal-panel__count">{filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'}</span>
        </div>

        <div className="portal-filter-bar">
          <div className="portal-filter-bar__search">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search tasks, relief operations, or locations..."
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
                {status} <span className="portal-filter-btn__count">({statusCounts[status] || 0})</span>
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
              {paging.pageItems.map((t) => {
                const taskStatus = getVolunteerTaskStatus(t)
                const isDist = isDistributionTask(t)
                const isOngoing = taskStatus === 'Ongoing'
                const isCompleted = taskStatus === 'Completed'

                let stateClass = ''
                if (isDist) stateClass = 'portal-task-item--distribution'
                else if (isCompleted) stateClass = 'portal-task-item--completed'
                else if (isOngoing) stateClass = 'portal-task-item--ongoing'

                return (
                  <li 
                    key={t.dbId || t.id} 
                    className={`portal-task-item portal-task-item--enhanced ${stateClass}`}
                    onClick={() => setSelectedTask(t)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="portal-task-item__main">
                      <div className="portal-task-item__header">
                        <div className="portal-task-item__title-group">
                          <strong className="portal-task-item__title">{t.title}</strong>
                        </div>
                        <div className="portal-task-item__badges">
                          <StatusBadge status={taskStatus} />
                          {isDist && t.distributionStatus && (
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
                        <span className="portal-task-item__category">{t.module || t.category || 'General Duty'}</span>
                      </div>
                      {isDist && (
                        <div className="portal-task-dist">
                          <MapPin size={15} style={{ flexShrink: 0 }} />
                          <span>
                            <strong>{t.distributionCode}</strong>
                            {t.distributionLabel ? ` · ${t.distributionLabel}` : ''}
                            {t.distributionLocation ? ` · ${t.distributionLocation}` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="portal-task-item__actions" onClick={(e) => e.stopPropagation()}>
                      {isDist && t.canMarkInTransit && (
                        <button
                          type="button"
                          className="btn btn--sm btn--outline"
                          disabled={saving}
                          onClick={() => handleDistributionStatus(t, 'In Transit')}
                        >
                          <Truck size={14} /> In Transit
                        </button>
                      )}
                      {isDist && t.canMarkDelivered && (
                        <button
                          type="button"
                          className="btn btn--sm btn--primary"
                          disabled={saving}
                          onClick={() => handleDistributionStatus(t, 'Delivered')}
                        >
                          <PackageCheck size={14} /> Delivered
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn--sm btn--outline"
                        onClick={() => setSelectedTask(t)}
                      >
                        <Eye size={14} /> View Details
                      </button>
                    </div>
                  </li>
                )
              })}
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
          <div className="volunteer-task-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="vtask-modal__header">
              <div className="vtask-modal__top-row">
                <div className="vtask-modal__badges">
                  <span className="vtask-code-pill">{selectedTask.id}</span>
                  <span className="vtask-program-pill">
                    <Layers size={12} />
                    {selectedTask.module || selectedTask.category || 'Volunteer'}
                  </span>
                  <span className={`portal-priority-badge portal-priority-badge--${String(selectedTask.priority || 'medium').toLowerCase()}`}>
                    {selectedTask.priority || 'Medium'}
                  </span>
                  <StatusBadge status={getVolunteerTaskStatus(selectedTask)} />
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTask(null)}
                  className="vtask-modal__close"
                  aria-label="Close modal"
                >
                  <X size={18} />
                </button>
              </div>
              <h3 className="vtask-modal__title">{selectedTask.title}</h3>
            </div>

            {/* Modal Body */}
            <div className="vtask-modal__body">
              {/* Progress / Status Timeline Indicator */}
              {isDistributionTask(selectedTask) ? (
                <div className="vtask-timeline">
                  <div className="vtask-timeline__line">
                    <div
                      className="vtask-timeline__line-fill"
                      style={{
                        width: selectedTask.isDone || selectedTask.distributionStatus === 'Completed'
                          ? '100%'
                          : selectedTask.distributionStatus === 'Delivered'
                            ? '66%'
                            : selectedTask.distributionStatus === 'In Transit'
                              ? '33%'
                              : '0%',
                      }}
                    />
                  </div>
                  <div className="vtask-timeline__step vtask-timeline__step--completed">
                    <div className="vtask-timeline__icon-circle">
                      <Check size={14} />
                    </div>
                    <span className="vtask-timeline__label">Assigned</span>
                  </div>
                  <div className={`vtask-timeline__step ${
                    selectedTask.distributionStatus === 'In Transit'
                      ? 'vtask-timeline__step--current'
                      : ['Delivered', 'Completed', 'Awaiting Proof'].includes(selectedTask.distributionStatus) || selectedTask.isDone
                        ? 'vtask-timeline__step--completed'
                        : 'vtask-timeline__step--pending'
                  }`}>
                    <div className="vtask-timeline__icon-circle">
                      <Truck size={13} />
                    </div>
                    <span className="vtask-timeline__label">In Transit</span>
                  </div>
                  <div className={`vtask-timeline__step ${
                    selectedTask.distributionStatus === 'Delivered'
                      ? 'vtask-timeline__step--current'
                      : ['Completed', 'Awaiting Proof'].includes(selectedTask.distributionStatus) || selectedTask.isDone
                        ? 'vtask-timeline__step--completed'
                        : 'vtask-timeline__step--pending'
                  }`}>
                    <div className="vtask-timeline__icon-circle">
                      <PackageCheck size={13} />
                    </div>
                    <span className="vtask-timeline__label">Delivered</span>
                  </div>
                  <div className={`vtask-timeline__step ${
                    selectedTask.isDone || selectedTask.distributionStatus === 'Completed'
                      ? 'vtask-timeline__step--completed'
                      : 'vtask-timeline__step--pending'
                  }`}>
                    <div className="vtask-timeline__icon-circle">
                      <ShieldCheck size={13} />
                    </div>
                    <span className="vtask-timeline__label">Verified</span>
                  </div>
                </div>
              ) : (
                <div className="vtask-timeline">
                  <div className="vtask-timeline__line">
                    <div
                      className="vtask-timeline__line-fill"
                      style={{
                        width: getVolunteerTaskStatus(selectedTask) === 'Completed' ? '100%' : '50%',
                      }}
                    />
                  </div>
                  <div className="vtask-timeline__step vtask-timeline__step--completed">
                    <div className="vtask-timeline__icon-circle">
                      <Check size={14} />
                    </div>
                    <span className="vtask-timeline__label">Task Assigned</span>
                  </div>
                  <div className={`vtask-timeline__step ${
                    getVolunteerTaskStatus(selectedTask) === 'Completed'
                      ? 'vtask-timeline__step--completed'
                      : 'vtask-timeline__step--current'
                  }`}>
                    <div className="vtask-timeline__icon-circle">
                      <Clock size={13} />
                    </div>
                    <span className="vtask-timeline__label">Duty Scheduled</span>
                  </div>
                  <div className={`vtask-timeline__step ${
                    getVolunteerTaskStatus(selectedTask) === 'Completed'
                      ? 'vtask-timeline__step--completed'
                      : 'vtask-timeline__step--pending'
                  }`}>
                    <div className="vtask-timeline__icon-circle">
                      <ShieldCheck size={13} />
                    </div>
                    <span className="vtask-timeline__label">Admin Verified</span>
                  </div>
                </div>
              )}

              {/* Metrics Grid */}
              <div className="vtask-metrics-grid">
                <div className="vtask-metric-card">
                  <span className="vtask-metric-card__label">
                    <CalendarDays size={13} /> Schedule & Due
                  </span>
                  <span className="vtask-metric-card__val">
                    {selectedTask.due || 'Open schedule'}
                  </span>
                  <span className="vtask-metric-card__sub">
                    {selectedTask.due ? 'Target completion date' : 'Flexible timing'}
                  </span>
                </div>

                <div className="vtask-metric-card">
                  <span className="vtask-metric-card__label">
                    <Tag size={13} /> Priority & Type
                  </span>
                  <span className="vtask-metric-card__val">
                    {selectedTask.priority || 'Medium'} Priority
                  </span>
                  <span className="vtask-metric-card__sub">
                    {isDistributionTask(selectedTask) ? 'Logistics / Relief' : (selectedTask.module || selectedTask.category || 'Volunteer Task')}
                  </span>
                </div>

                <div className="vtask-metric-card">
                  <span className="vtask-metric-card__label">
                    <Layers size={13} /> Program / Module
                  </span>
                  <span className="vtask-metric-card__val">
                    {selectedTask.module || selectedTask.category || 'General'}
                  </span>
                  <span className="vtask-metric-card__sub">
                    Assigned Foundation Program
                  </span>
                </div>
              </div>

              {/* Distribution & Destination Details (only for Distribution tasks) */}
              {isDistributionTask(selectedTask) && (
                <div className="vtask-delivery-card">
                  <div className="vtask-delivery-card__header">
                    <span className="vtask-delivery-card__title">
                      <Truck size={15} />
                      Delivery & Distribution Event
                    </span>
                    <StatusBadge status={selectedTask.distributionStatus || 'Planning'} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.2rem' }}>
                    <strong style={{ fontSize: '0.88rem', color: '#0f766e' }}>
                      {selectedTask.distributionCode || 'DST'} · {selectedTask.distributionLabel || 'Distribution Event'}
                    </strong>
                    {selectedTask.distributionLocation && (
                      <span style={{ fontSize: '0.82rem', color: '#134e4a', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <MapPin size={13} style={{ flexShrink: 0 }} /> {selectedTask.distributionLocation}
                      </span>
                    )}
                  </div>
                  <p className="vtask-delivery-card__desc" style={{ marginTop: '0.35rem', paddingTop: '0.45rem', borderTop: '1px solid #ccfbf1' }}>
                    Tap <strong>In Transit</strong> when leaving for delivery, and <strong>Delivered</strong> once handover to the Barangay is complete.
                  </p>
                </div>
              )}

              {/* Required Skills (if specified) */}
              {(selectedTask.requiredSkills || []).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    Required Skills & Focus
                  </label>
                  <div className="vtask-skills-list">
                    {(selectedTask.requiredSkills || []).map((sk) => (
                      <span key={sk} className="vtask-skill-chip">
                        <Check size={11} /> {sk}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Administrator Verification Callout Banner */}
              {getVolunteerTaskStatus(selectedTask) === 'Completed' ? (
                <div className="vtask-callout vtask-callout--completed">
                  <ShieldCheck size={18} />
                  <div>
                    <strong>Task Verified & Completed</strong>
                    <span>
                      {selectedTask.completedAtLabel
                        ? `Completed on ${selectedTask.completedAtLabel}. `
                        : ''}
                      This task has been verified and recorded to your volunteer profile.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="vtask-callout vtask-callout--ongoing">
                  <ShieldCheck size={18} />
                  <div>
                    <strong>Administrator Verification</strong>
                    <span>
                      After you fulfill this activity, an Administrator will review and verify task completion.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="vtask-modal__footer">
              {isDistributionTask(selectedTask) && selectedTask.canMarkInTransit && (
                <button
                  type="button"
                  className="btn btn--outline"
                  disabled={saving}
                  onClick={() => handleDistributionStatus(selectedTask, 'In Transit')}
                >
                  <Truck size={15} /> Mark In Transit
                </button>
              )}
              {isDistributionTask(selectedTask) && selectedTask.canMarkDelivered && (
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={saving}
                  onClick={() => handleDistributionStatus(selectedTask, 'Delivered')}
                >
                  <PackageCheck size={15} /> Mark Delivered
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
