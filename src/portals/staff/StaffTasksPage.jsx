import ApiState from '../../components/admin/shared/ApiState'
import { tasksApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'

export default function StaffTasksPage() {
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
          {data.map((t) => (
            <li key={t.id} className="portal-task-item">
              <div><strong>{t.title}</strong><span>{t.module} · Due {t.due}</span></div>
              <span>{t.priority}</span>
            </li>
          ))}
        </ul>
      </section>
    </ApiState>
  )
}
