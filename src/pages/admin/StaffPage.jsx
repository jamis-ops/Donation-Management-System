import { getStaff } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import PageHeader from '../../components/admin/shared/PageHeader'
import DataTable from '../../components/admin/shared/DataTable'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'

export default function StaffPage() {
  const { data, loading, error, reload } = useApiList(() => getStaff())

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role' },
    { key: 'department', label: 'Department' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ]

  return (
    <>
      <PageHeader title="Staff Management" description="Staff accounts are managed through the users table (Admin and Staff roles)." />
      <ApiState loading={loading} error={error} onRetry={reload}>
        <DataTable columns={columns} data={data} />
      </ApiState>
    </>
  )
}
