import StatusBadge from '../../components/admin/shared/StatusBadge'
import PortalStats from '../shared/PortalStats'
import { donorPortal } from '../../data/portalMockData'
import { Link } from 'react-router-dom'

export default function DonorDashboard() {
  return (
    <>
      <PortalStats items={donorPortal.stats} />
      <section className="portal-panel">
        <div className="portal-panel__header">
          <h2>Recent Donations</h2>
          <Link to="/donor/donations" className="portal-link">View all</Link>
        </div>
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th>Tracking Code</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {donorPortal.donations.map((d) => (
                <tr key={d.id}>
                  <td>{d.id}</td>
                  <td>{d.type}</td>
                  <td>{d.amount}</td>
                  <td>{d.date}</td>
                  <td><StatusBadge status={d.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="portal-actions">
        <Link to="/donate" className="btn btn--primary">Make a Donation</Link>
        <Link to="/donor/certificates" className="btn btn--outline">Request Official Receipt</Link>
      </div>
    </>
  )
}
