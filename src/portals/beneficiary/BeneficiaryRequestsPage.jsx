import StatusBadge from '../../components/admin/shared/StatusBadge'
import { beneficiaryPortal } from '../../data/portalMockData'

export default function BeneficiaryRequestsPage() {
  return (
    <section className="portal-panel">
      <div className="portal-panel__header"><h2>Assistance Requests</h2></div>
      <div className="portal-table-wrap">
        <table className="portal-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Type</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {beneficiaryPortal.requests.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.type}</td>
                <td>{r.date}</td>
                <td><StatusBadge status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
