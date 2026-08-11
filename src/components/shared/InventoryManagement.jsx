import { useCallback, useState, useEffect } from 'react'
import { Package, PackagePlus, Pencil, Play, CheckCircle2, XCircle, Trash2, Calculator, Users, AlertCircle, Info } from 'lucide-react'
import { inventoryApi, repackingApi, getStaff, volunteersApi, beneficiariesApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { DONATION_CATEGORIES } from '../../constants/options'
import { useFilters } from '../../hooks/useFilters'
import DataTable from '../admin/shared/DataTable'
import StatusBadge from '../admin/shared/StatusBadge'
import StockLevelBar from '../admin/shared/StockLevelBar'
import ApiState from '../admin/shared/ApiState'
import FilterBar from '../admin/shared/FilterBar'
import ModalHeader from '../admin/shared/ModalHeader'
import MultiSourceRepackingModal from './MultiSourceRepackingModal'
import { notify } from '../../utils/toast'

const inventoryFilterConfig = {
  searchKeys: ['item', 'category'],
  filters: [
    { key: 'category', label: 'Category' },
    { key: 'status', label: 'Stock Status', allLabel: 'All Stock' },
  ],
}

const repackingFilterConfig = {
  searchKeys: ['id', 'output', 'source', 'assignedTo', 'targetBarangayName'],
  filters: [{ key: 'status', label: 'Status' }],
  dateKey: 'dueDateRaw',
}

const emptyItemForm = {
  item: '', category: '', quantity: '', unit: 'units',
  lowStockThreshold: '100', moderateStockThreshold: '', allocated: '0', distributed: '0',
}

const emptyBatchForm = {
  sourceItemId: '',
  sourceQuantity: '',
  output: '',
  quantity: '',
  outputUnit: 'packs',
  assignedTo: '',
  assignedType: '', // 'staff' or 'volunteer'
  dueDate: '',
  notes: '',
  // Smart calculation fields
  packsPerUnit: '',
  autoCalculate: false,
}

export default function InventoryManagement() {
  const [tab, setTab] = useState('inventory')
  const [invSummary, setInvSummary] = useState(null)
  const [rpkSummary, setRpkSummary] = useState(null)

  const [itemModal, setItemModal] = useState(null)   // null | 'create' | row
  const [itemForm, setItemForm] = useState(emptyItemForm)
  const [batchModal, setBatchModal] = useState(null) // null | 'create' | row
  const [batchForm, setBatchForm] = useState(emptyBatchForm)
  const [multiSourceModal, setMultiSourceModal] = useState(false) // New multi-source modal
  const [saving, setSaving] = useState(false)
  
  // New state for enhanced features
  const [staff, setStaff] = useState([])
  const [volunteers, setVolunteers] = useState([])
  const [loadingTeam, setLoadingTeam] = useState(false)
  const [beneficiaries, setBeneficiaries] = useState([])

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

  // Load staff and volunteers for assignment dropdown
  useEffect(() => {
    const loadTeam = async () => {
      setLoadingTeam(true)
      try {
        const [staffData, volunteerData, beneficiaryData] = await Promise.all([
          getStaff(),
          volunteersApi.list(),
          beneficiariesApi.list(),
        ])
        setStaff(Array.isArray(staffData) ? staffData.filter(s => s.status === 'Active') : [])
        setVolunteers(Array.isArray(volunteerData.data) ? volunteerData.data.filter(v => v.status === 'Approved') : [])
        setBeneficiaries(Array.isArray(beneficiaryData.data) ? beneficiaryData.data : [])
      } catch (err) {
        console.error('Failed to load team members:', err)
      } finally {
        setLoadingTeam(false)
      }
    }
    loadTeam()
  }, [])

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
        notify.success(`${payload.item} added to inventory.`)
      } else {
        await inventoryApi.update(itemModal.dbId, payload)
        notify.success(`${payload.item} updated.`)
      }
      setItemModal(null)
      reload()
    } catch (err) {
      notify.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleItemDelete = async (row) => {
    if (!window.confirm(`Delete "${row.item}" from inventory?`)) return
    try {
      await inventoryApi.remove(row.dbId)
      notify.success(`${row.item} removed from inventory.`)
      reload()
    } catch (err) {
      notify.error(err.message)
    }
  }

  /* ---------- Repacking handlers ---------- */

  // Smart calculation: Auto-calculate pack quantity based on source and packs per unit
  const calculatePackQuantity = (sourceQty, packsPerUnit) => {
    const source = Number(sourceQty) || 0
    const ratio = Number(packsPerUnit) || 0
    if (source > 0 && ratio > 0) {
      return Math.floor(source * ratio)
    }
    return ''
  }

  //Update pack quantity when source quantity or ratio changes
  useEffect(() => {
    if (batchForm.autoCalculate && batchForm.sourceQuantity && batchForm.packsPerUnit) {
      const calculated = calculatePackQuantity(batchForm.sourceQuantity, batchForm.packsPerUnit)
      if (calculated) {
        setBatchForm(prev => ({ ...prev, quantity: String(calculated) }))
      }
    }
  }, [batchForm.sourceQuantity, batchForm.packsPerUnit, batchForm.autoCalculate])

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
      assignedType: '', // Can't determine from existing data
      dueDate: row.dueDateRaw || '',
      notes: row.notes || '',
      packsPerUnit: '',
      autoCalculate: false,
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
        notify.success('Repacking batch created — source stock has been deducted from inventory.')
      } else {
        await repackingApi.update(batchModal.dbId, {
          output: batchForm.output.trim(),
          quantity: Number(batchForm.quantity) || 0,
          outputUnit: batchForm.outputUnit.trim() || 'packs',
          assignedTo: batchForm.assignedTo.trim() || null,
          dueDate: batchForm.dueDate || null,
          notes: batchForm.notes,
        })
        notify.success('Repacking batch updated.')
      }
      setBatchModal(null)
      reloadAll()
    } catch (err) {
      notify.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Handle multi-source repacking batch submission
  const handleMultiSourceSubmit = async (batchData) => {
    try {
      const result = await repackingApi.create(batchData)
      reloadAll()
      return result.data
    } catch (err) {
      console.error('Multi-source batch creation failed:', err)
      throw err
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
      notify.success(
        status === 'Completed'
          ? `Batch ${row.id} completed — ${row.quantity} ${row.outputUnit} of ${row.output} added to inventory.`
          : status === 'Cancelled'
            ? `Batch ${row.id} cancelled — source stock restored.`
            : `Batch ${row.id} is now in progress.`
      )
      reloadAll()
    } catch (err) {
      notify.error(err.message)
    }
  }

  const handleBatchDelete = async (row) => {
    if (!window.confirm(`Delete batch ${row.id}?${row.status === 'Scheduled' || row.status === 'In Progress' ? ' Source stock will be returned to inventory.' : ''}`)) return
    try {
      await repackingApi.remove(row.dbId)
      notify.success(`Batch ${row.id} deleted.`)
      reloadAll()
    } catch (err) {
      notify.error(err.message)
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
    {
      key: 'targetBarangay',
      label: 'Target Barangay',
      render: (row) => row.targetBarangayName ? (
        <div>
          <strong>{row.targetBarangayName}</strong>
          {row.targetBarangayLocation && <div className="inv-category">{row.targetBarangayLocation}</div>}
        </div>
      ) : (
        <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>General Stock</span>
      ),
    },
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
            <DataTable
              columns={inventoryColumns}
              data={invFilters.filtered}
              onRowClick={openItemEdit}
              pageSize={10}
              resetKey={`${invFilters.search}|${JSON.stringify(invFilters.values)}`}
            />
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
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn--primary" onClick={openBatchCreate}>
                <PackagePlus size={18} style={{ marginRight: '0.5rem' }} />
                Single-Source Batch
              </button>
              <button 
                type="button" 
                className="btn btn--primary" 
                onClick={() => setMultiSourceModal(true)}
                style={{ background: '#10b981' }}
              >
                <Package size={18} style={{ marginRight: '0.5rem' }} />
                Multi-Source Pack
              </button>
            </div>
          </div>

          <FilterBar
            controller={rpkFilters}
            searchPlaceholder="Search by batch, output, source, or assignee..."
            exportConfig={{ filename: 'repacking-report', title: 'Repacking Report', columns: repackingColumns, rows: rpkFilters.filtered }}
          />

          <ApiState loading={rpkLoading} error={rpkError} onRetry={reloadRpk}>
            <DataTable
              columns={repackingColumns}
              data={rpkFilters.filtered}
              pageSize={10}
              resetKey={`${rpkFilters.search}|${JSON.stringify(rpkFilters.values)}`}
            />
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
            <form onSubmit={handleBatchSave} className="repacking-form">
              {batchModal === 'create' ? (
                <>
                  {/* Source Selection Section */}
                  <div className="repacking-section">
                    <div className="repacking-section__header">
                      <Package size={16} />
                      <h4>Source Inventory</h4>
                    </div>
                    
                    <div className="form-row">
                      <label className="form-label-enhanced">
                        Source Item <span className="required">*</span>
                        <select 
                          required 
                          value={batchForm.sourceItemId} 
                          onChange={(e) => {
                            setBatchForm({ 
                              ...batchForm, 
                              sourceItemId: e.target.value,
                              sourceQuantity: '',
                              quantity: '',
                            })
                          }}
                          className="form-select-enhanced"
                        >
                          <option value="">Select item to repack...</option>
                          {items.filter((i) => i.quantity > 0).map((i) => (
                            <option key={i.dbId} value={i.dbId}>
                              {i.item} — {i.quantity} {i.unit} available
                              {i.category && ` (${i.category})`}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    {selectedSource && (
                      <div className="source-info-card">
                        <div className="source-info-row">
                          <span className="source-info-label">Available Stock:</span>
                          <span className="source-info-value">{selectedSource.quantity} {selectedSource.unit}</span>
                        </div>
                        {selectedSource.category && (
                          <div className="source-info-row">
                            <span className="source-info-label">Category:</span>
                            <span className="source-info-value">{selectedSource.category}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="form-row">
                      <label className="form-label-enhanced">
                        Quantity to Use <span className="required">*</span>
                        {selectedSource && <span className="field-hint-inline">(max: {selectedSource.quantity} {selectedSource.unit})</span>}
                        <input
                          type="number"
                          min="1"
                          max={selectedSource?.quantity || undefined}
                          required
                          value={batchForm.sourceQuantity}
                          onChange={(e) => setBatchForm({ ...batchForm, sourceQuantity: e.target.value })}
                          placeholder="Enter quantity"
                          className="form-input-enhanced"
                          disabled={!batchForm.sourceItemId}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Smart Calculator Section */}
                  {batchForm.sourceItemId && batchForm.sourceQuantity && (
                    <div className="repacking-section repacking-section--calculator">
                      <div className="repacking-section__header">
                        <Calculator size={16} />
                        <h4>Pack Calculator</h4>
                        <label className="calculator-toggle">
                          <input
                            type="checkbox"
                            checked={batchForm.autoCalculate}
                            onChange={(e) => setBatchForm({ ...batchForm, autoCalculate: e.target.checked })}
                          />
                          <span>Auto-calculate</span>
                        </label>
                      </div>

                      <div className="calculator-grid">
                        <div className="calculator-item">
                          <span className="calculator-label">Source Quantity:</span>
                          <span className="calculator-value">{batchForm.sourceQuantity} {selectedSource?.unit || 'units'}</span>
                        </div>
                        <div className="calculator-multiplier">×</div>
                        <div className="calculator-item">
                          <label className="calculator-label">
                            Packs per {selectedSource?.unit || 'unit'}:
                            <input
                              type="number"
                              min="0.1"
                              step="0.1"
                              value={batchForm.packsPerUnit}
                              onChange={(e) => setBatchForm({ ...batchForm, packsPerUnit: e.target.value })}
                              placeholder="e.g., 2.5"
                              className="calculator-input"
                            />
                          </label>
                        </div>
                        <div className="calculator-equals">=</div>
                        <div className="calculator-item">
                          <span className="calculator-label">Total Packs:</span>
                          <span className="calculator-value calculator-value--result">
                            {batchForm.packsPerUnit ? calculatePackQuantity(batchForm.sourceQuantity, batchForm.packsPerUnit) : '—'}
                          </span>
                        </div>
                      </div>

                      {batchForm.autoCalculate && batchForm.packsPerUnit && (
                        <div className="calculator-note">
                          <Info size={14} />
                          <span>Output quantity will update automatically based on this calculation</span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="repacking-section">
                  <div className="source-locked-info">
                    <AlertCircle size={16} />
                    <div>
                      <strong>Source: {batchModal.source}</strong>
                      <p>Source inventory has already been deducted and cannot be changed.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Output Section */}
              <div className="repacking-section">
                <div className="repacking-section__header">
                  <PackagePlus size={16} />
                  <h4>Output Specification</h4>
                </div>

                <div className="form-row">
                  <label className="form-label-enhanced">
                    Output Item Name <span className="required">*</span>
                    <input 
                      required 
                      value={batchForm.output} 
                      onChange={(e) => setBatchForm({ ...batchForm, output: e.target.value })} 
                      placeholder="e.g., Family Relief Packs"
                      className="form-input-enhanced"
                    />
                  </label>
                </div>

                <div className="form-row form-row--3">
                  <label className="form-label-enhanced">
                    Output Quantity <span className="required">*</span>
                    <input 
                      type="number" 
                      min="1" 
                      required 
                      value={batchForm.quantity} 
                      onChange={(e) => setBatchForm({ ...batchForm, quantity: e.target.value })}
                      placeholder="Number of packs"
                      className="form-input-enhanced"
                      disabled={batchForm.autoCalculate && batchForm.packsPerUnit}
                    />
                  </label>
                  <label className="form-label-enhanced">
                    Unit
                    <input 
                      value={batchForm.outputUnit} 
                      onChange={(e) => setBatchForm({ ...batchForm, outputUnit: e.target.value })}
                      placeholder="packs"
                      className="form-input-enhanced"
                    />
                  </label>
                  {batchForm.quantity && batchForm.sourceQuantity && (
                    <div className="efficiency-indicator">
                      <span className="efficiency-label">Efficiency:</span>
                      <span className="efficiency-value">
                        {(Number(batchForm.quantity) / Number(batchForm.sourceQuantity)).toFixed(2)}x
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Assignment Section */}
              <div className="repacking-section">
                <div className="repacking-section__header">
                  <Users size={16} />
                  <h4>Assignment & Schedule</h4>
                </div>

                <div className="form-row">
                  <label className="form-label-enhanced">
                    Assign To
                    <select
                      value={batchForm.assignedType}
                      onChange={(e) => {
                        setBatchForm({ ...batchForm, assignedType: e.target.value, assignedTo: '' })
                      }}
                      className="form-select-enhanced"
                    >
                      <option value="">Select team type...</option>
                      <option value="staff">Staff Member</option>
                      <option value="volunteer">Volunteer</option>
                      <option value="custom">Enter Custom Name</option>
                    </select>
                  </label>
                </div>

                {batchForm.assignedType === 'staff' && (
                  <div className="form-row">
                    <label className="form-label-enhanced">
                      Staff Member
                      <select
                        value={batchForm.assignedTo}
                        onChange={(e) => setBatchForm({ ...batchForm, assignedTo: e.target.value })}
                        className="form-select-enhanced"
                        disabled={loadingTeam}
                      >
                        <option value="">Select staff member...</option>
                        {staff.map((s) => (
                          <option key={s.id} value={s.name}>
                            {s.name} {s.department && `(${s.department})`}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}

                {batchForm.assignedType === 'volunteer' && (
                  <div className="form-row">
                    <label className="form-label-enhanced">
                      Volunteer
                      <select
                        value={batchForm.assignedTo}
                        onChange={(e) => setBatchForm({ ...batchForm, assignedTo: e.target.value })}
                        className="form-select-enhanced"
                        disabled={loadingTeam}
                      >
                        <option value="">Select volunteer...</option>
                        {volunteers.map((v) => (
                          <option key={v.id} value={v.name}>
                            {v.name} {v.skills && `— ${v.skills.slice(0, 2).join(', ')}`}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}

                {batchForm.assignedType === 'custom' && (
                  <div className="form-row">
                    <label className="form-label-enhanced">
                      Team Name
                      <input
                        value={batchForm.assignedTo}
                        onChange={(e) => setBatchForm({ ...batchForm, assignedTo: e.target.value })}
                        placeholder="e.g., Volunteer Team A, Logistics Crew"
                        className="form-input-enhanced"
                      />
                    </label>
                  </div>
                )}

                <div className="form-row">
                  <label className="form-label-enhanced">
                    Due Date
                    <input 
                      type="date" 
                      value={batchForm.dueDate} 
                      onChange={(e) => setBatchForm({ ...batchForm, dueDate: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                      className="form-input-enhanced"
                    />
                  </label>
                </div>
              </div>

              {/* Notes Section */}
              <div className="repacking-section">
                <label className="form-label-enhanced">
                  Additional Notes
                  <textarea 
                    rows={3} 
                    value={batchForm.notes} 
                    onChange={(e) => setBatchForm({ ...batchForm, notes: e.target.value })}
                    placeholder="Special instructions, handling notes, etc."
                    className="form-textarea-enhanced"
                  />
                </label>
              </div>

              <div className="admin-modal__actions">
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'Saving...' : batchModal === 'create' ? 'Create Batch' : 'Save Changes'}
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setBatchModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Multi-Source Repacking Modal */}
      {multiSourceModal && (
        <MultiSourceRepackingModal
          onClose={() => setMultiSourceModal(false)}
          onSubmit={handleMultiSourceSubmit}
          items={items}
          beneficiaries={beneficiaries}
          staff={staff}
          volunteers={volunteers}
          loadingTeam={loadingTeam}
        />
      )}
    </>
  )
}
