import { useCallback, useState } from 'react'
import { Package, PackagePlus, Pencil, Play, CheckCircle2, XCircle, Trash2, X } from 'lucide-react'
import { inventoryApi, repackingApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { DONATION_CATEGORIES } from '../../constants/options'
import { useFilters } from '../../hooks/useFilters'
import DataTable from '../admin/shared/DataTable'
import StatusBadge from '../admin/shared/StatusBadge'
import StockLevelBar from '../admin/shared/StockLevelBar'
import ApiState from '../admin/shared/ApiState'
import FilterBar from '../admin/shared/FilterBar'
import ModalHeader from '../admin/shared/ModalHeader'

const inventoryFilterConfig = {
  searchKeys: ['item', 'category'],
  filters: [
    { key: 'category', label: 'Category' },
    { key: 'status', label: 'Stock Status', allLabel: 'All Stock' },
  ],
}

const repackingFilterConfig = {
  searchKeys: ['id', 'output', 'source', 'assignedTo'],
  filters: [{ key: 'status', label: 'Status' }],
  dateKey: 'dueDateRaw',
}

const emptyItemForm = {
  item: '', category: '', quantity: '', unit: 'units',
  lowStockThreshold: '100', moderateStockThreshold: '', allocated: '0', distributed: '0',
}

const emptyBatchForm = {
  sourceItemId: '', sourceQuantity: '', output: '', quantity: '', outputUnit: 'packs',
  assignedTo: '', dueDate: '', notes: '',
}

export default function InventoryManagement() {
  const [tab, setTab] = useState('inventory')
  const [invSummary, setInvSummary] = useState(null)
  const [rpkSummary, setRpkSummary] = useState(null)
  const [notice, setNotice] = useState('')

  const [itemModal, setItemModal] = useState(null)   // null | 'create' | row
  const [itemForm, setItemForm] = useState(emptyItemForm)
  const [batchModal, setBatchModal] = useState(null) // null | 'create' | row
  const [batchForm, setBatchForm] = useState(emptyBatchForm)
  const [saving, setSaving] = useState(false)

  const fetchInventory = useCallback(async () => {
    const res = await inventoryApi.list()
    setInvSummary(res.summary || null)
    return res
  }, [])

  const fetchRepacking = useCallback(async () => {
    const res = await repackingApi.list()
    setRpkSummary(res.summary || null)
    return res
  }, [])

  const { data: items, loading, error, reload } = useApiList(fetchInventory)
  const { data: batches, loading: rpkLoading, error: rpkError, reload: reloadRpk } = useApiList(fetchRepacking)
  const categoryOptions = DONATION_CATEGORIES

  const reloadAll = () => { reload(); reloadRpk() }

  const invFilters = useFilters(items, inventoryFilterConfig)
  const rpkFilters = useFilters(batches, repackingFilterConfig)

  /* ---------- Inventory handlers ---------- */

  const openItemCreate = () => {
    setItemForm(emptyItemForm)
    setItemModal('create')
  }

  const openItemEdit = (row) => {
    setItemForm({
      item: row.item,
      category: row.category || '',
      quantity: String(row.quantity),
      unit: row.unit,
      lowStockThreshold: String(row.lowStockThreshold),
      moderateStockThreshold: row.moderateStockThreshold ? String(row.moderateStockThreshold) : '',
      allocated: String(row.allocated),
      distributed: String(row.distributed),
    })
    setItemModal(row)
  }

  const handleItemSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        item: itemForm.item.trim(),
        category: itemForm.category.trim(),
        quantity: Number(itemForm.quantity) || 0,
        unit: itemForm.unit.trim() || 'units',
        lowStockThreshold: Number(itemForm.lowStockThreshold) || 0,
        moderateStockThreshold: itemForm.moderateStockThreshold ? Number(itemForm.moderateStockThreshold) : null,
        allocated: Number(itemForm.allocated) || 0,
        distributed: Number(itemForm.distributed) || 0,
      }
      if (itemModal === 'create') {
        await inventoryApi.create(payload)
        setNotice(`${payload.item} added to inventory.`)
      } else {
        await inventoryApi.update(itemModal.dbId, payload)
        setNotice(`${payload.item} updated.`)
      }
      setItemModal(null)
      reload()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleItemDelete = async (row) => {
    if (!window.confirm(`Delete "${row.item}" from inventory?`)) return
    try {
      await inventoryApi.remove(row.dbId)
      setNotice(`${row.item} removed from inventory.`)
      reload()
    } catch (err) {
      alert(err.message)
    }
  }

  /* ---------- Repacking handlers ---------- */

  const openBatchCreate = () => {
    setBatchForm(emptyBatchForm)
    setBatchModal('create')
  }

  const openBatchEdit = (row) => {
    setBatchForm({
      sourceItemId: '',
      sourceQuantity: String(row.sourceQuantity || ''),
      output: row.output,
      quantity: String(row.quantity),
      outputUnit: row.outputUnit || 'packs',
      assignedTo: row.assignedTo || '',
      dueDate: row.dueDateRaw || '',
      notes: row.notes || '',
    })
    setBatchModal(row)
  }

  const handleBatchSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (batchModal === 'create') {
        await repackingApi.create({
          sourceItemId: batchForm.sourceItemId ? Number(batchForm.sourceItemId) : null,
          sourceQuantity: Number(batchForm.sourceQuantity) || 0,
          output: batchForm.output.trim(),
          quantity: Number(batchForm.quantity) || 0,
          outputUnit: batchForm.outputUnit.trim() || 'packs',
          assignedTo: batchForm.assignedTo.trim() || null,
          dueDate: batchForm.dueDate || null,
          notes: batchForm.notes,
        })
        setNotice('Repacking batch created — source stock has been deducted from inventory.')
      } else {
        await repackingApi.update(batchModal.dbId, {
          output: batchForm.output.trim(),
          quantity: Number(batchForm.quantity) || 0,
          outputUnit: batchForm.outputUnit.trim() || 'packs',
          assignedTo: batchForm.assignedTo.trim() || null,
          dueDate: batchForm.dueDate || null,
          notes: batchForm.notes,
        })
        setNotice('Repacking batch updated.')
      }
      setBatchModal(null)
      reloadAll()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const setBatchStatus = async (row, status) => {
    const confirmMsg = {
      'In Progress': null,
      Completed: `Complete batch ${row.id}? ${row.quantity} ${row.outputUnit} of "${row.output}" will be added to inventory.`,
      Cancelled: `Cancel batch ${row.id}? Source stock will be returned to inventory.`,
    }[status]
    if (confirmMsg && !window.confirm(confirmMsg)) return
    try {
      await repackingApi.update(row.dbId, { status })
      setNotice(
        status === 'Completed'
          ? `Batch ${row.id} completed — ${row.quantity} ${row.outputUnit} of ${row.output} added to inventory.`
          : status === 'Cancelled'
            ? `Batch ${row.id} cancelled — source stock restored.`
            : `Batch ${row.id} is now in progress.`
      )
      reloadAll()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleBatchDelete = async (row) => {
    if (!window.confirm(`Delete batch ${row.id}?${row.status === 'Scheduled' || row.status === 'In Progress' ? ' Source stock will be returned to inventory.' : ''}`)) return
    try {
      await repackingApi.remove(row.dbId)
      setNotice(`Batch ${row.id} deleted.`)
      reloadAll()
    } catch (err) {
      alert(err.message)
    }
  }

  /* ---------- Columns ---------- */

  const inventoryColumns = [
    {
      key: 'item',
      label: 'Item',
      render: (row) => (
        <div>
          <strong>{row.item}</strong>
          {row.category && <div className="inv-category">{row.category}</div>}
        </div>
      ),
    },
    {
      key: 'stock',
      label: 'Stock Level',
      render: (row) => (
        <StockLevelBar level={row.stockLevel} percent={row.stockPercent} quantity={row.quantity} unit={row.unit} />
      ),
    },
    { key: 'available', label: 'Available' },
    { key: 'allocated', label: 'Allocated' },
    { key: 'distributed', label: 'Distributed' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions">
          <button type="button" className="btn btn--sm btn--outline" onClick={(e) => { e.stopPropagation(); openItemEdit(row) }}>
            <Pencil size={13} /> Update
          </button>
          <button type="button" className="btn btn--sm btn--ghost" title="Delete" onClick={(e) => { e.stopPropagation(); handleItemDelete(row) }}>
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ]

  const repackingColumns = [
    { key: 'id', label: 'Batch' },
    { key: 'source', label: 'Source (deducted)' },
    {
      key: 'output',
      label: 'Output',
      render: (row) => <span><strong>{row.quantity}</strong> {row.outputUnit} — {row.output}</span>,
    },
    { key: 'assignedTo', label: 'Assigned To' },
    { key: 'dueDate', label: 'Due Date' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions">
          {row.status === 'Scheduled' && (
            <button type="button" className="btn btn--sm btn--primary" onClick={(e) => { e.stopPropagation(); setBatchStatus(row, 'In Progress') }}>
              <Play size={13} /> Start
            </button>
          )}
          {row.status === 'In Progress' && (
            <button type="button" className="btn btn--sm btn--primary" onClick={(e) => { e.stopPropagation(); setBatchStatus(row, 'Completed') }}>
              <CheckCircle2 size={13} /> Complete
            </button>
          )}
          {(row.status === 'Scheduled' || row.status === 'In Progress') && (
            <>
              <button type="button" className="btn btn--sm btn--outline" onClick={(e) => { e.stopPropagation(); openBatchEdit(row) }}>
                <Pencil size={13} />
              </button>
              <button type="button" className="btn btn--sm btn--ghost" title="Cancel batch" onClick={(e) => { e.stopPropagation(); setBatchStatus(row, 'Cancelled') }}>
                <XCircle size={13} />
              </button>
            </>
          )}
          {(row.status === 'Completed' || row.status === 'Cancelled') && (
            <button type="button" className="btn btn--sm btn--ghost" title="Delete record" onClick={(e) => { e.stopPropagation(); handleBatchDelete(row) }}>
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ),
    },
  ]

  const selectedSource = items.find((i) => String(i.dbId) === batchForm.sourceItemId)

  return (
    <>
      {notice && (
        <div className="portal-notice">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss"><X size={14} /></button>
        </div>
      )}

      <div className="admin-tabs">
        <button type="button" className={`admin-tab${tab === 'inventory' ? ' admin-tab--active' : ''}`} onClick={() => setTab('inventory')}>
          <Package size={14} /> Inventory
        </button>
        <button type="button" className={`admin-tab${tab === 'repacking' ? ' admin-tab--active' : ''}`} onClick={() => setTab('repacking')}>
          <PackagePlus size={14} /> Repacking
        </button>
      </div>

      {tab === 'inventory' && (
        <>
          {invSummary && (
            <div className="stock-summary stock-summary--4">
              <div className="stock-summary__card">
                <strong>{invSummary.totalItems}</strong><span>Items Tracked</span>
              </div>
              <div className="stock-summary__card stock-summary__card--sufficient">
                <strong>{invSummary.sufficientCount}</strong><span>Sufficient</span>
              </div>
              <div className="stock-summary__card stock-summary__card--moderate">
                <strong>{invSummary.moderateCount}</strong><span>Moderate</span>
              </div>
              <div className="stock-summary__card stock-summary__card--low">
                <strong>{invSummary.lowCount}</strong><span>Low Stock</span>
              </div>
            </div>
          )}

          <div className="inv-toolbar inv-toolbar--end">
            <button type="button" className="btn btn--primary" onClick={openItemCreate}>+ Add Item</button>
          </div>

          <FilterBar
            controller={invFilters}
            searchPlaceholder="Search items or categories..."
            exportConfig={{ filename: 'inventory-report', title: 'Inventory Report', columns: inventoryColumns, rows: invFilters.filtered }}
          />

          <ApiState loading={loading} error={error} onRetry={reload}>
            <DataTable columns={inventoryColumns} data={invFilters.filtered} onRowClick={openItemEdit} />
          </ApiState>
        </>
      )}

      {tab === 'repacking' && (
        <>
          {rpkSummary && (
            <div className="stock-summary stock-summary--4">
              <div className="stock-summary__card">
                <strong>{rpkSummary.total}</strong><span>Total Batches</span>
              </div>
              <div className="stock-summary__card stock-summary__card--moderate">
                <strong>{rpkSummary.scheduled}</strong><span>Scheduled</span>
              </div>
              <div className="stock-summary__card">
                <strong>{rpkSummary.inProgress}</strong><span>In Progress</span>
              </div>
              <div className="stock-summary__card stock-summary__card--sufficient">
                <strong>{rpkSummary.completed}</strong><span>Completed</span>
              </div>
            </div>
          )}

          <div className="inv-toolbar">
            <p className="inv-toolbar__hint">
              Creating a batch deducts source stock immediately. Completing a batch adds the repacked output to inventory automatically.
            </p>
            <button type="button" className="btn btn--primary" onClick={openBatchCreate}>+ New Repacking Batch</button>
          </div>

          <FilterBar
            controller={rpkFilters}
            searchPlaceholder="Search by batch, output, source, or assignee..."
            exportConfig={{ filename: 'repacking-report', title: 'Repacking Report', columns: repackingColumns, rows: rpkFilters.filtered }}
          />

          <ApiState loading={rpkLoading} error={rpkError} onRetry={reloadRpk}>
            <DataTable columns={repackingColumns} data={rpkFilters.filtered} />
          </ApiState>
        </>
      )}

      {itemModal && (
        <div className="admin-modal-overlay" onClick={() => setItemModal(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title={itemModal === 'create' ? 'Add Inventory Item' : `Update Stock — ${itemModal.item}`}
              onClose={() => setItemModal(null)}
            />
            <form onSubmit={handleItemSave}>
              <div className="form-row">
                <label>Item Name<input required value={itemForm.item} onChange={(e) => setItemForm({ ...itemForm, item: e.target.value })} placeholder="e.g. Rice (25kg sacks)" /></label>
                <label>Category
                  <input list="inv-category-options" value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })} placeholder="e.g. Food, Hygiene, Medical" />
                  <datalist id="inv-category-options">
                    {categoryOptions.map((c) => <option key={c} value={c} />)}
                  </datalist>
                </label>
              </div>
              <div className="form-row">
                <label>Quantity<input type="number" min="0" required value={itemForm.quantity} onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })} /></label>
                <label>Unit<input value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} placeholder="sacks, boxes, kits..." /></label>
              </div>
              <div className="form-row">
                <label>Low Stock Threshold<input type="number" min="0" value={itemForm.lowStockThreshold} onChange={(e) => setItemForm({ ...itemForm, lowStockThreshold: e.target.value })} /></label>
                <label>Moderate Threshold<input type="number" min="0" value={itemForm.moderateStockThreshold} onChange={(e) => setItemForm({ ...itemForm, moderateStockThreshold: e.target.value })} placeholder="Defaults to 2× low" /></label>
              </div>
              <div className="form-row">
                <label>Allocated<input type="number" min="0" value={itemForm.allocated} onChange={(e) => setItemForm({ ...itemForm, allocated: e.target.value })} /></label>
                <label>Distributed<input type="number" min="0" value={itemForm.distributed} onChange={(e) => setItemForm({ ...itemForm, distributed: e.target.value })} /></label>
              </div>
              <div className="admin-modal__actions">
                <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving...' : itemModal === 'create' ? 'Add Item' : 'Save Changes'}</button>
                <button type="button" className="btn btn--ghost" onClick={() => setItemModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {batchModal && (
        <div className="admin-modal-overlay" onClick={() => setBatchModal(null)}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title={batchModal === 'create' ? 'New Repacking Batch' : `Edit Batch ${batchModal.id}`}
              onClose={() => setBatchModal(null)}
            />
            <form onSubmit={handleBatchSave}>
              {batchModal === 'create' ? (
                <div className="form-row">
                  <label>Source Inventory Item
                    <select required value={batchForm.sourceItemId} onChange={(e) => setBatchForm({ ...batchForm, sourceItemId: e.target.value })}>
                      <option value="">Select item to repack...</option>
                      {items.filter((i) => i.quantity > 0).map((i) => (
                        <option key={i.dbId} value={i.dbId}>{i.item} — {i.quantity} {i.unit} in stock</option>
                      ))}
                    </select>
                  </label>
                  <label>Quantity to Use{selectedSource ? ` (max ${selectedSource.quantity})` : ''}
                    <input
                      type="number"
                      min="1"
                      max={selectedSource?.quantity || undefined}
                      required
                      value={batchForm.sourceQuantity}
                      onChange={(e) => setBatchForm({ ...batchForm, sourceQuantity: e.target.value })}
                    />
                  </label>
                </div>
              ) : (
                <p className="portal-hint">Source: {batchModal.source} (already deducted from inventory)</p>
              )}

              <div className="form-row">
                <label>Output Item<input required value={batchForm.output} onChange={(e) => setBatchForm({ ...batchForm, output: e.target.value })} placeholder="e.g. Family Relief Packs" /></label>
                <label>Output Quantity<input type="number" min="1" required value={batchForm.quantity} onChange={(e) => setBatchForm({ ...batchForm, quantity: e.target.value })} /></label>
                <label>Output Unit<input value={batchForm.outputUnit} onChange={(e) => setBatchForm({ ...batchForm, outputUnit: e.target.value })} /></label>
              </div>

              <div className="form-row">
                <label>Assigned To<input value={batchForm.assignedTo} onChange={(e) => setBatchForm({ ...batchForm, assignedTo: e.target.value })} placeholder="Staff or volunteer team" /></label>
                <label>Due Date<input type="date" value={batchForm.dueDate} onChange={(e) => setBatchForm({ ...batchForm, dueDate: e.target.value })} /></label>
              </div>

              <label>Notes<textarea rows={2} value={batchForm.notes} onChange={(e) => setBatchForm({ ...batchForm, notes: e.target.value })} /></label>

              <div className="admin-modal__actions">
                <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving...' : batchModal === 'create' ? 'Create Batch' : 'Save Changes'}</button>
                <button type="button" className="btn btn--ghost" onClick={() => setBatchModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
