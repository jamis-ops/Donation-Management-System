import { Clock } from 'lucide-react'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import { tasksApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'

export default function VolunteerTasksPage() {
  const { data, loading, error, reload } = useApiList(() =>
    tasksApi.list().then((r) => ({
      data: Array.isArray(r.data) ? r.data : (r.list || []),
    }))
  )

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      <section className="portal-panel">
        <div className="portal-panel__header"><h2>My Tasks</h2></div>
        <ul className="portal-task-list">
          {data.length === 0 && (
            <li className="portal-task-item"><div><span>No tasks assigned yet.</span></div></li>
          )}
          {data.map((t) => (
            <li key={t.id} className="portal-task-item">
              <div>
                <strong>{t.title}</strong>
                <span>Due: {t.due} · {t.module}</span>
                {t.dutyLabel && (
                  <span className="portal-task-duty">
                    <Clock size={13} /> Duty hours: {t.dutyLabel}
                  </span>
                )}
              </div>
              <StatusBadge status={t.priority} />
            </li>
          ))}
        </ul>
      </section>
    </ApiState>
  )
}
