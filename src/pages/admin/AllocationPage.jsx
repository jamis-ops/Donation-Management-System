import { allocations } from '../../data/adminMockData'
import PageHeader from '../../components/admin/shared/PageHeader'
import DataTable from '../../components/admin/shared/DataTable'
import StatusBadge from '../../components/admin/shared/StatusBadge'

export default function AllocationPage() {
  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'resource', label: 'Resource' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'program', label: 'Program' },
    { key: 'beneficiary', label: 'Beneficiary / Group' },
    { key: 'date', label: 'Date' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions">
          {row.status === 'Pending' && (
            <button type="button" className="btn btn--sm btn--primary">Confirm</button>
          )}
          <button type="button" className="btn btn--sm btn--outline">Edit</button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Resource Allocation"
        description="Allocate donations to beneficiaries and programs. Monitor demand vs. supply."
        actions={<button type="button" className="btn btn--primary">+ New Allocation</button>}
      />

      <div className="demand-supply-grid">
        <div className="demand-supply-card demand-supply-card--warn">
          <strong>Disaster Relief</strong>
          <div className="demand-supply-bar">
            <div className="demand-supply-bar__fill" style={{ width: '85%' }} />
          </div>
          <span>Demand: 85% · Supply: 72%</span>
        </div>
        <div className="demand-supply-card">
          <strong>Feeding Programs</strong>
          <div className="demand-supply-bar">
            <div className="demand-supply-bar__fill demand-supply-bar__fill--good" style={{ width: '88%' }} />
          </div>
          <span>Demand: 90% · Supply: 88%</span>
        </div>
        <div className="demand-supply-card demand-supply-card--warn">
          <strong>Medical Missions</strong>
          <div className="demand-supply-bar">
            <div className="demand-supply-bar__fill" style={{ width: '40%' }} />
          </div>
          <span>Demand: 45% · Supply: 40%</span>
        </div>
      </div>

      <DataTable columns={columns} data={allocations} />
    </>
  )
}
