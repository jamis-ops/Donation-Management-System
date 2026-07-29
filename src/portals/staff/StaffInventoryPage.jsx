import { useState, useMemo } from 'react'
import { Package, AlertTriangle, TrendingUp, TrendingDown, Search, Filter, Plus, Minus, Download, BarChart3, Eye } from 'lucide-react'
import ApiState from '../../components/admin/shared/ApiState'
import { getPortalData, inventoryApi } from '../../api/resources'
import { useApiObject } from '../../hooks/useApiList'
import { notify } from '../../utils/toast'

export default function StaffInventoryPage() {
  const { data: portalData, loading, error, reload } = useApiObject(() => getPortalData())
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState(null)
  const [showStockModal, setShowStockModal] = useState(false)
  const [stockAction, setStockAction] = useState('add')
  const [stockAmount, setStockAmount] = useState('')
  const [stockNotes, setStockNotes] = useState('')

  const inventory = portalData?.inventory || []
  const alerts = portalData?.inventoryAlerts || []

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      if (filterCategory !== 'all' && item.category !== filterCategory) return false
      if (filterStatus !== 'all' && item.status !== filterStatus) return false
      if (searchQuery && !item.item.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })
  }, [inventory, filterCategory, filterStatus, searchQuery])

  const categories = [...new Set(inventory.map(i => i.category))]
  const statuses = ['Critical', 'Low Stock', 'Adequate']

  const categorySummary = portalData?.inventoryByCategory || []

  const totalValue = inventory.reduce((sum, item) => {
    return sum + (item.currentStock * item.costPerUnit)
  }, 0)

  const getStatusColor = (status) => {
    switch (status) {
      case 'Critical': return '#dc2626'
      case 'Low Stock': return '#f59e0b'
      case 'Adequate': return '#16a34a'
      default: return '#6b7280'
    }
  }

  const getCategoryColor = (category) => {
    const colors = {
      'Food': '#f59e0b',
      'Hygiene': '#3b82f6',
      'Medical': '#dc2626',
      'Education': '#8b5cf6',
      'Clothing': '#10b981',
    }
    return colors[category] || '#6b7280'
  }

  const handleStockUpdate = async () => {
    if (!stockAmount || isNaN(stockAmount)) {
      notify.warning('Please enter a valid amount')
      return
    }
    const amount = parseInt(stockAmount, 10)
    const current = Number(selectedItem.currentStock ?? selectedItem.quantity ?? 0)
    const newStock = stockAction === 'add'
      ? current + amount
      : current - amount

    if (newStock < 0) {
      notify.warning('Cannot remove more stock than available')
      return
    }
    if (!selectedItem.dbId) {
      notify.warning('Missing inventory item id')
      return
    }

    try {
      await inventoryApi.update(selectedItem.dbId, {
        quantity: newStock,
        notes: stockNotes || undefined,
      })
      notify.success('Stock updated.')
      setShowStockModal(false)
      setStockAmount('')
      setStockNotes('')
      setSelectedItem(null)
      reload()
    } catch (err) {
      notify.error(err.message || 'Failed to update stock')
    }
  }

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      {portalData && (
        <div className="staff-inventory-page">
          {/* Summary Cards */}
          <div className="staff-inventory-summary">
            <div className="staff-inventory-summary__card staff-inventory-summary__card--total">
              <Package size={24} />
              <div>
                <span className="staff-inventory-summary__value">{inventory.length}</span>
                <span className="staff-inventory-summary__label">Total Items</span>
              </div>
            </div>
            <div className="staff-inventory-summary__card staff-inventory-summary__card--critical">
              <AlertTriangle size={24} />
              <div>
                <span className="staff-inventory-summary__value">{alerts.filter(a => a.severity === 'Critical').length}</span>
                <span className="staff-inventory-summary__label">Critical Items</span>
              </div>
            </div>
            <div className="staff-inventory-summary__card staff-inventory-summary__card--low">
              <TrendingDown size={24} />
              <div>
                <span className="staff-inventory-summary__value">{alerts.filter(a => a.severity === 'Low').length}</span>
                <span className="staff-inventory-summary__label">Low Stock</span>
              </div>
            </div>
            <div className="staff-inventory-summary__card staff-inventory-summary__card--value">
              <BarChart3 size={24} />
              <div>
                <span className="staff-inventory-summary__value">₱{totalValue.toLocaleString()}</span>
                <span className="staff-inventory-summary__label">Total Value</span>
              </div>
            </div>
          </div>

          {/* Alerts Section */}
          {alerts.length > 0 && (
            <section className="portal-panel staff-inventory-alerts-section">
              <div className="portal-panel__header">
                <h2>Inventory Alerts</h2>
                <span className="portal-panel__hint">{alerts.length} items need attention</span>
              </div>
              <div className="staff-inventory-alerts-grid">
                {alerts.map((alert) => (
                  <div 
                    key={alert.item} 
                    className={`staff-inventory-alert-card staff-inventory-alert-card--${alert.severity.toLowerCase()}`}
                  >
                    <div className="staff-inventory-alert-card__header">
                      <AlertTriangle size={20} />
                      <span className="staff-inventory-alert-card__severity">{alert.severity}</span>
                    </div>
                    <h4>{alert.item}</h4>
                    <div className="staff-inventory-alert-card__stock">
                      <span className="staff-inventory-alert-card__current">{alert.currentStock}</span>
                      <span className="staff-inventory-alert-card__separator">/</span>
                      <span className="staff-inventory-alert-card__min">{alert.minStock} units</span>
                    </div>
                    <div className="staff-inventory-alert-card__action">
                      <strong>{alert.action}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Category Summary */}
          {categorySummary.length > 0 && (
            <section className="portal-panel">
              <div className="portal-panel__header">
                <h2>Inventory by Category</h2>
              </div>
              <div className="staff-inventory-category-grid">
                {categorySummary.map((cat) => (
                  <div 
                    key={cat.category} 
                    className="staff-inventory-category-card"
                    onClick={() => setFilterCategory(filterCategory === cat.category ? 'all' : cat.category)}
                  >
                    <div className="staff-inventory-category-card__header">
                      <Package size={20} style={{ color: getCategoryColor(cat.category) }} />
                      <span style={{ 
                        backgroundColor: `${getStatusColor(cat.status)}15`,
                        color: getStatusColor(cat.status)
                      }}>
                        {cat.status}
                      </span>
                    </div>
                    <h3>{cat.category}</h3>
                    <div className="staff-inventory-category-card__stats">
                      <div className="staff-inventory-category-card__stat">
                        <span className="staff-inventory-category-card__stat-value">{cat.items}</span>
                        <span className="staff-inventory-category-card__stat-label">Items</span>
                      </div>
                      <div className="staff-inventory-category-card__stat">
                        <span className="staff-inventory-category-card__stat-value">{cat.totalValue}</span>
                        <span className="staff-inventory-category-card__stat-label">Total Value</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Inventory List */}
          <section className="portal-panel">
            <div className="portal-panel__header">
              <h2>Inventory Management</h2>
              <span className="portal-panel__hint">
                {filteredInventory.length} of {inventory.length} items
              </span>
            </div>

            {/* Filters */}
            <div className="staff-inventory-filters">
              <div className="staff-inventory-filters__search">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Search inventory items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="staff-inventory-filters__input"
                />
              </div>

              <div className="staff-inventory-filters__group">
                <div className="staff-inventory-filters__item">
                  <Filter size={16} />
                  <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                    <option value="all">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="staff-inventory-filters__item">
                  <AlertTriangle size={16} />
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                    <option value="all">All Status</option>
                    {statuses.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>

                <button className="btn btn--secondary btn--sm">
                  <Download size={14} />
                  Export Report
                </button>
              </div>
            </div>

            {/* Inventory Grid */}
            {filteredInventory.length === 0 ? (
              <div className="portal-empty">
                <Package size={48} />
                <p>No inventory items match your filters.</p>
              </div>
            ) : (
              <div className="staff-inventory-items-grid">
                {filteredInventory.map((item) => {
                  const stockPercentage = (item.currentStock / item.maxStock) * 100
                  const needsReorder = item.currentStock <= item.minStock

                  return (
                    <div key={item.id} className="staff-inventory-item-card">
                      <div className="staff-inventory-item-card__header">
                        <span 
                          className="staff-inventory-item-card__category"
                          style={{ 
                            backgroundColor: `${getCategoryColor(item.category)}15`,
                            color: getCategoryColor(item.category)
                          }}
                        >
                          {item.category}
                        </span>
                        <span 
                          className="staff-inventory-item-card__status"
                          style={{ 
                            backgroundColor: `${getStatusColor(item.status)}15`,
                            color: getStatusColor(item.status)
                          }}
                        >
                          {item.status}
                        </span>
                      </div>

                      <h3>{item.item}</h3>

                      <div className="staff-inventory-item-card__stock">
                        <div className="staff-inventory-item-card__stock-info">
                          <span className="staff-inventory-item-card__stock-current">
                            {item.currentStock} {item.unit}
                          </span>
                          <span className="staff-inventory-item-card__stock-range">
                            Min: {item.minStock} • Max: {item.maxStock}
                          </span>
                        </div>
                        <div className="staff-inventory-item-card__stock-bar">
                          <div 
                            className="staff-inventory-item-card__stock-fill"
                            style={{ 
                              width: `${Math.min(stockPercentage, 100)}%`,
                              backgroundColor: getStatusColor(item.status)
                            }}
                          ></div>
                        </div>
                      </div>

                      <div className="staff-inventory-item-card__details">
                        <div className="staff-inventory-item-card__detail">
                          <strong>Location:</strong>
                          <span>{item.location}</span>
                        </div>
                        <div className="staff-inventory-item-card__detail">
                          <strong>Cost/Unit:</strong>
                          <span>₱{item.costPerUnit}</span>
                        </div>
                        <div className="staff-inventory-item-card__detail">
                          <strong>Total Value:</strong>
                          <span>₱{(item.currentStock * item.costPerUnit).toLocaleString()}</span>
                        </div>
                        <div className="staff-inventory-item-card__detail">
                          <strong>Last Updated:</strong>
                          <span>{item.lastUpdated}</span>
                        </div>
                      </div>

                      {needsReorder && (
                        <div className="staff-inventory-item-card__reorder">
                          <AlertTriangle size={14} />
                          <span>Reorder: {item.reorderAmount} {item.unit}</span>
                        </div>
                      )}

                      <div className="staff-inventory-item-card__actions">
                        <button 
                          className="btn btn--sm btn--secondary"
                          onClick={() => setSelectedItem(item)}
                        >
                          <Eye size={14} />
                          View
                        </button>
                        <button 
                          className="btn btn--sm btn--success"
                          onClick={() => {
                            setSelectedItem(item)
                            setStockAction('add')
                            setShowStockModal(true)
                          }}
                        >
                          <Plus size={14} />
                          Add
                        </button>
                        <button 
                          className="btn btn--sm btn--danger"
                          onClick={() => {
                            setSelectedItem(item)
                            setStockAction('remove')
                            setShowStockModal(true)
                          }}
                        >
                          <Minus size={14} />
                          Remove
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Stock Update Modal */}
          {showStockModal && selectedItem && (
            <div className="staff-modal-overlay" onClick={() => setShowStockModal(false)}>
              <div className="staff-modal staff-modal--small" onClick={(e) => e.stopPropagation()}>
                <div className="staff-modal__header">
                  <h2>{stockAction === 'add' ? 'Add' : 'Remove'} Stock</h2>
                  <button 
                    className="staff-modal__close"
                    onClick={() => setShowStockModal(false)}
                  >
                    ×
                  </button>
                </div>
                <div className="staff-modal__content">
                  <div className="staff-modal__item-info">
                    <strong>{selectedItem.item}</strong>
                    <span>Current Stock: {selectedItem.currentStock} {selectedItem.unit}</span>
                  </div>

                  <div className="staff-modal__form-group">
                    <label htmlFor="stockAmount">
                      Amount to {stockAction === 'add' ? 'Add' : 'Remove'} *
                    </label>
                    <input
                      id="stockAmount"
                      type="number"
                      min="1"
                      value={stockAmount}
                      onChange={(e) => setStockAmount(e.target.value)}
                      placeholder={`Enter amount in ${selectedItem.unit}`}
                      className="staff-modal__input"
                    />
                  </div>

                  <div className="staff-modal__form-group">
                    <label htmlFor="stockNotes">Notes (Optional)</label>
                    <textarea
                      id="stockNotes"
                      rows="3"
                      value={stockNotes}
                      onChange={(e) => setStockNotes(e.target.value)}
                      placeholder="Add notes about this stock update..."
                      className="staff-modal__textarea"
                    />
                  </div>

                  {stockAmount && (
                    <div className="staff-modal__preview">
                      <strong>New Stock Level:</strong>
                      <span className={stockAction === 'add' ? 'text-success' : 'text-danger'}>
                        {stockAction === 'add' 
                          ? selectedItem.currentStock + parseInt(stockAmount)
                          : selectedItem.currentStock - parseInt(stockAmount)
                        } {selectedItem.unit}
                      </span>
                    </div>
                  )}

                  <div className="staff-modal__actions">
                    <button 
                      className={`btn ${stockAction === 'add' ? 'btn--success' : 'btn--danger'}`}
                      onClick={handleStockUpdate}
                    >
                      {stockAction === 'add' ? <Plus size={16} /> : <Minus size={16} />}
                      {stockAction === 'add' ? 'Add' : 'Remove'} Stock
                    </button>
                    <button 
                      className="btn btn--secondary"
                      onClick={() => setShowStockModal(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Item Detail Modal */}
          {selectedItem && !showStockModal && (
            <div className="staff-modal-overlay" onClick={() => setSelectedItem(null)}>
              <div className="staff-modal" onClick={(e) => e.stopPropagation()}>
                <div className="staff-modal__header">
                  <h2>{selectedItem.item}</h2>
                  <button 
                    className="staff-modal__close"
                    onClick={() => setSelectedItem(null)}
                  >
                    ×
                  </button>
                </div>
                <div className="staff-modal__content">
                  <div className="staff-modal__badges">
                    <span style={{ backgroundColor: `${getCategoryColor(selectedItem.category)}15`, color: getCategoryColor(selectedItem.category) }}>
                      {selectedItem.category}
                    </span>
                    <span style={{ backgroundColor: `${getStatusColor(selectedItem.status)}15`, color: getStatusColor(selectedItem.status) }}>
                      {selectedItem.status}
                    </span>
                  </div>

                  <div className="staff-modal__section">
                    <h3>Stock Information</h3>
                    <div className="staff-modal__grid">
                      <div className="staff-modal__field">
                        <strong>Current Stock:</strong>
                        <span>{selectedItem.currentStock} {selectedItem.unit}</span>
                      </div>
                      <div className="staff-modal__field">
                        <strong>Minimum Stock:</strong>
                        <span>{selectedItem.minStock} {selectedItem.unit}</span>
                      </div>
                      <div className="staff-modal__field">
                        <strong>Maximum Stock:</strong>
                        <span>{selectedItem.maxStock} {selectedItem.unit}</span>
                      </div>
                      <div className="staff-modal__field">
                        <strong>Reorder Amount:</strong>
                        <span>{selectedItem.reorderAmount} {selectedItem.unit}</span>
                      </div>
                    </div>
                  </div>

                  <div className="staff-modal__section">
                    <h3>Financial Information</h3>
                    <div className="staff-modal__grid">
                      <div className="staff-modal__field">
                        <strong>Cost per Unit:</strong>
                        <span>₱{selectedItem.costPerUnit}</span>
                      </div>
                      <div className="staff-modal__field">
                        <strong>Total Value:</strong>
                        <span>₱{(selectedItem.currentStock * selectedItem.costPerUnit).toLocaleString()}</span>
                      </div>
                      <div className="staff-modal__field">
                        <strong>Supplier:</strong>
                        <span>{selectedItem.supplier}</span>
                      </div>
                    </div>
                  </div>

                  <div className="staff-modal__section">
                    <h3>Storage Information</h3>
                    <div className="staff-modal__grid">
                      <div className="staff-modal__field">
                        <strong>Location:</strong>
                        <span>{selectedItem.location}</span>
                      </div>
                      <div className="staff-modal__field">
                        <strong>Last Updated:</strong>
                        <span>{selectedItem.lastUpdated}</span>
                      </div>
                    </div>
                  </div>

                  <div className="staff-modal__actions">
                    <button 
                      className="btn btn--success"
                      onClick={() => {
                        setStockAction('add')
                        setShowStockModal(true)
                      }}
                    >
                      <Plus size={16} />
                      Add Stock
                    </button>
                    <button 
                      className="btn btn--danger"
                      onClick={() => {
                        setStockAction('remove')
                        setShowStockModal(true)
                      }}
                    >
                      <Minus size={16} />
                      Remove Stock
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </ApiState>
  )
}
