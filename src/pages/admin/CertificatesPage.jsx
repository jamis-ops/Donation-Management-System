import { certificates } from '../../data/adminMockData'
import PageHeader from '../../components/admin/shared/PageHeader'
import DataTable from '../../components/admin/shared/DataTable'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import { Award, Heart, Users, Receipt } from 'lucide-react'

const certTypes = [
  {
    icon: Heart,
    title: 'Certificate of Donation',
    description: 'Issued to donors after donation verification.',
  },
  {
    icon: Users,
    title: 'Certificate of Volunteer Service',
    description: 'Issued upon completion of volunteer activities.',
  },
  {
    icon: Award,
    title: 'Certificate of Participation',
    description: 'Issued for event and distribution participation.',
  },
  {
    icon: Receipt,
    title: 'Official Receipt (OR)',
    description: 'Tax-deductible receipt for monetary donations.',
  },
]

export default function CertificatesPage() {
  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'type', label: 'Type' },
    { key: 'recipient', label: 'Recipient' },
    { key: 'reference', label: 'Reference' },
    { key: 'date', label: 'Date Generated' },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions">
          {row.status === 'Pending' ? (
            <button type="button" className="btn btn--sm btn--primary">
              Generate
            </button>
          ) : (
            <button type="button" className="btn btn--sm btn--outline">
              Download
            </button>
          )}
          <button type="button" className="btn btn--sm btn--ghost">
            Send Email
          </button>
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
            <button type="button" className="btn btn--outline">
              + Certificate of Donation
            </button>
            <button type="button" className="btn btn--outline">
              + Volunteer Certificate
            </button>
            <button type="button" className="btn btn--primary">
              + Official Receipt
            </button>
          </div>
        }
      />

      <div className="cert-types">
        {certTypes.map(({ icon: Icon, title, description }) => (
          <div key={title} className="cert-type-card">
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'var(--admin-brand-muted)',
                color: 'var(--admin-brand)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '0.65rem',
              }}
            >
              <Icon size={18} />
            </div>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
        ))}
      </div>

      <DataTable columns={columns} data={certificates} />
    </>
  )
}
