import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import { distributionsApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'

export default function BeneficiaryDistributionsPage() {
  const { data, loading, error, reload } = useApiList(() => distributionsApi.list())

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      <section className="portal-panel">
        <div className="portal-panel__header"><h2>Scheduled Distributions</h2></div>
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead><tr><th>Date</th><th>Location</th><th>Type</th><th>Status</th></tr></thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.id}>
                  <td>{d.date}</td><td>{d.location}</td><td>{d.type}</td>
                  <td><StatusBadge status={d.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </ApiState>
  )
}
