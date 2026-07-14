import StatusBadge from '../../components/admin/shared/StatusBadge'

const certificates = [
  { id: 'CERT-001', type: 'Certificate of Donation', reference: 'DON-K2F9A', date: '2026-06-30', status: 'Generated' },
  { id: 'CERT-002', type: 'Official Receipt', reference: 'DON-P7M2C', date: '—', status: 'Pending' },
]

export default function DonorCertificatesPage() {
  return (
    <section className="portal-panel">
      <div className="portal-panel__header">
        <h2>Certificates & Official Receipts</h2>
      </div>
      <div className="portal-table-wrap">
        <table className="portal-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Reference</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {certificates.map((c) => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{c.type}</td>
                <td>{c.reference}</td>
                <td>{c.date}</td>
                <td><StatusBadge status={c.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
