import { useState } from 'react'
import {
  Package, Lightbulb, CheckCircle, Calculator, AlertCircle,
  Utensils, Droplets, Shirt, Pill, Sparkles, Home, Box, Tag, Search, X,
} from 'lucide-react'

function getItemIcon(itemName = '', category = '') {
  const text = `${itemName} ${category}`.toLowerCase()
  if (text.includes('rice') || text.includes('food') || text.includes('canned') || text.includes('biscuit') || text.includes('noodle') || text.includes('meal') || text.includes('grocer')) return Utensils
  if (text.includes('water') || text.includes('drink') || text.includes('beverage') || text.includes('juice')) return Droplets
  if (text.includes('medicine') || text.includes('med') || text.includes('vitamin') || text.includes('first aid') || text.includes('drug') || text.includes('pharma')) return Pill
  if (text.includes('cloth') || text.includes('shirt') || text.includes('blanket') || text.includes('apparel') || text.includes('towel') || text.includes('wear')) return Shirt
  if (text.includes('hygiene') || text.includes('soap') || text.includes('sanit') || text.includes('kit') || text.includes('diaper') || text.includes('shampoo')) return Sparkles
  if (text.includes('shelter') || text.includes('tarp') || text.includes('tent') || text.includes('mat') || text.includes('build') || text.includes('roof')) return Home
  if (text.includes('box') || text.includes('pack')) return Box
  return Package
}

export default function PackContentBuilder({
  items,
  selectedSources,
  onSourcesChange,
  packName,
  onPackNameChange,
  packQuantity,
  onPackQuantityChange,
  packUnit,
  onPackUnitChange,
  analysisData,
  targetFamilies,
}) {
  const [searchTerm, setSearchTerm] = useState('')

  // Available items in stock
  const allStockItems = (items || []).filter((item) => {
    const available = item.quantity - (item.allocated || 0)
    return available > 0
  })

  // Filtered by search term
  const catalogItems = allStockItems.filter((item) => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      item.item?.toLowerCase().includes(search) ||
      item.category?.toLowerCase().includes(search)
    )
  })

  const handleToggleSource = (item) => {
    const available = item.quantity - (item.allocated || 0)
    const existingIndex = selectedSources.findIndex((s) => s.itemId === item.dbId)

    if (existingIndex >= 0) {
      onSourcesChange(selectedSources.filter((s) => s.itemId !== item.dbId))
    } else {
      const reqPacks = parseInt(packQuantity, 10) || targetFamilies || 1
      const initialQty = Math.min(reqPacks, available)
      const newSource = {
        itemId: item.dbId,
        itemName: item.item,
        category: item.category || '',
        quantity: initialQty > 0 ? initialQty : 1,
        unit: item.unit || 'units',
        available,
      }
      onSourcesChange([...selectedSources, newSource])
    }
  }

  const handleRemoveSource = (itemId) => {
    onSourcesChange(selectedSources.filter((s) => s.itemId !== itemId))
  }

  const handleUpdateQuantity = (itemId, newQuantity) => {
    const val = parseInt(newQuantity, 10)
    const qty = isNaN(val) ? '' : Math.max(0, val)
    onSourcesChange(
      selectedSources.map((s) => (s.itemId === itemId ? { ...s, quantity: qty } : s))
    )
  }

  const handleStepQuantity = (itemId, delta) => {
    onSourcesChange(
      selectedSources.map((s) => {
        if (s.itemId !== itemId) return s
        const current = typeof s.quantity === 'number' ? s.quantity : parseInt(s.quantity, 10) || 0
        const next = Math.max(1, Math.min(current + delta, s.available))
        return { ...s, quantity: next }
      })
    )
  }

  const handleApplySuggestion = (suggestion) => {
    const item = items.find((i) => i.dbId === suggestion.itemId)
    if (!item) return

    const available = item.quantity - (item.allocated || 0)
    const existingIndex = selectedSources.findIndex((s) => s.itemId === suggestion.itemId)
    const reqPacks = parseInt(packQuantity, 10) || targetFamilies || 1
    const targetQty = suggestion.quantity * reqPacks

    if (existingIndex >= 0) {
      const updated = [...selectedSources]
      updated[existingIndex].quantity = Math.min(targetQty, available)
      onSourcesChange(updated)
    } else {
      const newSource = {
        itemId: item.dbId,
        itemName: item.item,
        category: item.category || '',
        quantity: Math.min(targetQty, available),
        unit: item.unit || 'units',
        available,
      }
      onSourcesChange([...selectedSources, newSource])
    }
  }

  const handleApplyAllSuggestions = () => {
    if (!analysisData?.suggestedContents) return

    const newSources = []
    const reqPacks = parseInt(packQuantity, 10) || targetFamilies || 1

    analysisData.suggestedContents.forEach((suggestion) => {
      const item = items.find((i) => i.dbId === suggestion.itemId)
      if (!item) return

      const available = item.quantity - (item.allocated || 0)
      if (available <= 0) return

      newSources.push({
        itemId: item.dbId,
        itemName: item.item,
        category: item.category || '',
        quantity: Math.min(suggestion.quantity * reqPacks, available),
        unit: item.unit || 'units',
        available,
      })
    })

    onSourcesChange(newSources)
  }

  // Calculate total estimated packs based on limiting factor of available stock
  const calculateMaxPacks = () => {
    if (selectedSources.length === 0) return 0
    const reqPacks = parseInt(packQuantity, 10) || 1
    const limits = selectedSources.map((src) => {
      const srcQty = Number(src.quantity) || 0
      if (srcQty <= 0) return 0
      const perPack = srcQty / reqPacks
      if (perPack <= 0) return 0
      return Math.floor((src.available || 0) / perPack)
    })

    return limits.length > 0 ? Math.min(...limits) : 0
  }

  const maxPacksFromStock = calculateMaxPacks()
  const packQuantityNum = parseInt(packQuantity, 10) || 0

  return (
    <div className="pack-builder">
      {/* 1. Pack Configuration */}
      <div className="builder-section">
        <div className="section-header">
          <Calculator size={18} />
          <h3>Pack Configuration</h3>
        </div>

        <div className="pack-config-grid">
          <div className="config-field full-width">
            <label className="form-label-enhanced">
              Pack Name <span className="required">*</span>
            </label>
            <input
              type="text"
              value={packName}
              onChange={(e) => onPackNameChange(e.target.value)}
              placeholder="e.g., Family Relief Pack (Rice + Hygiene Kits)"
              className="form-input-enhanced"
              required
            />
          </div>

          <div className="config-field">
            <label className="form-label-enhanced">
              Number of Packs <span className="required">*</span>
            </label>
            <input
              type="number"
              min="1"
              value={packQuantity}
              onChange={(e) => onPackQuantityChange(e.target.value)}
              placeholder="Enter quantity"
              className="form-input-enhanced"
              required
            />
            {targetFamilies > 0 && (
              <div className="field-hint">Target Barangay Need: {targetFamilies} families</div>
            )}
          </div>

          <div className="config-field">
            <label className="form-label-enhanced">Unit</label>
            <input
              type="text"
              value={packUnit}
              onChange={(e) => onPackUnitChange(e.target.value)}
              placeholder="packs"
              className="form-input-enhanced"
            />
          </div>
        </div>
      </div>

      {/* 2. Smart Suggestions */}
      {analysisData?.suggestedContents && analysisData.suggestedContents.length > 0 && (
        <div className="builder-section suggestions-section">
          <div className="section-header">
            <Lightbulb size={18} />
            <h3>Smart Suggestions Based on Barangay Needs</h3>
          </div>
          <div className="suggestions-list">
            {analysisData.suggestedContents.map((suggestion, idx) => {
              const IconComp = getItemIcon(suggestion.item)
              const isAdded = selectedSources.some((s) => s.itemId === suggestion.itemId)
              return (
                <div key={idx} className={`suggestion-item ${isAdded ? 'suggestion-applied' : ''}`}>
                  <div className="suggestion-info">
                    <div className="suggestion-icon-wrap">
                      <IconComp size={16} />
                    </div>
                    <div>
                      <div className="suggestion-name">{suggestion.item}</div>
                      <div className="suggestion-meta">
                        {suggestion.quantity} {suggestion.unit} per pack × {targetFamilies || 1} families
                        <span className="suggestion-priority">Priority: {suggestion.priority}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`btn btn--sm ${isAdded ? 'btn--secondary' : 'btn--outline'}`}
                    onClick={() => handleApplySuggestion(suggestion)}
                  >
                    {isAdded ? '✓ Updated' : '+ Add to Pack'}
                  </button>
                </div>
              )
            })}
          </div>
          <button
            type="button"
            className="btn btn--outline btn-apply-all"
            onClick={handleApplyAllSuggestions}
          >
            Apply All Suggestions ({analysisData.suggestedContents.length} items)
          </button>
        </div>
      )}

      {/* 3. Available Inventory Catalog (NeedsPicker-style tile grid) */}
      <div className="builder-section catalog-picker-section">
        <div className="section-header">
          <Tag size={18} />
          <h3>Available Inventory</h3>
        </div>

        <div className="catalog-search-bar">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search inventory by name or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input-enhanced catalog-search-input"
          />
          {searchTerm && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearchTerm('')}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="inventory-tile-grid" role="group" aria-label="Select inventory items">
          {catalogItems.length === 0 ? (
            <div className="empty-catalog-hint">
              {searchTerm ? 'No matching inventory items found.' : 'No available stock in inventory.'}
            </div>
          ) : (
            catalogItems.map((item) => {
              const available = item.quantity - (item.allocated || 0)
              const isSelected = selectedSources.some((s) => s.itemId === item.dbId)
              const IconComp = getItemIcon(item.item, item.category)

              return (
                <div
                  key={item.dbId}
                  className={`inventory-tile ${isSelected ? 'inventory-tile--active' : ''}`}
                  onClick={() => handleToggleSource(item)}
                  role="checkbox"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleToggleSource(item)}
                >
                  <span className="inventory-tile__icon">
                    <IconComp size={16} strokeWidth={2} />
                  </span>
                  <span className="inventory-tile__label">{item.item}</span>
                  <span className="inventory-tile__stock">
                    {available} {item.unit}
                  </span>
                  {isSelected && (
                    <span className="inventory-tile__check" aria-hidden="true">✓</span>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 4. Selected Pack Contents (Chip/Card Grid) */}
      <div className="builder-section">
        <div className="section-header">
          <Package size={18} />
          <h3>
            Selected Pack Contents
            <span className="count-badge">{selectedSources.length} items</span>
          </h3>
        </div>

        {selectedSources.length === 0 ? (
          <div className="empty-sources-chips">
            <Package size={36} />
            <div>
              <strong>No inventory items selected yet</strong>
              <p>Click on tiles above to add items to your relief pack, or use smart suggestions.</p>
            </div>
          </div>
        ) : (
          <div className="selected-chips-grid">
            {selectedSources.map((source) => {
              const IconComponent = getItemIcon(source.itemName, source.category)
              const qtyNum = Number(source.quantity) || 0
              const isExceeded = qtyNum > source.available
              const reqPacks = parseInt(packQuantity, 10) || 1
              const perPackRatio = reqPacks > 0 ? (qtyNum / reqPacks).toFixed(1).replace(/\.0$/, '') : 1

              return (
                <div
                  key={source.itemId}
                  className={`selected-item-chip ${isExceeded ? 'chip-warning' : ''}`}
                >
                  <button
                    type="button"
                    className="chip-remove-btn"
                    onClick={() => handleRemoveSource(source.itemId)}
                    title="Remove item"
                  >
                    <X size={12} />
                  </button>

                  <div className="chip-header">
                    <div className="chip-icon">
                      <IconComponent size={16} />
                    </div>
                    <div className="chip-title">
                      <strong className="chip-name">{source.itemName}</strong>
                      {source.category && <span className="chip-category">{source.category}</span>}
                    </div>
                  </div>

                  <div className="chip-controls">
                    <div className="chip-qty-wrapper">
                      <button
                        type="button"
                        className="qty-btn"
                        onClick={() => handleStepQuantity(source.itemId, -1)}
                        title="Decrease"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={source.available}
                        value={source.quantity}
                        onChange={(e) => handleUpdateQuantity(source.itemId, e.target.value)}
                        className="chip-qty-input"
                      />
                      <button
                        type="button"
                        className="qty-btn"
                        onClick={() => handleStepQuantity(source.itemId, 1)}
                        title="Increase"
                      >
                        +
                      </button>
                      <span className="chip-unit">{source.unit}</span>
                    </div>

                    <div className="chip-stock-detail">
                      {isExceeded ? (
                        <span className="stock-danger">Exceeds {source.available} avail!</span>
                      ) : (
                        <span className="stock-normal">
                          {perPackRatio} {source.unit}/pack ({source.available} avail)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 5. Stock Sufficiency Analysis */}
      {selectedSources.length > 0 && (
        <div className="builder-section">
          <div className="section-header">
            <Calculator size={18} />
            <h3>Stock Sufficiency Analysis</h3>
          </div>

          <div className="validation-card">
            <div className="validation-stats">
              <div className="stat-row">
                <span className="stat-label">Max packs possible from stock:</span>
                <span className="stat-value">{maxPacksFromStock} packs</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Requested packs:</span>
                <span className="stat-value">{packQuantityNum} packs</span>
              </div>
              {targetFamilies > 0 && (
                <div className="stat-row">
                  <span className="stat-label">Target families:</span>
                  <span className="stat-value">{targetFamilies} families</span>
                </div>
              )}
            </div>

            {packQuantityNum > 0 && (
              <div
                className={`validation-result ${
                  packQuantityNum <= maxPacksFromStock
                    ? 'sufficient'
                    : packQuantityNum <= maxPacksFromStock * 1.1
                    ? 'warning'
                    : 'insufficient'
                }`}
              >
                {packQuantityNum <= maxPacksFromStock ? (
                  <>
                    <CheckCircle size={20} />
                    <div>
                      <strong>Sufficient Stock</strong>
                      <p>Available inventory can fulfill this repacking batch.</p>
                    </div>
                  </>
                ) : packQuantityNum <= maxPacksFromStock * 1.1 ? (
                  <>
                    <AlertCircle size={20} />
                    <div>
                      <strong>Near Stock Capacity</strong>
                      <p>
                        Stock is close to limit. Can create {maxPacksFromStock} packs (requested{' '}
                        {packQuantityNum})
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertCircle size={20} />
                    <div>
                      <strong>Insufficient Stock</strong>
                      <p>
                        Current stock can only create {maxPacksFromStock} packs. Adjust requested quantity or item stock.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
