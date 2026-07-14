import StatusBadge from '../../components/admin/shared/StatusBadge'
import PortalStats from '../shared/PortalStats'
import { beneficiaryPortal } from '../../data/portalMockData'
import { Link } from 'react-router-dom'

export default function BeneficiaryDashboard() {
  return (
    <>
      <PortalStats items={beneficiaryPortal.stats} />
      <section className="portal-panel">
        <div className="portal-panel__header">
          <h2>Recent Requests</h2>
          <Link to="/beneficiary/requests" className="portal-link">View all</Link>
        </div>
        <div className="portal-list">
          {beneficiaryPortal.requests.map((r) => (
            <div key={r.id} className="portal-list-item">
              <div>
                <strong>{r.id} — {r.type}</strong>
                <span>Submitted: {r.date}</span>
              </div>
              <StatusBadge status={r.status} />
            </div>
          ))}
        </div>
      </section>
      <div className="portal-actions">
        <Link to="/assistance" className="btn btn--primary">Submit New Request</Link>
      </div>
    </>
  )
}
