import { certificates } from '../../data/adminMockData'
import PageHeader from '../../components/admin/shared/PageHeader'
import DataTable from '../../components/admin/shared/DataTable'
import StatusBadge from '../../components/admin/shared/StatusBadge'

export default function CertificatesPage() {
  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'type', label: 'Type' },
    { key: 'recipient', label: 'Recipient' },
    { key: 'reference', label: 'Reference' },
    { key: 'date', label: 'Date Generated' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions">
          {row.status === 'Pending' ? (
            <button type="button" className="btn btn--sm btn--primary">Generate</button>
          ) : (
            <button type="button" className="btn btn--sm btn--outline">Download</button>
          )}
          <button type="button" className="btn btn--sm btn--outline">Send Email</button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Certificates & Official Receipts"
        description="Generate certificates of donation, volunteer service, and official receipts."
        actions={
          <div className="table-actions">
            <button type="button" className="btn btn--outline">+ Certificate of Donation</button>
            <button type="button" className="btn btn--outline">+ Volunteer Certificate</button>
            <button type="button" className="btn btn--primary">+ Official Receipt</button>
          </div>
        }
      />

      <div className="cert-types">
        <div className="cert-type-card">
          <h3>Certificate of Donation</h3>
          <p>Issued to donors after donation verification.</p>
        </div>
        <div className="cert-type-card">
          <h3>Certificate of Volunteer Service</h3>
          <p>Issued upon completion of volunteer activities.</p>
        </div>
        <div className="cert-type-card">
          <h3>Certificate of Participation</h3>
          <p>Issued for event and distribution participation.</p>
        </div>
        <div className="cert-type-card">
          <h3>Official Receipt (OR)</h3>
          <p>Tax-deductible receipt for monetary donations.</p>
        </div>
      </div>

      <DataTable columns={columns} data={certificates} />
    </>
  )
}
