import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import { distributionsApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'

export default function StaffDistributionsPage() {
  const { data, loading, error, reload } = useApiList(() => distributionsApi.list())

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      <section className="portal-panel">
        <div className="portal-panel__header"><h2>Distribution Schedule</h2></div>
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead><tr><th>Location</th><th>Program</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.id}>
                  <td>{d.location}</td><td>{d.program}</td><td>{d.date}</td>
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
