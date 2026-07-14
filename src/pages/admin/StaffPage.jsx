import { staff } from '../../data/adminMockData'
import PageHeader from '../../components/admin/shared/PageHeader'
import DataTable from '../../components/admin/shared/DataTable'
import StatusBadge from '../../components/admin/shared/StatusBadge'

export default function StaffPage() {
  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role' },
    { key: 'department', label: 'Department' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: () => (
        <div className="table-actions">
          <button type="button" className="btn btn--sm btn--outline">Edit</button>
          <button type="button" className="btn btn--sm btn--outline">Permissions</button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Staff Management"
        description="Manage staff accounts and role permissions."
        actions={<button type="button" className="btn btn--primary">+ Add Staff</button>}
      />
      <DataTable columns={columns} data={staff} />
    </>
  )
}
