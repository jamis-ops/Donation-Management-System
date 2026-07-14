import { useState } from 'react'
import { inventory, repackingJobs } from '../../data/adminMockData'
import PageHeader from '../../components/admin/shared/PageHeader'
import DataTable from '../../components/admin/shared/DataTable'
import StatusBadge from '../../components/admin/shared/StatusBadge'

export default function InventoryPage() {
  const [tab, setTab] = useState('inventory')

  const inventoryColumns = [
    { key: 'id', label: 'ID' },
    { key: 'item', label: 'Item' },
    { key: 'quantity', label: 'Available' },
    { key: 'unit', label: 'Unit' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'allocated', label: 'Allocated' },
    { key: 'distributed', label: 'Distributed' },
    {
      key: 'actions',
      label: 'Actions',
      render: () => (
        <div className="table-actions">
          <button type="button" className="btn btn--sm btn--outline">Update</button>
          <button type="button" className="btn btn--sm btn--outline">Allocate</button>
        </div>
      ),
    },
  ]

  const repackingColumns = [
    { key: 'id', label: 'Job ID' },
    { key: 'source', label: 'Source Items' },
    { key: 'output', label: 'Output' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'assignedTo', label: 'Assigned To' },
    { key: 'dueDate', label: 'Due Date' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions">
          {row.status !== 'Completed' && (
            <button type="button" className="btn btn--sm btn--primary">Update Progress</button>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Inventory Tracking"
        description="Track incoming donations, available stock, repacking, and low-stock alerts."
        actions={
          <div className="table-actions">
            <button type="button" className="btn btn--outline">+ Record Incoming</button>
            <button type="button" className="btn btn--primary">+ New Repacking Job</button>
          </div>
        }
      />

      <div className="admin-alert admin-alert--warning">
        <strong>Low Stock Alert:</strong> Rice (50kg sacks) — 45 remaining (threshold: 100). School supply kits — 18 remaining.
      </div>

      <div className="admin-tabs">
        <button
          type="button"
          className={`admin-tab${tab === 'inventory' ? ' admin-tab--active' : ''}`}
          onClick={() => setTab('inventory')}
        >
          Inventory
        </button>
        <button
          type="button"
          className={`admin-tab${tab === 'repacking' ? ' admin-tab--active' : ''}`}
          onClick={() => setTab('repacking')}
        >
          Repacking
        </button>
      </div>

      {tab === 'inventory' ? (
        <DataTable columns={inventoryColumns} data={inventory} />
      ) : (
        <DataTable columns={repackingColumns} data={repackingJobs} />
      )}
    </>
  )
}
