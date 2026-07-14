import StatusBadge from '../../components/admin/shared/StatusBadge'
import { donorPortal } from '../../data/portalMockData'

export default function DonorDonationsPage() {
  return (
    <section className="portal-panel">
      <div className="portal-panel__header">
        <h2>Donation History</h2>
      </div>
      <div className="portal-table-wrap">
        <table className="portal-table">
          <thead>
            <tr>
              <th>Tracking Code</th>
              <th>Type</th>
              <th>Amount / Items</th>
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
  )
}
