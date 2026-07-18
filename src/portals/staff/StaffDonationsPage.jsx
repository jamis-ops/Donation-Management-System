import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import { donationsApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'

export default function StaffDonationsPage() {
  const { data, loading, error, reload } = useApiList(() => donationsApi.list())

  const handleVerify = async (row) => {
    await donationsApi.update(row.dbId, { status: 'Verified' })
    reload()
  }

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      <section className="portal-panel">
        <div className="portal-panel__header"><h2>Donations to Process</h2></div>
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead><tr><th>Code</th><th>Donor</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.id}>
                  <td>{d.trackingCode}</td><td>{d.donor}</td><td>{d.amount}</td>
                  <td><StatusBadge status={d.status} /></td>
                  <td>
                    {d.status === 'Pending Verification' && (
                      <button type="button" className="btn btn--sm btn--primary" onClick={() => handleVerify(d)}>Verify</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </ApiState>
  )
}
