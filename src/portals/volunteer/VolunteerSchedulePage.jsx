import ApiState from '../../components/admin/shared/ApiState'
import { getPortalData } from '../../api/resources'
import { useApiObject } from '../../hooks/useApiList'

export default function VolunteerSchedulePage() {
  const { data, loading, error, reload } = useApiObject(() => getPortalData())

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      <section className="portal-panel">
        <div className="portal-panel__header"><h2>Upcoming Schedule</h2></div>
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead><tr><th>Date</th><th>Event</th><th>Time</th></tr></thead>
            <tbody>
              {(data?.schedule || []).map((s, i) => (
                <tr key={i}><td>{s.date}</td><td>{s.event}</td><td>{s.time}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </ApiState>
  )
}
