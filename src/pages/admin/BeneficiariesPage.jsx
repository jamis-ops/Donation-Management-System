import { useState } from 'react'
import { beneficiaries, assistanceRequests } from '../../data/adminMockData'
import PageHeader from '../../components/admin/shared/PageHeader'
import DataTable from '../../components/admin/shared/DataTable'
import StatusBadge from '../../components/admin/shared/StatusBadge'

export default function BeneficiariesPage() {
  const [tab, setTab] = useState('accounts')

  const beneficiaryColumns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'category', label: 'Category' },
    { key: 'barangay', label: 'Barangay' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'requests', label: 'Requests' },
    { key: 'lastAssistance', label: 'Last Assistance' },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions">
          {row.status === 'Pending Approval' && (
            <button type="button" className="btn btn--sm btn--primary">Approve</button>
          )}
          <button type="button" className="btn btn--sm btn--outline">View Profile</button>
        </div>
      ),
    },
  ]

  const requestColumns = [
    { key: 'id', label: 'Reference' },
    { key: 'beneficiary', label: 'Beneficiary' },
    { key: 'type', label: 'Assistance Type' },
    { key: 'date', label: 'Submitted' },
    { key: 'priority', label: 'Priority', render: (row) => <StatusBadge status={row.priority} /> },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: () => (
        <div className="table-actions">
          <button type="button" className="btn btn--sm btn--outline">Review</button>
          <button type="button" className="btn btn--sm btn--primary">Allocate</button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Beneficiary Management"
        description="Register beneficiaries, verify eligibility, and manage assistance requests."
        actions={<button type="button" className="btn btn--primary">+ Register Beneficiary</button>}
      />

      <div className="admin-tabs">
        <button
          type="button"
          className={`admin-tab${tab === 'accounts' ? ' admin-tab--active' : ''}`}
          onClick={() => setTab('accounts')}
        >
          Beneficiary Accounts
        </button>
        <button
          type="button"
          className={`admin-tab${tab === 'requests' ? ' admin-tab--active' : ''}`}
          onClick={() => setTab('requests')}
        >
          Assistance Requests
        </button>
      </div>

      {tab === 'accounts' ? (
        <DataTable columns={beneficiaryColumns} data={beneficiaries} />
      ) : (
        <DataTable columns={requestColumns} data={assistanceRequests} />
      )}
    </>
  )
}
