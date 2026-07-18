import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import { assistanceRequestsApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'

export default function BeneficiaryRequestsPage() {
  const { data, loading, error, reload } = useApiList(() => assistanceRequestsApi.list())

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      <section className="portal-panel">
        <div className="portal-panel__header"><h2>Assistance Requests</h2></div>
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead><tr><th>Reference</th><th>Type</th><th>Date</th><th>Priority</th><th>Status</th></tr></thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td><td>{r.type}</td><td>{r.date}</td>
                  <td><StatusBadge status={r.priority} /></td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </ApiState>
  )
}
