import { useState } from 'react'
import { volunteers } from '../../data/adminMockData'
import PageHeader from '../../components/admin/shared/PageHeader'
import DataTable from '../../components/admin/shared/DataTable'
import StatusBadge from '../../components/admin/shared/StatusBadge'

export default function VolunteersPage() {
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all' ? volunteers : volunteers.filter((v) => v.status === filter)

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    {
      key: 'programs',
      label: 'Programs',
      render: (row) => row.programs.join(', '),
    },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'hours', label: 'Hours Rendered' },
    { key: 'assignedTasks', label: 'Tasks' },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions">
          {row.status === 'Pending Review' && (
            <>
              <button type="button" className="btn btn--sm btn--primary">Approve</button>
              <button type="button" className="btn btn--sm btn--outline">Reject</button>
            </>
          )}
          {row.status === 'Approved' && (
            <button type="button" className="btn btn--sm btn--primary">Assign Program</button>
          )}
          <button type="button" className="btn btn--sm btn--outline">View Profile</button>
        </div>
      ),
    },
  ]

  const statuses = ['all', ...new Set(volunteers.map((v) => v.status))]

  return (
    <>
      <PageHeader
        title="Volunteer Management"
        description="Review applications, assign programs, track hours, and generate certificates."
      />

      <div className="admin-filters">
        {statuses.map((s) => (
          <button
            key={s}
            type="button"
            className={`admin-filter${filter === s ? ' admin-filter--active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {s === 'all' ? 'All' : s}
          </button>
        ))}
      </div>

      <DataTable columns={columns} data={filtered} />
    </>
  )
}
