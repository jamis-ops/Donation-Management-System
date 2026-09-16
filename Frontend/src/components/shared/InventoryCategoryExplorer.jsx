import { useState, useMemo } from 'react'
import {
  Package,
  Layers,
  ChevronRight,
  Folder,
  FolderOpen,
  Tag,
  Ruler,
  AlertTriangle,
  Plus,
  Search,
  ArrowLeft,
  CheckCircle2,
  Box,
  Droplets,
  Utensils,
  Shirt,
  HeartPulse,
  Sparkles,
  Home,
  Truck,
  HelpCircle,
  Pencil,
  Trash2,
} from 'lucide-react'

// Icon helper per category name
function getCategoryIcon(catName = '') {
  const c = catName.toLowerCase()
  if (c.includes('water') || c.includes('beverage')) return <Droplets size={24} className="text-blue-600" />
  if (c.includes('food') || c.includes('grocery') || c.includes('meal')) return <Utensils size={24} className="text-amber-600" />
  if (c.includes('cloth') || c.includes('wear') || c.includes('apparel')) return <Shirt size={24} className="text-purple-600" />
  if (c.includes('medic') || c.includes('health') || c.includes('pharma')) return <HeartPulse size={24} className="text-rose-600" />
  if (c.includes('hygiene') || c.includes('sanit')) return <Sparkles size={24} className="text-teal-600" />
  if (c.includes('shelter') || c.includes('bed') || c.includes('tent')) return <Home size={24} className="text-indigo-600" />
  if (c.includes('logist') || c.includes('equip') || c.includes('tool')) return <Truck size={24} className="text-slate-600" />
  return <Package size={24} className="text-red-700" />
}

export default function InventoryCategoryExplorer({
  items = [],
  onEditItem,
  onDeleteItem,
  onAddItem,
}) {
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedItemType, setSelectedItemType] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Compute category rollups from actual items
  const categoryGroups = useMemo(() => {
    const map = new Map()
    const safeItems = Array.isArray(items) ? items : []

    safeItems.forEach((item) => {
      if (!item) return
      const cat = (item.category || 'General Goods').trim()
      if (!map.has(cat)) {
        map.set(cat, {
          name: cat,
          items: [],
          totalQuantity: 0,
          lowStockCount: 0,
          itemTypeSet: new Set(),
        })
      }
      const group = map.get(cat)
      group.items.push(item)
      group.totalQuantity += Number(item.quantity) || 0
      if (item.stockLevel === 'low' || item.status === 'Low Stock' || item.status === 'Low') {
        group.lowStockCount += 1
      }
      if (item.itemType) {
        group.itemTypeSet.add(item.itemType.trim())
      } else {
        // Fallback item type from item name
        group.itemTypeSet.add('General Goods')
      }
    })

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [items])

  // Current category data
  const currentCategoryData = useMemo(() => {
    if (!selectedCategory) return null
    const safeGroups = Array.isArray(categoryGroups) ? categoryGroups : []
    return (
      safeGroups.find(
        (c) => c && c.name && c.name.toLowerCase() === selectedCategory.toLowerCase()
      ) || {
        name: selectedCategory,
        items: [],
        totalQuantity: 0,
        lowStockCount: 0,
        itemTypeSet: new Set(),
      }
    )
  }, [selectedCategory, categoryGroups])

  // Item Types within current category
  const itemTypeGroups = useMemo(() => {
    if (!currentCategoryData) return []
    const map = new Map()

    currentCategoryData.items.forEach((item) => {
      const type = (item.itemType || 'General Goods').trim()
      if (!map.has(type)) {
        map.set(type, {
          name: type,
          items: [],
          totalQuantity: 0,
          lowStockCount: 0,
          brandSet: new Set(),
        })
      }
      const g = map.get(type)
      g.items.push(item)
      g.totalQuantity += Number(item.quantity) || 0
      if (item.stockLevel === 'low' || item.status === 'Low Stock' || item.status === 'Low') {
        g.lowStockCount += 1
      }
      if (item.brand) {
        g.brandSet.add(item.brand.trim())
      }
    })

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [currentCategoryData])

  // Items to display when inside an Item Type or filtered by search
  const visibleItems = useMemo(() => {
    if (!selectedCategory) return []
    let list = currentCategoryData ? currentCategoryData.items : []

    if (selectedItemType) {
      list = list.filter((i) => {
        const t = (i.itemType || 'General Goods').trim()
        return t.toLowerCase() === selectedItemType.toLowerCase()
      })
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((i) => {
        return (
          (i.item && i.item.toLowerCase().includes(q)) ||
          (i.brand && i.brand.toLowerCase().includes(q)) ||
          (i.variant && i.variant.toLowerCase().includes(q)) ||
          (i.unit && i.unit.toLowerCase().includes(q)) ||
          (i.id && i.id.toLowerCase().includes(q))
        )
      })
    }

    return list
  }, [selectedCategory, currentCategoryData, selectedItemType, searchQuery])

  // Reset helpers
  const handleSelectCategory = (catName) => {
    setSelectedCategory(catName)
    setSelectedItemType(null)
    setSearchQuery('')
  }

  const handleSelectItemType = (typeName) => {
    setSelectedItemType(typeName)
    setSearchQuery('')
  }

  const handleResetToRoot = () => {
    setSelectedCategory(null)
    setSelectedItemType(null)
    setSearchQuery('')
  }

  return (
    <div className="inv-explorer">
      {/* Explorer Navigation Bar & Breadcrumbs */}
      <div className="inv-explorer__nav">
        <div className="inv-breadcrumbs">
          <button
            type="button"
            className={`inv-crumb ${!selectedCategory ? 'inv-crumb--active' : ''}`}
            onClick={handleResetToRoot}
          >
            <Folder size={14} className="mr-1" /> All Categories
          </button>

          {selectedCategory && (
            <>
              <ChevronRight size={14} className="inv-crumb-sep" />
              <button
                type="button"
                className={`inv-crumb ${!selectedItemType ? 'inv-crumb--active' : ''}`}
                onClick={() => setSelectedItemType(null)}
              >
                {selectedCategory}
              </button>
            </>
          )}

          {selectedItemType && (
            <>
              <ChevronRight size={14} className="inv-crumb-sep" />
              <span className="inv-crumb inv-crumb--active">
                {selectedItemType}
              </span>
            </>
          )}
        </div>

        <div className="inv-explorer__actions">
          {(selectedCategory || selectedItemType) && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                if (selectedItemType) setSelectedItemType(null)
                else setSelectedCategory(null)
              }}
            >
              <ArrowLeft size={14} className="mr-1" /> Back
            </button>
          )}
        </div>
      </div>

      {/* LEVEL 1: ALL CATEGORIES VIEW */}
      {!selectedCategory && (
        <div className="inv-category-grid">
          {categoryGroups.length === 0 ? (
            <div className="inv-empty-state">
              <Box size={40} className="text-gray-400 mb-2" />
              <p>No inventory categories yet. Add an item to get started.</p>
            </div>
          ) : (
            categoryGroups.map((cat) => (
              <div
                key={cat.name}
                className="inv-cat-card"
                onClick={() => handleSelectCategory(cat.name)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleSelectCategory(cat.name)
                  }
                }}
              >
                <div className="inv-cat-card__header">
                  <div className="inv-cat-card__icon-wrapper">
                    {getCategoryIcon(cat.name)}
                  </div>
                  <ChevronRight size={18} className="inv-cat-card__arrow" />
                </div>

                <div className="inv-cat-card__body">
                  <h3 className="inv-cat-card__title">{cat.name}</h3>
                  <div className="inv-cat-card__meta">
                    <span className="inv-cat-card__count">
                      <strong>{cat.itemTypeSet.size}</strong> item {cat.itemTypeSet.size === 1 ? 'type' : 'types'}
                    </span>
                    <span className="inv-cat-card__divider">•</span>
                    <span className="inv-cat-card__qty">
                      <strong>{cat.items.length}</strong> {cat.items.length === 1 ? 'product' : 'products'}
                    </span>
                  </div>

                  <div className="inv-cat-card__stock-tag">
                    Total In Stock: <strong>{cat.totalQuantity.toLocaleString()}</strong> units
                  </div>

                  {cat.lowStockCount > 0 && (
                    <div className="inv-cat-card__alert">
                      <AlertTriangle size={12} className="mr-1" />
                      <span>{cat.lowStockCount} {cat.lowStockCount === 1 ? 'item' : 'items'} low on stock</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* LEVEL 2: ITEM TYPES VIEW (INSIDE A CATEGORY) */}
      {selectedCategory && !selectedItemType && (
        <div className="inv-drilldown-container">
          <div className="inv-drilldown-header">
            <div className="inv-drilldown-title">
              <div className="inv-drilldown-icon">{getCategoryIcon(selectedCategory)}</div>
              <div>
                <h2>{selectedCategory}</h2>
                <p className="text-muted">
                  Select an item type to inspect specific brands, variants, and quantities.
                </p>
              </div>
            </div>

            <div className="inv-search-bar">
              <Search size={14} className="text-gray-400" />
              <input
                type="text"
                placeholder={`Search products in ${selectedCategory}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="btn-clear-search"
                  onClick={() => setSearchQuery('')}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* If user searched directly in category, show matching products list */}
          {searchQuery.trim() ? (
            <div className="inv-items-table-wrapper">
              <table className="inv-items-table">
                <thead>
                  <tr>
                    <th>Item / Product</th>
                    <th>Type</th>
                    <th>Brand</th>
                    <th>Variant / Size</th>
                    <th>Stock Quantity</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-6 text-muted">
                        No items match "{searchQuery}" in {selectedCategory}.
                      </td>
                    </tr>
                  ) : (
                    visibleItems.map((item) => (
                      <tr key={item.dbId || item.id}>
                        <td>
                          <div className="font-semibold">{item.item}</div>
                          <span className="text-xs text-gray-400">{item.id}</span>
                        </td>
                        <td>{item.itemType || '—'}</td>
                        <td>{item.brand || 'Generic / Unbranded'}</td>
                        <td>{item.variant || '—'}</td>
                        <td>
                          <strong>{item.quantity}</strong> <span className="text-muted">{item.unit}</span>
                        </td>
                        <td>
                          <span className={`badge badge--${item.stockLevel || 'moderate'}`}>
                            {item.status || 'Available'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn--ghost btn--xs"
                            onClick={() => onEditItem(item)}
                            title="Edit Stock"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--xs text-red-600"
                            onClick={() => onDeleteItem(item)}
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* Otherwise show Item Type Cards */
            <div className="inv-types-grid">
              {itemTypeGroups.length === 0 ? (
                <div className="inv-empty-state">
                  <Box size={36} className="text-gray-400 mb-2" />
                  <p>No item types recorded in {selectedCategory}.</p>
                </div>
              ) : (
                itemTypeGroups.map((g) => (
                  <div
                    key={g.name}
                    className="inv-type-card"
                    onClick={() => handleSelectItemType(g.name)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleSelectItemType(g.name)
                      }
                    }}
                  >
                    <div className="inv-type-card__header">
                      <div className="inv-type-card__tag">
                        <Layers size={14} className="mr-1 text-red-700" />
                        <span className="font-medium">{g.name}</span>
                      </div>
                      <ChevronRight size={16} className="text-gray-400" />
                    </div>

                    <div className="inv-type-card__body">
                      <div className="inv-type-card__stat">
                        <span>Total Quantity:</span>
                        <strong>{g.totalQuantity.toLocaleString()}</strong>
                      </div>
                      <div className="inv-type-card__stat">
                        <span>Variations:</span>
                        <span>{g.items.length} {g.items.length === 1 ? 'item' : 'items'}</span>
                      </div>
                      {g.brandSet.size > 0 && (
                        <div className="inv-type-card__brands">
                          <span className="text-xs text-muted">Brands:</span>
                          <div className="inv-chips-wrap">
                            {Array.from(g.brandSet).slice(0, 3).map((b) => (
                              <span key={b} className="inv-brand-chip">{b}</span>
                            ))}
                            {g.brandSet.size > 3 && (
                              <span className="inv-brand-chip inv-brand-chip--more">
                                +{g.brandSet.size - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {g.lowStockCount > 0 && (
                      <div className="inv-type-card__alert">
                        <AlertTriangle size={12} className="mr-1" />
                        <span>{g.lowStockCount} needs replenishment</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* LEVEL 3: BRANDS & VARIANTS DRILL-DOWN */}
      {selectedCategory && selectedItemType && (
        <div className="inv-drilldown-container">
          <div className="inv-drilldown-header">
            <div className="inv-drilldown-title">
              <div className="inv-drilldown-icon">
                <Layers size={22} className="text-red-700" />
              </div>
              <div>
                <h2>{selectedCategory} › {selectedItemType}</h2>
                <p className="text-muted">
                  Detailed product variants, packaging sizes, and current stock balances.
                </p>
              </div>
            </div>

            <div className="inv-search-bar">
              <Search size={14} className="text-gray-400" />
              <input
                type="text"
                placeholder={`Search ${selectedItemType}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="btn-clear-search"
                  onClick={() => setSearchQuery('')}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="inv-items-table-wrapper">
            <table className="inv-items-table">
              <thead>
                <tr>
                  <th>Product / Item Name</th>
                  <th>Brand</th>
                  <th>Variant / Size</th>
                  <th>Available / Total</th>
                  <th>Unit</th>
                  <th>Threshold</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-6 text-muted">
                      No items recorded under {selectedItemType}. Click "+ Add Item" above to add one.
                    </td>
                  </tr>
                ) : (
                  visibleItems.map((item) => (
                    <tr key={item.dbId || item.id} className="inv-table-row">
                      <td>
                        <div className="font-semibold text-slate-800">{item.item}</div>
                        <div className="text-xs text-gray-400">SKU: {item.id}</div>
                      </td>
                      <td>
                        {item.brand ? (
                          <span className="inv-brand-badge">{item.brand}</span>
                        ) : (
                          <span className="text-gray-400 text-xs italic">Generic / Unbranded</span>
                        )}
                      </td>
                      <td>
                        {item.variant ? (
                          <span className="inv-variant-badge">{item.variant}</span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td>
                        <strong>{item.available ?? item.quantity}</strong>
                        <span className="text-xs text-gray-400"> / {item.quantity}</span>
                      </td>
                      <td>{item.unit}</td>
                      <td>
                        <span className="text-xs text-muted">Low: {item.lowStockThreshold || 0}</span>
                      </td>
                      <td>
                        <span className={`badge badge--${item.stockLevel || 'moderate'}`}>
                          {item.status || 'Available'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="inv-action-buttons">
                          <button
                            type="button"
                            className="btn btn--ghost btn--xs"
                            onClick={() => onEditItem(item)}
                            title="Update Stock or Details"
                          >
                            <Pencil size={13} className="mr-1" /> Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--xs text-red-600"
                            onClick={() => onDeleteItem(item)}
                            title="Delete Item"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
