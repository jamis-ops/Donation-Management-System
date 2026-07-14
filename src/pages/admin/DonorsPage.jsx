import { donors } from '../../data/adminMockData'
import PageHeader from '../../components/admin/shared/PageHeader'
import DataTable from '../../components/admin/shared/DataTable'

export default function DonorsPage() {
  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'totalDonated', label: 'Total Donated' },
    { key: 'donations', label: 'Donations' },
    { key: 'lastDonation', label: 'Last Donation' },
    {
      key: 'actions',
      label: 'Actions',
      render: () => (
        <div className="table-actions">
          <button type="button" className="btn btn--sm btn--outline">View History</button>
          <button type="button" className="btn btn--sm btn--outline">Send Email</button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Donor Management"
        description="Manage donor profiles, donation history, and communications."
        actions={<button type="button" className="btn btn--primary">+ Add Donor</button>}
      />
      <DataTable columns={columns} data={donors} />
    </>
  )
}
