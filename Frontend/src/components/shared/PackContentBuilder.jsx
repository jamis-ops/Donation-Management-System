import { useState, useMemo } from 'react'
import {
  Package, Lightbulb, CheckCircle, Calculator, AlertCircle,
  Utensils, Droplets, Shirt, Pill, Sparkles, Home, Box, Tag, Search, X, Plus, Minus, Check
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
  const [selectedCategory, setSelectedCategory] = useState('All')

  // Stock items with available quantity > 0
  const allStockItems = useMemo(() => {
    return (items || []).filter((item) => {
      const available = (item.quantity || 0) - (item.allocated || 0)
      return available > 0
    })
  }, [items])

  // Unique categories for filtering
  const categories = useMemo(() => {
    const set = new Set()
    allStockItems.forEach((i) => {
      if (i.category) set.add(i.category)
    })
    return ['All', ...Array.from(set).sort()]
  }, [allStockItems])

  // Filtered catalog items
  const catalogItems = useMemo(() => {
    return allStockItems.filter((item) => {
      const matchesSearch = !searchTerm || (
        item.item?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [allStockItems, searchTerm, selectedCategory])

  const handleToggleSource = (item) => {
    const available = (item.quantity || 0) - (item.allocated || 0)
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

    const available = (item.quantity || 0) - (item.allocated || 0)
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

      const available = (item.quantity || 0) - (item.allocated || 0)
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

  // Calculate maximum packs possible given inventory available and required per-pack ratio
  const calculateBottleneck = () => {
    if (selectedSources.length === 0) return { maxPacks: 0, limitingItem: null }
    const reqPacks = parseInt(packQuantity, 10) || 1

    let minPacks = Infinity
    let bottleneck = null

    selectedSources.forEach((src) => {
      const srcQty = Number(src.quantity) || 0
      if (srcQty <= 0) {
        minPacks = 0
        bottleneck = src
        return
      }
      const perPack = srcQty / reqPacks
      if (perPack <= 0) {
        minPacks = 0
        bottleneck = src
        return
      }
      const possible = Math.floor((src.available || 0) / perPack)
      if (possible < minPacks) {
        minPacks = possible
        bottleneck = src
      }
    })

    return {
      maxPacks: minPacks === Infinity ? 0 : minPacks,
      limitingItem: bottleneck,
    }
  }

  const { maxPacks, limitingItem } = calculateBottleneck()
  const packQuantityNum = parseInt(packQuantity, 10) || 0
  const anyExceeded = selectedSources.some((s) => Number(s.quantity) > s.available)

  return (
    <div className="pack-builder-workbench">
      {/* 1. Compact Pack Configuration Bar */}
      <div className="pack-config-bar">
        <div className="config-bar-field config-bar-field--name">
          <label className="config-bar-label">
            Pack Name <span className="required">*</span>
          </label>
          <input
            type="text"
            value={packName}
            onChange={(e) => onPackNameChange(e.target.value)}
            placeholder="e.g., Banilad Relief Pack (Rice + Groceries)"
            className="form-input-enhanced config-bar-input"
            required
          />
        </div>

        <div className="config-bar-field config-bar-field--qty">
          <label className="config-bar-label">
            Number of Packs <span className="required">*</span>
            {targetFamilies > 0 && <span className="target-pill">Target: {targetFamilies}</span>}
          </label>
          <input
            type="number"
            min="1"
            value={packQuantity}
            onChange={(e) => onPackQuantityChange(e.target.value)}
            placeholder="Qty"
            className="form-input-enhanced config-bar-input"
            required
          />
        </div>

        <div className="config-bar-field config-bar-field--unit">
          <label className="config-bar-label">Unit</label>
          <input
            type="text"
            value={packUnit}
            onChange={(e) => onPackUnitChange(e.target.value)}
            placeholder="packs"
            className="form-input-enhanced config-bar-input"
          />
        </div>
      </div>

      {/* 2. Interactive Workbench (Side-by-Side) */}
      <div className="workbench-grid">
        {/* LEFT COLUMN: Available Inventory & Suggestions */}
        <div className="workbench-col workbench-col--catalog">
          {/* Smart suggestions bar */}
          {analysisData?.suggestedContents && analysisData.suggestedContents.length > 0 && (
            <div className="suggestions-bar">
              <div className="suggestions-bar__header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Lightbulb size={14} className="text-warning" />
                  <strong>Smart Suggestions ({analysisData.suggestedContents.length})</strong>
                </div>
                <button
                  type="button"
                  className="btn-apply-all-compact"
                  onClick={handleApplyAllSuggestions}
                >
                  Apply All
                </button>
              </div>

              <div className="suggestions-chip-list">
                {analysisData.suggestedContents.map((sug, idx) => {
                  const isAdded = selectedSources.some((s) => s.itemId === sug.itemId)
                  return (
                    <button
                      key={idx}
                      type="button"
                      className={`suggestion-chip ${isAdded ? 'suggestion-chip--added' : ''}`}
                      onClick={() => handleApplySuggestion(sug)}
                      title={`Add ${sug.quantity} ${sug.unit} per pack`}
                    >
                      {isAdded ? <Check size={12} /> : <Plus size={12} />}
                      <span>{sug.item}</span>
                      <small>({sug.quantity} {sug.unit}/pk)</small>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Search & Filter Header */}
          <div className="catalog-toolbar">
            <div className="catalog-search-wrap">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                placeholder="Search inventory items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="catalog-search-input"
              />
              {searchTerm && (
                <button
                  type="button"
                  className="clear-search-btn"
                  onClick={() => setSearchTerm('')}
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {categories.length > 2 && (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="catalog-category-select"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </div>

          {/* Inventory Items Grid */}
          <div className="catalog-scroll-area">
            {catalogItems.length === 0 ? (
              <div className="catalog-empty">
                <p>{searchTerm ? 'No items match your search.' : 'No available stock in warehouse.'}</p>
              </div>
            ) : (
              <div className="catalog-tile-list">
                {catalogItems.map((item) => {
                  const available = (item.quantity || 0) - (item.allocated || 0)
                  const isSelected = selectedSources.some((s) => s.itemId === item.dbId)
                  const IconComp = getItemIcon(item.item, item.category)

                  return (
                    <div
                      key={item.dbId}
                      className={`catalog-tile ${isSelected ? 'catalog-tile--selected' : ''}`}
                      onClick={() => handleToggleSource(item)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleToggleSource(item)
                        }
                      }}
                    >
                      <div className="catalog-tile__icon-box">
                        <IconComp size={15} />
                      </div>
                      <div className="catalog-tile__meta">
                        <div className="catalog-tile__name">{item.item}</div>
                        <div className="catalog-tile__category">{item.category || 'General'}</div>
                      </div>
                      <div className="catalog-tile__stock">
                        <span className="stock-number">{available}</span>
                        <span className="stock-unit">{item.unit || 'units'}</span>
                      </div>
                      <div className={`catalog-tile__action ${isSelected ? 'catalog-tile__action--active' : ''}`}>
                        {isSelected ? <Check size={13} /> : <Plus size={13} />}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Pack Composition & Live Validation */}
        <div className="workbench-col workbench-col--pack">
          {/* Header */}
          <div className="pack-header-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Package size={15} />
              <strong>Pack Contents</strong>
              <span className="pack-count-badge">{selectedSources.length} item{selectedSources.length !== 1 ? 's' : ''}</span>
            </div>
            {selectedSources.length > 0 && (
              <button
                type="button"
                className="btn-clear-pack"
                onClick={() => onSourcesChange([])}
              >
                Clear All
              </button>
            )}
          </div>

          {/* Selected items list */}
          <div className="pack-items-scroll-area">
            {selectedSources.length === 0 ? (
              <div className="pack-empty-state">
                <Package size={32} className="pack-empty-icon" />
                <p>No items added yet</p>
                <span>Click items on the left catalog or use Smart Suggestions to build your pack.</span>
              </div>
            ) : (
              <div className="pack-items-list">
                {selectedSources.map((source) => {
                  const qtyNum = Number(source.quantity) || 0
                  const isExceeded = qtyNum > source.available
                  const reqPacks = parseInt(packQuantity, 10) || 1
                  const perPackRatio = reqPacks > 0 ? (qtyNum / reqPacks).toFixed(1).replace(/\.0$/, '') : 1
                  const IconComponent = getItemIcon(source.itemName, source.category)

                  return (
                    <div
                      key={source.itemId}
                      className={`pack-item-card ${isExceeded ? 'pack-item-card--exceeded' : ''}`}
                    >
                      <div className="pack-item-card__top">
                        <div className="pack-item-info">
                          <IconComponent size={14} className="pack-item-icon" />
                          <div>
                            <span className="pack-item-name">{source.itemName}</span>
                            <span className="pack-item-sub">
                              {perPackRatio} {source.unit}/pack · {source.available} in stock
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="pack-item-remove"
                          onClick={() => handleRemoveSource(source.itemId)}
                          title="Remove item"
                          aria-label="Remove item"
                        >
                          <X size={13} />
                        </button>
                      </div>

                      <div className="pack-item-card__bottom">
                        <div className="pack-item-stepper">
                          <button
                            type="button"
                            className="stepper-btn"
                            onClick={() => handleStepQuantity(source.itemId, -1)}
                            disabled={qtyNum <= 1}
                            title="Decrease quantity"
                          >
                            <Minus size={11} />
                          </button>
                          <input
                            type="number"
                            min="1"
                            max={source.available}
                            value={source.quantity}
                            onChange={(e) => handleUpdateQuantity(source.itemId, e.target.value)}
                            className={`stepper-input ${isExceeded ? 'stepper-input--error' : ''}`}
                          />
                          <button
                            type="button"
                            className="stepper-btn"
                            onClick={() => handleStepQuantity(source.itemId, 1)}
                            disabled={qtyNum >= source.available}
                            title="Increase quantity"
                          >
                            <Plus size={11} />
                          </button>
                          <span className="stepper-unit">{source.unit} total</span>
                        </div>

                        {isExceeded && (
                          <span className="stock-alert-msg">Exceeds {source.available} available!</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Live Capacity & Sufficiency Dock */}
          {selectedSources.length > 0 && (
            <div className="capacity-dock">
              <div className="capacity-dock__row">
                <div className="capacity-stat">
                  <span className="capacity-stat-label">Stock Capacity:</span>
                  <strong className="capacity-stat-val font-semibold">{maxPacks} packs max</strong>
                </div>
                <div className="capacity-stat">
                  <span className="capacity-stat-label">Requested:</span>
                  <strong className="capacity-stat-val font-semibold">{packQuantityNum} packs</strong>
                </div>
              </div>

              {anyExceeded ? (
                <div className="capacity-banner capacity-banner--danger">
                  <AlertCircle size={14} />
                  <span>One or more item quantities exceed warehouse stock. Please reduce quantity.</span>
                </div>
              ) : packQuantityNum > 0 && packQuantityNum <= maxPacks ? (
                <div className="capacity-banner capacity-banner--success">
                  <CheckCircle size={14} />
                  <span>Sufficient stock available to fulfill all {packQuantityNum} packs!</span>
                </div>
              ) : packQuantityNum > 0 ? (
                <div className="capacity-banner capacity-banner--warning">
                  <AlertCircle size={14} />
                  <span>
                    Current stock allows max {maxPacks} packs
                    {limitingItem ? ` (limited by ${limitingItem.itemName})` : ''}.
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
