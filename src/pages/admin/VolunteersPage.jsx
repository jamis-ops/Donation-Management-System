import { useEffect, useMemo, useState } from 'react'
import {
  Clock3, ListTodo, Mail, UserCheck, Pencil, Trash2,
  CheckCircle2, XCircle, CalendarDays, Briefcase,
} from 'lucide-react'
import { volunteersApi, tasksApi, volunteerMatchApi, distributionsApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { useFilters } from '../../hooks/useFilters'
import PageHeader from '../../components/admin/shared/PageHeader'
import DataTable from '../../components/admin/shared/DataTable'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import FilterBar from '../../components/admin/shared/FilterBar'
import ModalHeader from '../../components/admin/shared/ModalHeader'
import Req from '../../components/shared/Req'
import SkillTagPicker from '../../components/shared/SkillTagPicker'
import { useSeeMore } from '../../hooks/useSeeMore'
import { SeeMoreToggle } from '../../components/admin/shared/SeeMoreList'
import { notify } from '../../utils/toast'
import { useCatalogOptions } from '../../hooks/useCatalogOptions'
import { CatalogFieldLabel } from '../../components/admin/shared/CatalogQuickAdd'
import { TASK_TYPES as FALLBACK_TASK_TYPES } from '../../constants/options'

const VOLUNTEER_TASK_FALLBACK = ['Volunteer', ...FALLBACK_TASK_TYPES]

const filterConfig = {
  searchKeys: ['id', 'name', 'email', 'skills', 'programs'],
  filters: [
    { key: 'status', label: 'Status' },
    {
      key: 'program',
      label: 'Program',
      deriveOptions: (data) =>
        Array.from(new Set(data.flatMap((v) => v.programs || []))).sort(),
      match: (row, val) => (row.programs || []).includes(val),
    },
  ],
}

const emptyTaskForm = {
  title: '',
  priority: 'Medium',
  dueDate: '',
  dutyStart: '',
  dutyEnd: '',
  dutyHours: '',
  module: 'Volunteer',
  requiredSkills: [],
  distributionId: '',
}

const ACTIVE_DIST_STATUSES = ['Planning', 'Preparing', 'In Transit', 'Scheduled', 'In Progress', 'Pending']

function ChipList({ items, empty = '—' }) {
  const list = (items || []).filter(Boolean)
  if (!list.length) return <span className="volunteer-muted">{empty}</span>
  return (
    <ul className="volunteer-chip-list">
      {list.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

export default function VolunteersPage() {
  const { data: volunteers, loading, error, reload } = useApiList(() => volunteersApi.list())
  const { data: distributions } = useApiList(() => distributionsApi.list())
  const filters = useFilters(volunteers, filterConfig)
  const { options: taskTypeOptions, applyList: applyTaskTypes } = useCatalogOptions(
    'task_types',
    VOLUNTEER_TASK_FALLBACK,
  )
  const [selected, setSelected] = useState(null)
  const [tasks, setTasks] = useState([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const tasksSeeMore = useSeeMore(tasks, 3)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [taskForm, setTaskForm] = useState(emptyTaskForm)
  const [saving, setSaving] = useState(false)
  const [hoursForm, setHoursForm] = useState({ hours: 0, requiredHours: 0 })
  const [suggestions, setSuggestions] = useState([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)

  const linkableDistributions = useMemo(
    () => (distributions || []).filter((d) => ACTIVE_DIST_STATUSES.includes(d.status)),
    [distributions],
  )

  const pendingCount = useMemo(
    () => (volunteers || []).filter((v) => v.status === 'Pending Review').length,
    [volunteers],
  )
  const activeCount = useMemo(
    () => (volunteers || []).filter((v) => ['Approved', 'Active', 'Assigned'].includes(v.status)).length,
    [volunteers],
  )

  const loadTasks = async (volunteer) => {
    if (!volunteer) {
      setTasks([])
      return
    }
    setTasksLoading(true)
    try {
      const res = await tasksApi.list(`?volunteerId=${volunteer.dbId}`)
      setTasks(Array.isArray(res.data) ? res.data : (res.list || []))
    } catch {
      setTasks([])
    } finally {
      setTasksLoading(false)
    }
  }

  // Keep selected row fresh after reloads, without wiping in-progress hour edits.
  useEffect(() => {
    if (!selected?.dbId) return
    const fresh = (volunteers || []).find((v) => Number(v.dbId) === Number(selected.dbId))
    if (!fresh) {
      setSelected(null)
      return
    }
    setSelected((prev) => {
      if (!prev || Number(prev.dbId) !== Number(fresh.dbId)) return prev
      return fresh
    })
  }, [volunteers]) // eslint-disable-line react-hooks/exhaustive-deps -- only sync when list reloads

  const openVolunteer = (row) => {
    setSelected(row)
    setHoursForm({ hours: row.hours || 0, requiredHours: row.requiredHours || 0 })
    loadTasks(row)
  }

  const closeVolunteer = () => {
    setSelected(null)
    setShowTaskForm(false)
    setSuggestions([])
  }

  const handleApprove = async (row) => {
    try {
      const res = await volunteersApi.update(row.dbId, { status: 'Approved' })
      if (res?.accountCreated || res?.credentialsSent) {
        if (res.credentialsSent) {
          notify.success('Volunteer approved. Login credentials were emailed.')
        } else {
          notify.warning(
            [
              'Volunteer approved and account was created.',
              res?.temporaryPassword ? `Temporary password (share securely): ${res.temporaryPassword}` : '',
              res?.mailError ? `Email note: ${res.mailError}` : 'Credential email was not delivered.',
              'Tip: run `npm run mail` with a valid Gmail App Password for automatic emails.',
            ].filter(Boolean).join('. '),
          )
        }
      } else if (res?.mailError) {
        notify.success('Volunteer approved.')
        notify.warning(`Note: ${res.mailError}`)
      } else {
        notify.success('Volunteer approved.')
      }
      reload()
    } catch (err) {
      notify.error(err.message || 'Failed to approve volunteer')
    }
  }

  const handleReject = async (row) => {
    if (!window.confirm(`Reject volunteer application for "${row.name}"?`)) return
    try {
      await volunteersApi.update(row.dbId, { status: 'Rejected' })
      notify.success('Volunteer rejected.')
      reload()
      if (selected?.dbId === row.dbId) closeVolunteer()
    } catch (err) {
      notify.error(err.message || 'Failed to reject volunteer')
    }
  }

  const handleDelete = async (row) => {
    if (!window.confirm(`Permanently delete volunteer "${row.name}"? This cannot be undone.`)) return
    try {
      await volunteersApi.remove(row.dbId)
      notify.success('Volunteer deleted.')
      reload()
      if (selected?.dbId === row.dbId) closeVolunteer()
    } catch (err) {
      notify.error(err.message || 'Failed to delete volunteer')
    }
  }

  const handleSaveHours = async (e) => {
    e.preventDefault()
    if (!selected) return
    setSaving(true)
    try {
      const res = await volunteersApi.update(selected.dbId, {
        hours: Number(hoursForm.hours) || 0,
        requiredHours: Number(hoursForm.requiredHours) || 0,
      })
      const data = res?.data
      if (data) {
        setHoursForm({ hours: data.hours || 0, requiredHours: data.requiredHours || 0 })
        setSelected(data)
      }
      reload()
      notify.success('Hours updated.')
    } catch (err) {
      notify.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const loadSuggestions = async (skills, volunteer) => {
    if (!skills?.length) {
      setSuggestions([])
      return
    }
    setSuggestionsLoading(true)
    try {
      const res = await volunteerMatchApi.suggest({
        skills,
        programs: volunteer?.programs || [],
        availability: volunteer?.availability || '',
        limit: 5,
      })
      setSuggestions(Array.isArray(res.data) ? res.data : [])
    } catch {
      setSuggestions([])
    } finally {
      setSuggestionsLoading(false)
    }
  }

  const openAssignTask = () => {
    setTaskForm(emptyTaskForm)
    setSuggestions([])
    setShowTaskForm(true)
  }

  const handleCreateTask = async (e, assigneeVolunteerId = null) => {
    if (e?.preventDefault) e.preventDefault()
    if (!selected && !assigneeVolunteerId) return
    const volunteerId = assigneeVolunteerId || selected.dbId
    setSaving(true)
    try {
      const distId = taskForm.distributionId ? Number(taskForm.distributionId) : null
      const module = distId
        ? (taskForm.module && !['Volunteer'].includes(taskForm.module) ? taskForm.module : 'Distribution')
        : (taskForm.module || 'Volunteer')
      await tasksApi.create({
        title: taskForm.title,
        priority: taskForm.priority,
        dueDate: taskForm.dueDate || null,
        dutyStart: taskForm.dutyStart || null,
        dutyEnd: taskForm.dutyEnd || null,
        dutyHours: taskForm.dutyHours !== '' ? Number(taskForm.dutyHours) : null,
        module,
        requiredSkills: taskForm.requiredSkills || [],
        volunteerId,
        distributionId: distId || undefined,
        boardColumn: 'todo',
      })
      setShowTaskForm(false)
      setTaskForm(emptyTaskForm)
      setSuggestions([])
      if (selected) loadTasks(selected)
      reload()
      if (assigneeVolunteerId && selected && assigneeVolunteerId !== selected.dbId) {
        notify.success('Task assigned to the selected suggested volunteer.')
      } else {
        notify.success('Task assigned successfully.')
      }
    } catch (err) {
      notify.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const remaining = useMemo(() => {
    if (!selected) return 0
    return Math.max(0, (Number(hoursForm.requiredHours) || 0) - (Number(hoursForm.hours) || 0))
  }, [selected, hoursForm])

  const columns = [
    { key: 'id', label: 'ID' },
    {
      key: 'name',
      label: 'Volunteer',
      render: (row) => (
        <div className="volunteer-cell-primary">
          <strong>{row.name}</strong>
          <span>{row.email || 'No email'}</span>
        </div>
      ),
    },
    {
      key: 'programs',
      label: 'Programs',
      render: (row) => (
        <span className="volunteer-table-clip">
          {(row.programs || []).slice(0, 2).join(', ') || '—'}
          {(row.programs || []).length > 2 ? ` +${row.programs.length - 2}` : ''}
        </span>
      ),
    },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'hours',
      label: 'Hours',
      render: (row) => `${row.hours || 0} / ${row.requiredHours || 0}`,
    },
    {
      key: 'assignedTasks',
      label: 'Tasks',
      render: (row) => (
        <span title={`${row.openTasks || 0} open`}>
          {row.assignedTasks || 0}
          {row.openTasks ? <small className="volunteer-open-tasks"> · {row.openTasks} open</small> : null}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions">
          <button
            type="button"
            className="btn btn--sm btn--outline"
            onClick={(e) => { e.stopPropagation(); openVolunteer(row) }}
          >
            <Pencil size={13} /> Manage
          </button>
          {row.status === 'Pending Review' && (
            <button
              type="button"
              className="btn btn--sm btn--primary"
              onClick={(e) => { e.stopPropagation(); handleApprove(row) }}
            >
              Approve
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Volunteer Management"
        description="Review applications, track required vs rendered hours, and assign duty tasks."
      />

      <div className="volunteer-stats">
        <div className="volunteer-stat">
          <strong>{(volunteers || []).length}</strong>
          <span>Total volunteers</span>
        </div>
        <div className="volunteer-stat">
          <strong>{pendingCount}</strong>
          <span>Pending review</span>
        </div>
        <div className="volunteer-stat">
          <strong>{activeCount}</strong>
          <span>Approved / active</span>
        </div>
      </div>

      <FilterBar
        controller={filters}
        searchPlaceholder="Search by ID, name, email, skill, or program..."
        exportConfig={{ filename: 'volunteer-report', title: 'Volunteer Report', columns, rows: filters.filtered }}
      />
      <ApiState loading={loading} error={error} onRetry={reload}>
        <DataTable
          columns={columns}
          data={filters.filtered}
          onRowClick={openVolunteer}
          pageSize={10}
          resetKey={`${filters.search}|${JSON.stringify(filters.values)}`}
        />
      </ApiState>

      {selected && (
        <div className="admin-modal-overlay" onClick={closeVolunteer}>
          <div className="admin-modal admin-modal--xl volunteer-manage-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title={selected.name}
              subtitle={`${selected.id} · ${selected.email || 'No email'}`}
              onClose={closeVolunteer}
            />

            <div className="volunteer-detail">
              <header className="volunteer-detail__hero">
                <div className="volunteer-detail__hero-main">
                  <div className="volunteer-detail__meta">
                    <span><Mail size={14} aria-hidden /> {selected.email || '—'}</span>
                    <span><Briefcase size={14} aria-hidden /> {(selected.programs || []).length || 0} programs</span>
                    <span><ListTodo size={14} aria-hidden /> {selected.assignedTasks || tasks.length} tasks</span>
                    {selected.availability ? (
                      <span><CalendarDays size={14} aria-hidden /> {selected.availability}</span>
                    ) : null}
                  </div>
                </div>
                <div className="volunteer-detail__hero-aside">
                  <StatusBadge status={selected.status} />
                  {selected.userId ? <span className="volunteer-detail__pill">Portal linked</span> : null}
                </div>
              </header>

              <div className="volunteer-hours-summary">
                <div className="volunteer-hours-card">
                  <Clock3 size={16} aria-hidden />
                  <div>
                    <strong>{hoursForm.hours || 0}</strong>
                    <span>Rendered hours</span>
                  </div>
                </div>
                <div className="volunteer-hours-card">
                  <ListTodo size={16} aria-hidden />
                  <div>
                    <strong>{hoursForm.requiredHours || 0}</strong>
                    <span>Required hours</span>
                  </div>
                </div>
                <div className="volunteer-hours-card volunteer-hours-card--accent">
                  <UserCheck size={16} aria-hidden />
                  <div>
                    <strong>{remaining}</strong>
                    <span>Remaining hours</span>
                  </div>
                </div>
              </div>

              <div className="volunteer-detail__grid">
                <section className="volunteer-detail__card">
                  <h4>Profile</h4>
                  <dl className="volunteer-detail__list">
                    <div>
                      <dt>Programs</dt>
                      <dd><ChipList items={selected.programs} empty="No programs listed" /></dd>
                    </div>
                    <div>
                      <dt>Skills</dt>
                      <dd>
                        <ChipList items={selected.skills} empty="No skills listed" />
                        {selected.skillsOther ? (
                          <p className="volunteer-detail__note">Other: {selected.skillsOther}</p>
                        ) : null}
                      </dd>
                    </div>
                    <div>
                      <dt>Availability</dt>
                      <dd>{selected.availability || '—'}</dd>
                    </div>
                  </dl>
                </section>

                <section className="volunteer-detail__card">
                  <h4>Hours tracking</h4>
                  <form className="volunteer-hours-form" onSubmit={handleSaveHours}>
                    <label>
                      Rendered hours
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        value={hoursForm.hours}
                        onChange={(e) => setHoursForm({ ...hoursForm, hours: e.target.value })}
                      />
                    </label>
                    <label>
                      Required hours
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        value={hoursForm.requiredHours}
                        onChange={(e) => setHoursForm({ ...hoursForm, requiredHours: e.target.value })}
                      />
                    </label>
                    <button type="submit" className="btn btn--sm btn--primary" disabled={saving}>
                      {saving ? 'Saving…' : 'Save hours'}
                    </button>
                  </form>
                </section>

                <section className="volunteer-detail__card volunteer-detail__card--wide">
                  <div className="volunteer-panel-section__head">
                    <h4>Assigned tasks</h4>
                    <button type="button" className="btn btn--sm btn--primary" onClick={openAssignTask}>
                      + Assign task
                    </button>
                  </div>
                  {tasksLoading ? (
                    <p className="beneficiary-view-empty">Loading tasks…</p>
                  ) : tasks.length === 0 ? (
                    <p className="beneficiary-view-empty">No tasks assigned to this volunteer yet.</p>
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
                              {t.dutyLabel ? <span>Duty: {t.dutyLabel}</span> : null}
                              {t.distributionCode ? (
                                <span>
                                  Distribution: {t.distributionCode}
                                  {t.distributionStatus ? ` · ${t.distributionStatus}` : ''}
                                </span>
                              ) : null}
                              {(t.requiredSkills || []).length ? (
                                <span>Skills: {(t.requiredSkills || []).join(', ')}</span>
                              ) : null}
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
                </section>
              </div>
            </div>

            <div className="admin-modal__actions">
              {selected.status === 'Pending Review' && (
                <>
                  <button type="button" className="btn btn--primary" onClick={() => handleApprove(selected)}>
                    <CheckCircle2 size={15} /> Approve
                  </button>
                  <button type="button" className="btn btn--outline" onClick={() => handleReject(selected)}>
                    <XCircle size={15} /> Reject
                  </button>
                </>
              )}
              <button type="button" className="btn btn--outline" onClick={() => handleDelete(selected)}>
                <Trash2 size={15} /> Delete
              </button>
              <button type="button" className="btn btn--ghost" onClick={closeVolunteer}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showTaskForm && selected && (
        <div className="admin-modal-overlay" onClick={() => setShowTaskForm(false)}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title={`Assign Task — ${selected.name}`} onClose={() => setShowTaskForm(false)} />
            <form onSubmit={(e) => handleCreateTask(e)}>
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
              <div className="form-row">
                <label>
                  Duty Start
                  <input type="time" value={taskForm.dutyStart} onChange={(e) => setTaskForm({ ...taskForm, dutyStart: e.target.value })} />
                </label>
                <label>
                  Duty End
                  <input type="time" value={taskForm.dutyEnd} onChange={(e) => setTaskForm({ ...taskForm, dutyEnd: e.target.value })} />
                </label>
              </div>
              <label>
                <Req required>Duty Hours</Req>
                <input
                  type="number"
                  min="0.25"
                  step="0.25"
                  required
                  value={taskForm.dutyHours}
                  onChange={(e) => setTaskForm({ ...taskForm, dutyHours: e.target.value })}
                />
              </label>

              <label>
                <CatalogFieldLabel catalog="task_types" onUpdated={applyTaskTypes}>
                  Task Type
                </CatalogFieldLabel>
                <select
                  value={taskForm.module}
                  onChange={(e) => setTaskForm({ ...taskForm, module: e.target.value })}
                >
                  {taskTypeOptions.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  {taskForm.module && !taskTypeOptions.includes(taskForm.module) && (
                    <option value={taskForm.module}>{taskForm.module}</option>
                  )}
                </select>
              </label>

              <label>
                Link to Distribution <span className="field-hint-inline">(for delivery status updates)</span>
                <select
                  value={taskForm.distributionId}
                  onChange={(e) => {
                    const distributionId = e.target.value
                    const dist = linkableDistributions.find((d) => String(d.dbId) === distributionId)
                    setTaskForm((prev) => ({
                      ...prev,
                      distributionId,
                      module: distributionId
                        ? (prev.module === 'Volunteer' || !prev.module ? 'Distribution' : prev.module)
                        : prev.module,
                      title: prev.title || (dist
                        ? `Delivery — ${dist.id || dist.eventName || dist.location || 'Distribution'}`
                        : prev.title),
                    }))
                  }}
                >
                  <option value="">No distribution link</option>
                  {linkableDistributions.map((d) => (
                    <option key={d.dbId} value={d.dbId}>
                      {d.id} · {d.status} · {d.eventName || d.location || 'Distribution'}
                    </option>
                  ))}
                </select>
              </label>
              {taskForm.distributionId ? (
                <p className="field-hint">
                  Volunteer can mark this distribution <strong>In Transit</strong> then <strong>Delivered</strong>. Status syncs to Admin, Staff, and Barangay.
                </p>
              ) : null}

              <SkillTagPicker
                label="Required skills for this task"
                value={taskForm.requiredSkills}
                showOther={false}
                onChange={(requiredSkills) => {
                  setTaskForm({ ...taskForm, requiredSkills })
                  loadSuggestions(requiredSkills, selected)
                }}
              />

              <section className="suggested-volunteers">
                <div className="suggested-volunteers__head">
                  <h4>Suggested volunteers</h4>
                  <span>Ranked by skill match · programs · availability · lighter workload</span>
                </div>
                {!taskForm.requiredSkills.length ? (
                  <p className="beneficiary-view-empty">Select required skills to see top matches.</p>
                ) : suggestionsLoading ? (
                  <p className="beneficiary-view-empty">Finding matches…</p>
                ) : suggestions.length === 0 ? (
                  <p className="beneficiary-view-empty">No active volunteers matched these skills yet.</p>
                ) : (
                  <ul className="suggested-volunteers__list">
                    {suggestions.map((s) => (
                      <li key={s.dbId} className={`suggested-volunteers__item${s.dbId === selected.dbId ? ' suggested-volunteers__item--current' : ''}`}>
                        <div>
                          <strong>{s.name}</strong>
                          {s.dbId === selected.dbId ? <span className="suggested-volunteers__badge">Current</span> : null}
                          <p>{s.whyMatched}</p>
                        </div>
                        <button
                          type="button"
                          className="btn btn--sm btn--outline"
                          disabled={saving || !taskForm.title || !taskForm.dutyHours}
                          onClick={() => handleCreateTask(null, s.dbId)}
                        >
                          Assign
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="suggested-volunteers__hint">
                  Suggestions help you choose — you still confirm Assign. Default button below assigns to <strong>{selected.name}</strong>.
                </p>
              </section>

              <div className="admin-modal__actions">
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'Saving…' : `Assign to ${selected.name}`}
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setShowTaskForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
