import { useEffect, useMemo, useState } from 'react'
import { Clock3, ListTodo, Mail, UserCheck } from 'lucide-react'
import { volunteersApi, tasksApi, volunteerMatchApi } from '../../api/resources'
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

const filterConfig = {
  searchKeys: ['id', 'name', 'email'],
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
}

export default function VolunteersPage() {
  const { data: volunteers, loading, error, reload } = useApiList(() => volunteersApi.list())
  const filters = useFilters(volunteers, filterConfig)
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

  useEffect(() => {
    if (selected) {
      const fresh = volunteers.find((v) => v.dbId === selected.dbId)
      if (fresh) {
        setSelected(fresh)
        setHoursForm({ hours: fresh.hours || 0, requiredHours: fresh.requiredHours || 0 })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volunteers])

  const openVolunteer = (row) => {
    setSelected(row)
    setHoursForm({ hours: row.hours || 0, requiredHours: row.requiredHours || 0 })
    loadTasks(row)
  }

  const handleApprove = async (row) => {
    try {
      const res = await volunteersApi.update(row.dbId, { status: 'Approved' })
      if (res?.accountCreated || res?.credentialsSent) {
        if (res.credentialsSent) {
          alert('Volunteer approved. Login credentials were emailed via NodeMailer.')
        } else {
          alert([
            'Volunteer approved and account was created, but the credential email was NOT delivered.',
            res?.mailError ? `Reason: ${res.mailError}` : '',
            res?.temporaryPassword ? `Temporary password (share securely): ${res.temporaryPassword}` : '',
            'Ensure `npm run mail` is running and mail-service/.env has a valid Gmail App Password.',
          ].filter(Boolean).join('\n\n'))
        }
      } else if (res?.mailError) {
        alert(`Volunteer approved, but account provisioning note: ${res.mailError}`)
      } else {
        alert('Volunteer approved.')
      }
      reload()
    } catch (err) {
      alert(err.message || 'Failed to approve volunteer')
    }
  }

  const handleSaveHours = async (e) => {
    e.preventDefault()
    if (!selected) return
    setSaving(true)
    try {
      await volunteersApi.update(selected.dbId, {
        hours: Number(hoursForm.hours) || 0,
        requiredHours: Number(hoursForm.requiredHours) || 0,
      })
      reload()
    } catch (err) {
      alert(err.message)
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
      await tasksApi.create({
        title: taskForm.title,
        priority: taskForm.priority,
        dueDate: taskForm.dueDate || null,
        dutyStart: taskForm.dutyStart || null,
        dutyEnd: taskForm.dutyEnd || null,
        dutyHours: taskForm.dutyHours !== '' ? Number(taskForm.dutyHours) : null,
        module: taskForm.module || 'Volunteer',
        requiredSkills: taskForm.requiredSkills || [],
        volunteerId,
        boardColumn: 'todo',
      })
      setShowTaskForm(false)
      setTaskForm(emptyTaskForm)
      setSuggestions([])
      if (selected) loadTasks(selected)
      reload()
      if (assigneeVolunteerId && selected && assigneeVolunteerId !== selected.dbId) {
        alert('Task assigned to the selected suggested volunteer.')
      }
    } catch (err) {
      alert(err.message)
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
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'hours',
      label: 'Hours',
      render: (row) => `${row.hours || 0} / ${row.requiredHours || 0}`,
    },
    { key: 'assignedTasks', label: 'Tasks' },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions">
          <button type="button" className="btn btn--sm btn--outline" onClick={(e) => { e.stopPropagation(); openVolunteer(row) }}>
            Manage
          </button>
          {row.status === 'Pending Review' && (
            <button type="button" className="btn btn--sm btn--primary" onClick={(e) => { e.stopPropagation(); handleApprove(row) }}>
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
        description="Review volunteers, track required vs rendered hours, and assign tasks in one place."
      />
      <FilterBar
        controller={filters}
        searchPlaceholder="Search by ID, name, or email..."
        exportConfig={{ filename: 'volunteer-report', title: 'Volunteer Report', columns, rows: filters.filtered }}
      />
      <ApiState loading={loading} error={error} onRetry={reload}>
        <DataTable columns={columns} data={filters.filtered} onRowClick={openVolunteer} initialVisible={5} />
      </ApiState>

      {selected && (
        <div className="admin-modal-overlay" onClick={() => setSelected(null)}>
          <div className="admin-modal admin-modal--wide volunteer-manage-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title={selected.name}
              subtitle={`${selected.id} · ${selected.email || 'No email'}`}
              onClose={() => setSelected(null)}
            />

            <div className="volunteer-hours-summary">
              <div className="volunteer-hours-card">
                <Clock3 size={16} />
                <div>
                  <strong>{hoursForm.hours || 0}</strong>
                  <span>Rendered Hours</span>
                </div>
              </div>
              <div className="volunteer-hours-card">
                <ListTodo size={16} />
                <div>
                  <strong>{hoursForm.requiredHours || 0}</strong>
                  <span>Required Hours</span>
                </div>
              </div>
              <div className="volunteer-hours-card volunteer-hours-card--accent">
                <UserCheck size={16} />
                <div>
                  <strong>{remaining}</strong>
                  <span>Remaining Hours</span>
                </div>
              </div>
            </div>

            <section className="volunteer-panel-section">
              <h3>Volunteer Information</h3>
              <dl className="detail-list">
                <dt>Status</dt><dd><StatusBadge status={selected.status} /></dd>
                <dt>Email</dt>
                <dd>
                  <span className="volunteer-inline-meta"><Mail size={13} /> {selected.email || '—'}</span>
                </dd>
                <dt>Programs</dt><dd>{(selected.programs || []).join(', ') || '—'}</dd>
                <dt>Skills</dt>
                <dd>
                  {(selected.skills || []).join(', ') || '—'}
                  {selected.skillsOther ? ` · Other: ${selected.skillsOther}` : ''}
                </dd>
                <dt>Availability</dt><dd>{selected.availability || '—'}</dd>
                <dt>Assigned Tasks</dt><dd>{selected.assignedTasks || tasks.length}</dd>
              </dl>

              <form className="volunteer-hours-form" onSubmit={handleSaveHours}>
                <label>
                  Rendered Hours
                  <input
                    type="number"
                    min="0"
                    value={hoursForm.hours}
                    onChange={(e) => setHoursForm({ ...hoursForm, hours: e.target.value })}
                  />
                </label>
                <label>
                  Required Hours
                  <input
                    type="number"
                    min="0"
                    value={hoursForm.requiredHours}
                    onChange={(e) => setHoursForm({ ...hoursForm, requiredHours: e.target.value })}
                  />
                </label>
                <button type="submit" className="btn btn--sm btn--primary" disabled={saving}>
                  Save Hours
                </button>
              </form>
            </section>

            <section className="volunteer-panel-section">
              <div className="volunteer-panel-section__head">
                <h3>Assigned Tasks</h3>
                <button type="button" className="btn btn--sm btn--primary" onClick={openAssignTask}>
                  + Assign Task
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

            <div className="admin-modal__actions">
              {selected.status === 'Pending Review' && (
                <button type="button" className="btn btn--primary" onClick={() => handleApprove(selected)}>Approve Volunteer</button>
              )}
              <button type="button" className="btn btn--ghost" onClick={() => setSelected(null)}>Close</button>
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
