import { volunteersApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { useFilters } from '../../hooks/useFilters'
import PageHeader from '../../components/admin/shared/PageHeader'
import DataTable from '../../components/admin/shared/DataTable'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import FilterBar from '../../components/admin/shared/FilterBar'

const filterConfig = {
  searchKeys: ['id', 'name', 'email'],
  filters: [
    { key: 'status', label: 'Status' },
    {
      key: 'program',
      label: 'Program',
      deriveOptions: (data) =>
        Array.from(new Set(data.flatMap((v) => v.programs || []))).sort(),
      match: (row, val) => (row.programs || []).includes(val),
    },
  ],
}

export default function VolunteersPage() {
  const { data: volunteers, loading, error, reload } = useApiList(() => volunteersApi.list())
  const filters = useFilters(volunteers, filterConfig)

  const handleApprove = async (row) => {
    await volunteersApi.update(row.dbId, { status: 'Approved' })
    reload()
  }

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'programs', label: 'Programs', render: (row) => row.programs.join(', ') },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'hours', label: 'Hours Rendered' },
    { key: 'assignedTasks', label: 'Tasks' },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions">
          {row.status === 'Pending Review' && (
            <button type="button" className="btn btn--sm btn--primary" onClick={() => handleApprove(row)}>Approve</button>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader title="Volunteer Management" description="Review applications, assign programs, track hours, and generate certificates." />
      <FilterBar
        controller={filters}
        searchPlaceholder="Search by ID, name, or email..."
        exportConfig={{ filename: 'volunteer-report', title: 'Volunteer Report', columns, rows: filters.filtered }}
      />
      <ApiState loading={loading} error={error} onRetry={reload}>
        <DataTable columns={columns} data={filters.filtered} />
      </ApiState>
    </>
  )
}
