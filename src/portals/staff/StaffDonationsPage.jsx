import StatusBadge from '../../components/admin/shared/StatusBadge'

const donations = [
  { id: 'DON-P7M2C', donor: 'SM Foundation', type: 'In-Kind', status: 'Pending Verification' },
  { id: 'DON-R4N8D', donor: 'Lisa Tan', type: 'Monetary', status: 'Pending Verification' },
]

export default function StaffDonationsPage() {
  return (
    <section className="portal-panel">
      <div className="portal-panel__header"><h2>Donations to Process</h2></div>
      <div className="portal-table-wrap">
        <table className="portal-table">
          <thead>
            <tr><th>Code</th><th>Donor</th><th>Type</th><th>Status</th></tr>
          </thead>
          <tbody>
            {donations.map((d) => (
              <tr key={d.id}>
                <td>{d.id}</td>
                <td>{d.donor}</td>
                <td>{d.type}</td>
                <td><StatusBadge status={d.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
