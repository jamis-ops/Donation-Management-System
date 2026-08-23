import { useState } from 'react'
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
} from 'lucide-react'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import { tasksApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { usePagination, DEFAULT_PAGE_SIZE } from '../../hooks/usePagination'
import Pagination from '../../components/admin/shared/Pagination'
import { notify } from '../../utils/toast'
import { confirmAction, showSuccessModal } from '../../utils/confirm'
import { useLoading } from '../../context/LoadingContext'

const STATUS_FILTERS = ['All', 'Ongoing', 'Completed']

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

export default function VolunteerTasksPage() {
  const { data, loading, error, reload } = useApiList(() =>
    tasksApi.list().then((r) => ({
      data: Array.isArray(r.data) ? r.data : (r.list || []),
    }))
  )

  const [statusFilter, setStatusFilter] = useState('All')
  const { showLoading, hideLoading } = useLoading()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTask, setSelectedTask] = useState(null)
  const [saving, setSaving] = useState(false)

  const filteredTasks = data.filter((task) => {
    const vStatus = getVolunteerTaskStatus(task)
    const matchesStatus = statusFilter === 'All' || vStatus === statusFilter
    const q = searchQuery.toLowerCase()
    const isDist = isDistributionTask(task)
    const matchesSearch =
      !q ||
      task.title?.toLowerCase().includes(q) ||
      task.module?.toLowerCase().includes(q) ||
      task.category?.toLowerCase().includes(q) ||
      (isDist && (
        task.distributionCode?.toLowerCase().includes(q) ||
        task.distributionLabel?.toLowerCase().includes(q)
      ))
    return matchesStatus && matchesSearch
  })

  const paging = usePagination(filteredTasks, DEFAULT_PAGE_SIZE, `${searchQuery}|${statusFilter}`)

  const statusCounts = {
    All: data.length,
    Ongoing: data.filter((t) => getVolunteerTaskStatus(t) === 'Ongoing').length,
    Completed: data.filter((t) => getVolunteerTaskStatus(t) === 'Completed').length,
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
      notify.success(`Status successfully updated to: ${label}.`)
      showSuccessModal('Successfully updated.')
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

                return (
                  <li key={t.dbId || t.id} className={`portal-task-item portal-task-item--enhanced${isDist ? ' portal-task-item--distribution' : ''}`}>
                    <div className="portal-task-item__main">
                      <div className="portal-task-item__header">
                        <strong>{t.title}</strong>
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
                        <span className="portal-task-item__category">{t.module || t.category || 'General'}</span>
                        {(t.dutyHours || t.hours) && (
                          <span className="portal-task-item__hours">{t.dutyHours || t.hours}h estimated</span>
                        )}
                        {t.dutyLabel && <span>{t.dutyLabel}</span>}
                      </div>
                      {isDist && (
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
                        <Eye size={14} /> Details
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
                    <Clock size={13} /> Duty Hours
                  </span>
                  <span className="vtask-metric-card__val">
                    {selectedTask.dutyHours || selectedTask.hours ? `${selectedTask.dutyHours || selectedTask.hours} hrs` : '—'}
                  </span>
                  <span className="vtask-metric-card__sub">
                    {selectedTask.dutyLabel || 'Credited upon completion'}
                  </span>
                </div>

                <div className="vtask-metric-card">
                  <span className="vtask-metric-card__label">
                    <CalendarDays size={13} /> Schedule & Due
                  </span>
                  <span className="vtask-metric-card__val">
                    {selectedTask.due || 'Open schedule'}
                  </span>
                  <span className="vtask-metric-card__sub">
                    {selectedTask.dutyStart && selectedTask.dutyEnd
                      ? `${selectedTask.dutyStart} – ${selectedTask.dutyEnd}`
                      : 'Duty window'}
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
                      Duty hours ({selectedTask.dutyHours || selectedTask.hours || 0} hrs) have been verified and recorded to your volunteer profile.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="vtask-callout vtask-callout--ongoing">
                  <ShieldCheck size={18} />
                  <div>
                    <strong>Administrator Duty Verification</strong>
                    <span>
                      After you fulfill this activity, an Administrator will review and verify task completion to automatically credit your {selectedTask.dutyHours || selectedTask.hours ? `${selectedTask.dutyHours || selectedTask.hours} ` : ''}duty hours.
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
                  <Truck size={15} /> {saving ? 'Saving…' : 'Mark In Transit'}
                </button>
              )}
              {isDistributionTask(selectedTask) && selectedTask.canMarkDelivered && (
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={saving}
                  onClick={() => handleDistributionStatus(selectedTask, 'Delivered')}
                >
                  <PackageCheck size={15} /> {saving ? 'Saving…' : 'Mark Delivered'}
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
