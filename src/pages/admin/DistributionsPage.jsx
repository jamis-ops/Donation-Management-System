import { distributions } from '../../data/adminMockData'
import PageHeader from '../../components/admin/shared/PageHeader'
import DataTable from '../../components/admin/shared/DataTable'
import StatusBadge from '../../components/admin/shared/StatusBadge'

export default function DistributionsPage() {
  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'location', label: 'Location' },
    { key: 'program', label: 'Program' },
    { key: 'date', label: 'Date' },
    { key: 'beneficiaries', label: 'Beneficiaries' },
    { key: 'volunteers', label: 'Volunteers' },
    { key: 'vehicles', label: 'Vehicles' },
    { key: 'type', label: 'Type' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions">
          {row.status === 'Planning' && (
            <button type="button" className="btn btn--sm btn--primary">Schedule</button>
          )}
          {row.status === 'Scheduled' && (
            <button type="button" className="btn btn--sm btn--primary">Assign Volunteers</button>
          )}
          <button type="button" className="btn btn--sm btn--outline">View Details</button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Distribution Logistics"
        description="Schedule distributions, assign volunteers and vehicles, track delivery status."
        actions={<button type="button" className="btn btn--primary">+ Plan Distribution</button>}
      />
      <DataTable columns={columns} data={distributions} />
    </>
  )
}
