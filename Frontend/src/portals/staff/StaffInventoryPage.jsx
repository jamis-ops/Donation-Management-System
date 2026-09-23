import { useState, useMemo } from 'react'
import {
  Package,
  AlertTriangle,
  TrendingUp,
  Search,
  Plus,
  Minus,
  Eye,
  CheckCircle2,
  DollarSign,
  Boxes,
} from 'lucide-react'
import StatusBadge from '../../admin/components/shared/StatusBadge'
import ModalHeader from '../../admin/components/shared/ModalHeader'
import ApiState from '../../admin/components/shared/ApiState'
import { inventoryApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { usePagination, DEFAULT_PAGE_SIZE } from '../../hooks/usePagination'
import Pagination from '../../admin/components/shared/Pagination'
import ExportMenu from '../../admin/components/shared/ExportMenu'
import { notify, confirmAction, showSuccessModal } from '../../utils/confirm'
import { useLoading } from '../../context/LoadingContext'

export default function StaffInventoryPage() {
  const { showLoading, hideLoading } = useLoading()
  const { data: inventory = [], loading, error, reload } = useApiList(() => inventoryApi.list())

  const [filterCategory, setFilterCategory] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState(null)
  const [showStockModal, setShowStockModal] = useState(false)
  const [stockAction, setStockAction] = useState('add')
  const [stockAmount, setStockAmount] = useState('')
  const [stockNotes, setStockNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const categories = useMemo(() => {
    const set = new Set(['Food', 'Hygiene', 'Medical', 'Education', 'Clothing'])
    inventory.forEach((i) => {
      if (i.category) set.add(i.category)
    })
    return Array.from(set)
  }, [inventory])

  // Count summaries
  const stats = useMemo(() => {
    const totalItems = inventory.length
    const critical = inventory.filter((i) => i.status === 'Critical' || i.stockLevel === 'critical').length
    const low = inventory.filter((i) => i.status === 'Low' || i.status === 'Low Stock' || i.stockLevel === 'low').length
    const totalVal = inventory.reduce((acc, i) => acc + (Number(i.totalValue) || (Number(i.currentStock || i.quantity || 0) * (Number(i.costPerUnit) || 50))), 0)
    return { totalItems, critical, low, totalVal }
  }, [inventory])

  // Filter items
  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      if (filterCategory !== 'all' && item.category !== filterCategory) return false

      if (filterStatus !== 'all') {
        const itemStatus = String(item.status || '').toLowerCase()
        const target = filterStatus.toLowerCase()
        if (target === 'low' && !itemStatus.includes('low')) return false
        if (target === 'critical' && !itemStatus.includes('critical')) return false
        if (target === 'sufficient' && !itemStatus.includes('sufficient') && !itemStatus.includes('normal') && !itemStatus.includes('adequate')) return false
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchName = item.item?.toLowerCase().includes(q)
        const matchCat = item.category?.toLowerCase().includes(q)
        const matchLoc = item.location?.toLowerCase().includes(q)
        const matchSupp = item.supplier?.toLowerCase().includes(q)
        if (!matchName && !matchCat && !matchLoc && !matchSupp) return false
      }

      return true
    })
  }, [inventory, filterCategory, filterStatus, searchQuery])

  const paging = usePagination(filteredInventory, DEFAULT_PAGE_SIZE, `${filterCategory}|${filterStatus}|${searchQuery}`)

  const exportColumns = useMemo(
    () => [
      { key: 'item', label: 'Item Name', exportValue: (i) => i.item || '—' },
      { key: 'category', label: 'Category' },
      { key: 'currentStock', label: 'Current Stock', exportValue: (i) => `${i.currentStock ?? i.quantity ?? 0} ${i.unit || 'units'}`.trim() },
      { key: 'minStock', label: 'Min Level', exportValue: (i) => i.minStock ?? i.lowStockThreshold ?? 0 },
      { key: 'maxStock', label: 'Max Level', exportValue: (i) => i.maxStock ?? 0 },
      { key: 'reorderAmount', label: 'Reorder Amount', exportValue: (i) => `${i.reorderAmount ?? 0} ${i.unit || 'units'}` },
      { key: 'status', label: 'Status' },
      { key: 'costPerUnit', label: 'Cost/Unit', exportValue: (i) => `₱${Number(i.costPerUnit || 0).toFixed(2)}` },
      { key: 'totalValue', label: 'Total Value', exportValue: (i) => `₱${Number(i.totalValue || 0).toFixed(2)}` },
      { key: 'supplier', label: 'Supplier', exportValue: (i) => i.supplier || '—' },
      { key: 'location', label: 'Storage Location', exportValue: (i) => i.location || 'Warehouse' },
      { key: 'lastUpdated', label: 'Last Updated', exportValue: (i) => i.lastUpdated || '—' },
    ],
    []
  )

  const getStatusColor = (status) => {
    const s = String(status || '').toLowerCase()
    if (s.includes('critical')) return '#dc2626'
    if (s.includes('low')) return '#f59e0b'
    return '#10b981'
  }

  const getCategoryColor = (category) => {
    const colors = {
      Food: '#f59e0b',
      Hygiene: '#3b82f6',
      Medical: '#dc2626',
      Education: '#8b5cf6',
      Clothing: '#10b981',
      Water: '#0284c7',
    }
    return colors[category] || '#64748b'
  }

  const openStockModal = (item, action) => {
    setSelectedItem(item)
    setStockAction(action)
    setStockAmount('')
    setStockNotes('')
    setShowStockModal(true)
  }

  const handleStockUpdate = async () => {
    if (!stockAmount || isNaN(stockAmount) || Number(stockAmount) <= 0) {
      notify.warning('Please enter a valid positive quantity.')
      return
    }
    const amount = parseInt(stockAmount, 10)
    const current = Number(selectedItem.currentStock ?? selectedItem.quantity ?? 0)
    const newStock = stockAction === 'add' ? current + amount : current - amount

    if (newStock < 0) {
      notify.warning('Cannot remove more stock than currently available.')
      return
    }
    if (!selectedItem.dbId) {
      notify.warning('Missing inventory item id.')
      return
    }

    const actionLabel = stockAction === 'add' ? 'Add' : 'Remove'
    const ok = await confirmAction({
      title: `${actionLabel} Stock`,
      message: `${actionLabel} ${amount} ${selectedItem.unit || 'units'} for "${selectedItem.item}"? This will update warehouse inventory immediately.`,
      confirmText: `${actionLabel} Stock`,
      type: stockAction === 'remove' ? 'warning' : 'primary',
    })
    if (!ok) return

    setBusy(true)
    showLoading('Saving changes…')
    try {
      const res = await inventoryApi.update(selectedItem.dbId, {
        quantity: newStock,
        notes: stockNotes || undefined,
      })
      showSuccessModal(`Stock successfully updated to ${newStock} ${selectedItem.unit || 'units'}.`)
      setShowStockModal(false)
      setStockAmount('')
      setStockNotes('')
      if (selectedItem) {
        setSelectedItem(res?.data || { ...selectedItem, currentStock: newStock, quantity: newStock })
      }
      reload()
    } catch (err) {
      notify.error(err.message || 'Failed to update stock')
    } finally {
      hideLoading()
      setBusy(false)
    }
  }

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      <div className="staff-inventory-page">
        {/* Metric Summary Cards */}
        <div className="staff-inventory-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          <div className="staff-inventory-summary__card staff-inventory-summary__card--total" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: '#f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={22} />
            </div>
            <div>
              <span className="staff-inventory-summary__value" style={{ fontSize: '1.4rem', fontWeight: 700, display: 'block', color: '#0f172a' }}>{stats.totalItems}</span>
              <span className="staff-inventory-summary__label" style={{ fontSize: '0.8rem', color: '#64748b' }}>Total Tracked Items</span>
            </div>
          </div>

          <div className="staff-inventory-summary__card staff-inventory-summary__card--critical" style={{ background: '#fff', border: '1px solid #fee2e2', borderRadius: '8px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={22} />
            </div>
            <div>
              <span className="staff-inventory-summary__value" style={{ fontSize: '1.4rem', fontWeight: 700, display: 'block', color: '#dc2626' }}>{stats.critical}</span>
              <span className="staff-inventory-summary__label" style={{ fontSize: '0.8rem', color: '#64748b' }}>Critical Depleted</span>
            </div>
          </div>

          <div className="staff-inventory-summary__card" style={{ background: '#fff', border: '1px solid #fef3c7', borderRadius: '8px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Boxes size={22} />
            </div>
            <div>
              <span className="staff-inventory-summary__value" style={{ fontSize: '1.4rem', fontWeight: 700, display: 'block', color: '#d97706' }}>{stats.low}</span>
              <span className="staff-inventory-summary__label" style={{ fontSize: '0.8rem', color: '#64748b' }}>Low Stock Warning</span>
            </div>
          </div>

          <div className="staff-inventory-summary__card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={22} />
            </div>
            <div>
              <span className="staff-inventory-summary__value" style={{ fontSize: '1.3rem', fontWeight: 700, display: 'block', color: '#059669' }}>
                ₱{stats.totalVal.toLocaleString('en-PH', { maximumFractionDigits: 0 })}
              </span>
              <span className="staff-inventory-summary__label" style={{ fontSize: '0.8rem', color: '#64748b' }}>Total Stock Valuation</span>
            </div>
          </div>
        </div>

        {/* Inventory Panel */}
        <section className="portal-panel">
          <div className="portal-panel__header" style={{ flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
            <div>
              <h2>Current Stock Levels</h2>
              <span className="portal-panel__hint">
                Showing {filteredInventory.length} of {inventory.length} items
              </span>
            </div>

            {/* Filter and Search Bar */}
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ width: '260px', position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                <input
                  type="text"
                  className="portal-search-input"
                  style={{
                    paddingLeft: '36px',
                    paddingRight: '12px',
                    width: '100%',
                    height: '38px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                  placeholder="Search inventory items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select
                className="portal-select"
                style={{ height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', background: '#fff', fontSize: '0.85rem' }}
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <select
                className="portal-select"
                style={{ height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', background: '#fff' }}
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="sufficient">Sufficient</option>
                <option value="low">Low Stock</option>
                <option value="critical">Critical</option>
              </select>

              <ExportMenu
                items={filteredInventory}
                columns={exportColumns}
                baseFilename="staff_inventory_report"
                title="Staff Inventory Report"
              />
            </div>
          </div>

          {filteredInventory.length === 0 ? (
            <div className="portal-empty" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
              <Package size={40} style={{ margin: '0 auto 0.75rem', color: '#94a3b8' }} />
              <p style={{ margin: 0, fontWeight: 600, color: '#334155' }}>No inventory items found</p>
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Try adjusting your search query or filters.</span>
            </div>
          ) : (
            <>
              {/* Item Cards Grid */}
              <div className="staff-inventory-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                {paging.pageItems.map((item) => {
                  const qty = Number(item.currentStock ?? item.quantity ?? 0)
                  const min = Number(item.minStock ?? item.lowStockThreshold ?? 10)
                  const max = Number(item.maxStock ?? min * 4 ?? 100)
                  const unit = item.unit || 'pcs'
                  const stockPercentage = Math.min(100, Math.round((qty / (max || 1)) * 100))
                  const needsReorder = qty <= min
                  const reorderAmount = Number(item.reorderAmount) > 0 ? item.reorderAmount : Math.max(10, min * 2 - qty)
                  const cost = Number(item.costPerUnit) || 50
                  const totalVal = qty * cost

                  return (
                    <div
                      key={item.dbId || item.id}
                      className="staff-inventory-item-card"
                      style={{
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: '1.1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      }}
                    >
                      <div>
                        {/* Top Badges */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor: `${getCategoryColor(item.category)}15`,
                              color: getCategoryColor(item.category),
                              border: `1px solid ${getCategoryColor(item.category)}30`,
                            }}
                          >
                            {item.category || 'General'}
                          </span>
                          <StatusBadge status={item.status} />
                        </div>

                        {/* Title */}
                        <h3 style={{ margin: '0 0 0.85rem', fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.35 }}>
                          {item.item}
                        </h3>

                        {/* Stock Display & Range Bar */}
                        <div style={{ marginBottom: '0.85rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.35rem' }}>
                            <span style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
                              {qty.toLocaleString()} <span style={{ fontSize: '0.95rem', fontWeight: 500, color: '#64748b' }}>{unit}</span>
                            </span>
                            <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                              Min: {min} • Max: {max}
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '7px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${Math.max(5, stockPercentage)}%`,
                                height: '100%',
                                background: getStatusColor(item.status),
                                borderRadius: '999px',
                              }}
                            />
                          </div>
                        </div>

                        {/* Metadata Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', fontSize: '0.78rem', background: '#f8fafc', padding: '0.65rem', borderRadius: '6px', border: '1px solid #f1f5f9', marginBottom: '0.85rem' }}>
                          <div>
                            <span style={{ color: '#64748b', display: 'block', fontSize: '0.68rem', textTransform: 'uppercase', fontWeight: 600 }}>Location:</span>
                            <span style={{ fontWeight: 600, color: '#1e293b' }}>{item.location || 'Warehouse'}</span>
                          </div>
                          <div>
                            <span style={{ color: '#64748b', display: 'block', fontSize: '0.68rem', textTransform: 'uppercase', fontWeight: 600 }}>Cost/Unit:</span>
                            <span style={{ fontWeight: 600, color: '#1e293b' }}>₱{cost.toFixed(2)}</span>
                          </div>
                          <div>
                            <span style={{ color: '#64748b', display: 'block', fontSize: '0.68rem', textTransform: 'uppercase', fontWeight: 600 }}>Total Value:</span>
                            <span style={{ fontWeight: 600, color: '#047857' }}>₱{totalVal.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</span>
                          </div>
                          <div>
                            <span style={{ color: '#64748b', display: 'block', fontSize: '0.68rem', textTransform: 'uppercase', fontWeight: 600 }}>Last Updated:</span>
                            <span style={{ color: '#1e293b' }}>{item.lastUpdated || '—'}</span>
                          </div>
                        </div>

                        {/* Reorder Box (fixed: never blank) */}
                        {needsReorder && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              background: '#fffbeb',
                              border: '1px solid #fde68a',
                              color: '#b45309',
                              padding: '0.45rem 0.65rem',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              marginBottom: '0.85rem',
                            }}
                          >
                            <AlertTriangle size={14} color="#d97706" />
                            <span>Reorder: {reorderAmount} {unit}</span>
                          </div>
                        )}
                      </div>

                      {/* Card Action Buttons */}
                      <div style={{ display: 'flex', gap: '0.4rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                        <button
                          type="button"
                          className="btn btn--sm btn--outline"
                          style={{ flex: 1 }}
                          onClick={() => setSelectedItem(item)}
                        >
                          <Eye size={14} /> View
                        </button>
                        <button
                          type="button"
                          className="btn btn--sm btn--primary"
                          style={{ flex: 1 }}
                          onClick={() => openStockModal(item, 'add')}
                        >
                          <Plus size={14} /> Add
                        </button>
                        <button
                          type="button"
                          className="btn btn--sm btn--danger"
                          style={{ flex: 1 }}
                          onClick={() => openStockModal(item, 'remove')}
                        >
                          <Minus size={14} /> Remove
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <Pagination
                page={paging.page}
                totalPages={paging.totalPages}
                total={paging.total}
                startIndex={paging.startIndex}
                endIndex={paging.endIndex}
                onPageChange={paging.setPage}
                className="pagination--portal"
                noun="items"
              />
            </>
          )}
        </section>

        {/* Item Detail Modal */}
        {selectedItem && !showStockModal && (
          <div className="admin-modal-overlay" onClick={() => setSelectedItem(null)}>
            <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
              <ModalHeader
                title={selectedItem.item}
                onClose={() => setSelectedItem(null)}
              />

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
                <span
                  style={{
                    backgroundColor: `${getCategoryColor(selectedItem.category)}15`,
                    color: getCategoryColor(selectedItem.category),
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                >
                  {selectedItem.category || 'General'}
                </span>
                <StatusBadge status={selectedItem.status} />
              </div>

              {/* Section 1: Stock Information */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                <h4 style={{ margin: '0 0 0.65rem', fontSize: '0.85rem', textTransform: 'uppercase', color: '#475569', fontWeight: 700 }}>
                  Stock Information
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>CURRENT STOCK</span>
                    <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>
                      {Number(selectedItem.currentStock ?? selectedItem.quantity ?? 0).toLocaleString()} {selectedItem.unit || 'pcs'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>MINIMUM STOCK</span>
                    <strong style={{ fontSize: '1rem', color: '#0f172a' }}>
                      {selectedItem.minStock ?? selectedItem.lowStockThreshold ?? 10} {selectedItem.unit || 'pcs'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>MAXIMUM CAPACITY</span>
                    <strong style={{ fontSize: '1rem', color: '#0f172a' }}>
                      {selectedItem.maxStock ?? 50} {selectedItem.unit || 'pcs'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>REORDER AMOUNT</span>
                    <strong style={{ fontSize: '1rem', color: '#b45309' }}>
                      {Number(selectedItem.reorderAmount) > 0 ? selectedItem.reorderAmount : Math.max(10, (selectedItem.minStock || 10) * 2 - (selectedItem.currentStock || 0))} {selectedItem.unit || 'pcs'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Section 2: Financial Information */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                <h4 style={{ margin: '0 0 0.65rem', fontSize: '0.85rem', textTransform: 'uppercase', color: '#475569', fontWeight: 700 }}>
                  Financial Information
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>COST PER UNIT</span>
                    <strong style={{ fontSize: '1rem', color: '#0f172a' }}>
                      ₱{(Number(selectedItem.costPerUnit) || 50).toFixed(2)}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>TOTAL VALUE</span>
                    <strong style={{ fontSize: '1.05rem', color: '#047857' }}>
                      ₱{((Number(selectedItem.currentStock ?? selectedItem.quantity ?? 0)) * (Number(selectedItem.costPerUnit) || 50)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>SUPPLIER</span>
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>
                      {selectedItem.supplier || 'Rise Above Logistics / Community Donors'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 3: Storage Information */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginBottom: '1.25rem' }}>
                <h4 style={{ margin: '0 0 0.65rem', fontSize: '0.85rem', textTransform: 'uppercase', color: '#475569', fontWeight: 700 }}>
                  Storage Information
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>LOCATION</span>
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>{selectedItem.location || 'Warehouse Shelf A-1'}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>LAST UPDATED</span>
                    <span style={{ color: '#1e293b' }}>{selectedItem.lastUpdated || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="admin-modal__actions" style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                <button type="button" className="btn btn--ghost" onClick={() => setSelectedItem(null)}>
                  Close
                </button>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => {
                      setStockAction('add')
                      setShowStockModal(true)
                    }}
                  >
                    <Plus size={16} /> Add Stock
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger"
                    onClick={() => {
                      setStockAction('remove')
                      setShowStockModal(true)
                    }}
                  >
                    <Minus size={16} /> Remove Stock
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stock Update Modal */}
        {showStockModal && selectedItem && (
          <div className="admin-modal-overlay" onClick={() => setShowStockModal(false)}>
            <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
              <ModalHeader
                title={`${stockAction === 'add' ? 'Add Stock' : 'Remove Stock'} – ${selectedItem.item}`}
                onClose={() => setShowStockModal(false)}
              />

              <div style={{ padding: '0.5rem 0' }}>
                <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: '#475569' }}>Current Available:</span>
                  <strong style={{ fontSize: '1rem', color: '#0f172a' }}>
                    {selectedItem.currentStock ?? selectedItem.quantity ?? 0} {selectedItem.unit || 'pcs'}
                  </strong>
                </div>

                <div className="admin-form-group" style={{ marginBottom: '1rem' }}>
                  <label htmlFor="stockAmountInput" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.35rem' }}>
                    Quantity to {stockAction === 'add' ? 'Add' : 'Remove'} ({selectedItem.unit || 'pcs'}) *
                  </label>
                  <input
                    id="stockAmountInput"
                    type="number"
                    min="1"
                    className="admin-input"
                    style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '1rem' }}
                    placeholder={`e.g. 10`}
                    value={stockAmount}
                    onChange={(e) => setStockAmount(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="admin-form-group" style={{ marginBottom: '1rem' }}>
                  <label htmlFor="stockNotesInput" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.35rem' }}>
                    Operational Reason / Notes (Optional)
                  </label>
                  <textarea
                    id="stockNotesInput"
                    rows="2"
                    className="admin-input"
                    style={{ width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '8px 10px', fontSize: '0.85rem' }}
                    placeholder={stockAction === 'add' ? 'e.g. Received new donation batch' : 'e.g. Dispatched for repacking or damaged item write-off'}
                    value={stockNotes}
                    onChange={(e) => setStockNotes(e.target.value)}
                  />
                </div>

                {stockAmount && !isNaN(stockAmount) && Number(stockAmount) > 0 && (
                  <div
                    style={{
                      background: stockAction === 'add' ? '#ecfdf5' : '#fef2f2',
                      border: `1px solid ${stockAction === 'add' ? '#a7f3d0' : '#fecaca'}`,
                      borderRadius: '6px',
                      padding: '0.65rem 0.85rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.85rem',
                      marginBottom: '1rem',
                    }}
                  >
                    <span style={{ color: '#475569' }}>Projected Stock Level:</span>
                    <strong style={{ color: stockAction === 'add' ? '#047857' : '#dc2626' }}>
                      {stockAction === 'add'
                        ? (Number(selectedItem.currentStock ?? selectedItem.quantity ?? 0) + Number(stockAmount))
                        : (Number(selectedItem.currentStock ?? selectedItem.quantity ?? 0) - Number(stockAmount))}{' '}
                      {selectedItem.unit || 'pcs'}
                    </strong>
                  </div>
                )}
              </div>

              <div className="admin-modal__actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowStockModal(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`btn ${stockAction === 'add' ? 'btn--primary' : 'btn--danger'}`}
                  onClick={handleStockUpdate}
                  disabled={busy || !stockAmount || isNaN(stockAmount) || Number(stockAmount) <= 0}
                >
                  {stockAction === 'add' ? <Plus size={16} /> : <Minus size={16} />}
                  {stockAction === 'add' ? 'Confirm Stock Intake' : 'Confirm Stock Deduction'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ApiState>
  )
}
