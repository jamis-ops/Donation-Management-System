import { Link } from 'react-router-dom'
import { HeartHandshake, FileBadge, ArrowRight } from 'lucide-react'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import { getPortalData } from '../../api/resources'
import { useApiObject } from '../../hooks/useApiList'

export default function DonorDashboard() {
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
            <div className="portal-panel__header">
              <h2>Recent Donations</h2>
              <Link to="/donor/donations" className="portal-link">Track all <ArrowRight size={13} /></Link>
            </div>
            <div className="portal-table-wrap">
              <table className="portal-table">
                <thead>
                  <tr><th>Tracking Code</th><th>Type</th><th>Amount</th><th>Date</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {data.donations.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: '#6b7280' }}>No donations yet — make your first one below.</td></tr>
                  ) : data.donations.slice(0, 6).map((d) => (
                    <tr key={d.id}>
                      <td><strong>{d.id}</strong></td><td>{d.type}</td><td>{d.amount}</td><td>{d.date}</td>
                      <td><StatusBadge status={d.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="portal-actions">
            <Link to="/donate" className="btn btn--primary">
              <HeartHandshake size={16} /> Make a Donation
            </Link>
            <Link to="/donor/donations" className="btn btn--outline">Track My Donations</Link>
            <Link to="/donor/certificates" className="btn btn--outline">
              <FileBadge size={16} /> Certificates
            </Link>
          </div>
        </>
      )}
    </ApiState>
  )
}
