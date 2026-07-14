import { useState } from 'react'
import { donations } from '../../data/adminMockData'
import PageHeader from '../../components/admin/shared/PageHeader'
import DataTable from '../../components/admin/shared/DataTable'
import StatusBadge from '../../components/admin/shared/StatusBadge'

const lifecycle = [
  'Submission', 'Tracking Code', 'Verification', 'Inventory',
  'Repacking', 'Allocation', 'Distribution Planning', 'Distribution', 'Certificate/OR',
]

export default function DonationsPage() {
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)

  const filtered = filter === 'all' ? donations : donations.filter((d) => d.status === filter)

  const columns = [
    { key: 'trackingCode', label: 'Tracking Code' },
    { key: 'donor', label: 'Donor' },
    { key: 'type', label: 'Type' },
    { key: 'amount', label: 'Amount / Items' },
    { key: 'date', label: 'Date' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions">
          {row.status === 'Pending Verification' && (
            <button type="button" className="btn btn--sm btn--primary" onClick={(e) => e.stopPropagation()}>
              Verify
            </button>
          )}
          <button type="button" className="btn btn--sm btn--outline" onClick={(e) => { e.stopPropagation(); setSelected(row) }}>
            View
          </button>
        </div>
      ),
    },
  ]

  const statuses = ['all', ...new Set(donations.map((d) => d.status))]

  return (
    <>
      <PageHeader
        title="Donation Processing"
        description="Verify donations, monitor status, and manage the donation lifecycle."
        actions={<button type="button" className="btn btn--primary">+ Record Donation</button>}
      />

      <div className="admin-lifecycle">
        {lifecycle.map((step, i) => (
          <span key={step} className="admin-lifecycle__step">
            {step}
            {i < lifecycle.length - 1 && <span className="admin-lifecycle__arrow">→</span>}
          </span>
        ))}
      </div>

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

      <DataTable columns={columns} data={filtered} onRowClick={setSelected} />

      {selected && (
        <div className="admin-modal-overlay" onClick={() => setSelected(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Donation Details</h2>
            <dl className="detail-list">
              <dt>Tracking Code</dt><dd>{selected.trackingCode}</dd>
              <dt>Donor</dt><dd>{selected.donor}</dd>
              <dt>Type</dt><dd>{selected.type}</dd>
              <dt>Amount</dt><dd>{selected.amount}</dd>
              <dt>Status</dt><dd><StatusBadge status={selected.status} /></dd>
              <dt>Date</dt><dd>{selected.date}</dd>
            </dl>
            <div className="admin-modal__actions">
              {selected.status === 'Pending Verification' && (
                <button type="button" className="btn btn--primary">Verify & Approve</button>
              )}
              <button type="button" className="btn btn--outline">Generate Certificate</button>
              <button type="button" className="btn btn--outline">Issue Official Receipt</button>
              <button type="button" className="btn btn--ghost" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
