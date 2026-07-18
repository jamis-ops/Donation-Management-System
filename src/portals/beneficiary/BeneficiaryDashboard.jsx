import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import { getPortalData } from '../../api/resources'
import { useApiObject } from '../../hooks/useApiList'

export default function BeneficiaryDashboard() {
  const { data, loading, error, reload } = useApiObject(() => getPortalData())

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      {data && (
        <>
          <div className="portal-stats">
            {data.stats.map((item) => (
              <div key={item.label} className="portal-stat-card">
                <span className="portal-stat-card__value">{item.value}</span>
                <span className="portal-stat-card__label">{item.label}</span>
              </div>
            ))}
          </div>
          <section className="portal-panel">
            <div className="portal-panel__header"><h2>Recent Requests</h2></div>
            <ul className="portal-task-list">
              {data.requests.map((r) => (
                <li key={r.id} className="portal-task-item">
                  <div><strong>{r.type}</strong><span>{r.id} · {r.date}</span></div>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </ApiState>
  )
}
