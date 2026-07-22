import { CheckCircle2 } from 'lucide-react'
import ApiState from '../../components/admin/shared/ApiState'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import { tasksApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'

export default function StaffTasksPage() {
  const { data, loading, error, reload } = useApiList(() =>
    tasksApi.list().then((r) => ({
      data: Array.isArray(r.data) ? r.data : (r.list || []),
    }))
  )

  const markDone = async (task) => {
    if (!window.confirm(`Mark "${task.title}" as Done?`)) return
    try {
      await tasksApi.update(task.dbId, { boardColumn: 'done' })
      reload()
    } catch (err) {
      alert(err.message)
    }
  }

  const open = data.filter((t) => !t.isDone && t.boardColumn !== 'done')
  const done = data.filter((t) => t.isDone || t.boardColumn === 'done')

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      <section className="portal-panel">
        <div className="portal-panel__header">
          <h2>My Tasks</h2>
          <span className="portal-panel__hint">{open.length} open · {done.length} done</span>
        </div>

        {data.length === 0 ? (
          <p className="portal-empty">No tasks assigned to you yet.</p>
        ) : (
          <ul className="staff-task-list">
            {data.map((t) => {
              const isDone = t.isDone || t.boardColumn === 'done'
              return (
                <li key={t.dbId || t.id} className={`staff-task-card${isDone ? ' staff-task-card--done' : ''}`}>
                  <div className="staff-task-card__main">
                    <div className="staff-task-card__title-row">
                      <strong>{t.title}</strong>
                      <StatusBadge status={t.status || t.boardColumn} />
                    </div>
                    <div className="staff-task-card__meta">
                      <span>{t.module || 'General'}</span>
                      <span>Priority: {t.priority}</span>
                      <span>Due: {t.due || '—'}</span>
                      {t.dutyLabel ? <span>{t.dutyLabel}</span> : null}
                      {t.completedAtLabel ? <span>Completed: {t.completedAtLabel}</span> : null}
                    </div>
                  </div>
                  {!isDone && (
                    <button type="button" className="btn btn--sm btn--primary" onClick={() => markDone(t)}>
                      <CheckCircle2 size={14} /> Mark Done
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </ApiState>
  )
}
