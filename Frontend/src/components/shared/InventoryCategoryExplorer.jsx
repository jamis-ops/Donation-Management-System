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

// Enhanced Category Theme definition with colors, backgrounds, borders, gradients, and vibrant SVG icons
export function getCategoryTheme(catName = '') {
  const c = (catName || '').toLowerCase().trim()
  if (c.includes('water') || c.includes('beverage') || c.includes('drink') || c.includes('tubig')) {
    return {
      name: 'Water & Beverages',
      primary: '#0284c7', // Vibrant Sky/Ocean Blue
      secondary: '#38bdf8',
      bgSoft: '#f0f9ff',
      borderSoft: '#bae6fd',
      badgeBg: '#e0f2fe',
      badgeText: '#0369a1',
      heroGradient: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 45%, #ffffff 100%)',
      accentGlow: 'rgba(2, 132, 199, 0.22)',
      icon: (size = 24) => (
        <Droplets size={size} color="#0284c7" strokeWidth={2.4} fill="#bae6fd" />
      ),
    }
  }
  if (c.includes('food') || c.includes('grocery') || c.includes('meal') || c.includes('canned') || c.includes('rice') || c.includes('noodle')) {
    return {
      name: 'Food & Groceries',
      primary: '#d97706', // Warm Amber
      secondary: '#fbbf24',
      bgSoft: '#fffbeb',
      borderSoft: '#fde68a',
      badgeBg: '#fef3c7',
      badgeText: '#92400e',
      heroGradient: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 45%, #ffffff 100%)',
      accentGlow: 'rgba(217, 119, 6, 0.22)',
      icon: (size = 24) => (
        <Utensils size={size} color="#d97706" strokeWidth={2.4} />
      ),
    }
  }
  if (c.includes('cloth') || c.includes('wear') || c.includes('apparel') || c.includes('shirt') || c.includes('pant')) {
    return {
      name: 'Clothing & Apparel',
      primary: '#7c3aed', // Royal Violet
      secondary: '#a78bfa',
      bgSoft: '#faf5ff',
      borderSoft: '#e9d5ff',
      badgeBg: '#f3e8ff',
      badgeText: '#6d28d9',
      heroGradient: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 45%, #ffffff 100%)',
      accentGlow: 'rgba(124, 58, 237, 0.22)',
      icon: (size = 24) => (
        <Shirt size={size} color="#7c3aed" strokeWidth={2.4} />
      ),
    }
  }
  if (c.includes('medic') || c.includes('health') || c.includes('pharma') || c.includes('first aid')) {
    return {
      name: 'Medical & Healthcare',
      primary: '#e11d48', // Rose Red
      secondary: '#fb7185',
      bgSoft: '#fff1f2',
      borderSoft: '#fecdd3',
      badgeBg: '#ffe4e6',
      badgeText: '#be123c',
      heroGradient: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 45%, #ffffff 100%)',
      accentGlow: 'rgba(225, 29, 72, 0.22)',
      icon: (size = 24) => (
        <HeartPulse size={size} color="#e11d48" strokeWidth={2.4} />
      ),
    }
  }
  if (c.includes('hygiene') || c.includes('sanit') || c.includes('soap') || c.includes('clean')) {
    return {
      name: 'Hygiene & Sanitation',
      primary: '#0d9488', // Teal
      secondary: '#2dd4bf',
      bgSoft: '#f0fdfa',
      borderSoft: '#99f6e4',
      badgeBg: '#ccfbf1',
      badgeText: '#0f766e',
      heroGradient: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 45%, #ffffff 100%)',
      accentGlow: 'rgba(13, 148, 136, 0.22)',
      icon: (size = 24) => (
        <Sparkles size={size} color="#0d9488" strokeWidth={2.4} />
      ),
    }
  }
  if (c.includes('shelter') || c.includes('bed') || c.includes('tent') || c.includes('blanket')) {
    return {
      name: 'Shelter & Bedding',
      primary: '#ea580c', // Orange
      secondary: '#fb923c',
      bgSoft: '#fff7ed',
      borderSoft: '#fed7aa',
      badgeBg: '#ffedd5',
      badgeText: '#c2410c',
      heroGradient: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 45%, #ffffff 100%)',
      accentGlow: 'rgba(234, 88, 12, 0.22)',
      icon: (size = 24) => (
        <Home size={size} color="#ea580c" strokeWidth={2.4} />
      ),
    }
  }
  if (c.includes('logist') || c.includes('equip') || c.includes('tool') || c.includes('hardware')) {
    return {
      name: 'Logistics & Equipment',
      primary: '#475569', // Slate
      secondary: '#94a3b8',
      bgSoft: '#f8fafc',
      borderSoft: '#cbd5e1',
      badgeBg: '#f1f5f9',
      badgeText: '#334155',
      heroGradient: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 45%, #ffffff 100%)',
      accentGlow: 'rgba(71, 85, 105, 0.22)',
      icon: (size = 24) => (
        <Truck size={size} color="#475569" strokeWidth={2.4} />
      ),
    }
  }
  // Default fallback: Rise Above Foundation Red
  return {
    name: catName || 'General Goods',
    primary: '#AF101A',
    secondary: '#e53e3e',
    bgSoft: '#fff5f5',
    borderSoft: '#fed7d7',
    badgeBg: '#fee2e2',
    badgeText: '#991b1b',
    heroGradient: 'linear-gradient(135deg, #fff5f5 0%, #fee2e2 45%, #ffffff 100%)',
    accentGlow: 'rgba(175, 16, 26, 0.22)',
    icon: (size = 24) => (
      <Package size={size} color="#AF101A" strokeWidth={2.4} />
    ),
  }
}

export default function InventoryCategoryExplorer({
  items = [],
  onEditItem,
  onDeleteItem,
  onAddItem,
  onCategoryNavChange,
}) {
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedItemType, setSelectedItemType] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Report navigation state up to parent (so parent can hide global Add Item button when inside a category)
  useEffect(() => {
    if (typeof onCategoryNavChange === 'function') {
      onCategoryNavChange({ category: selectedCategory, itemType: selectedItemType })
    }
  }, [selectedCategory, selectedItemType, onCategoryNavChange])

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
        group.itemTypeSet.add('General Goods')
      }
    })

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [items])

  // Current category data & theme
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

  const currentTheme = useMemo(() => {
    return getCategoryTheme(selectedCategory)
  }, [selectedCategory])

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
            <Folder
              size={15}
              color={!selectedCategory ? '#AF101A' : '#64748b'}
              style={{ marginRight: '7px', flexShrink: 0 }}
            />
            <span>All Categories</span>
          </button>

          {selectedCategory && (
            <>
              <ChevronRight size={14} className="inv-crumb-sep" style={{ margin: '0 4px', color: '#94a3b8' }} />
              <button
                type="button"
                className={`inv-crumb ${!selectedItemType ? 'inv-crumb--category-active' : ''}`}
                style={!selectedItemType ? {
                  backgroundColor: currentTheme.badgeBg,
                  color: currentTheme.badgeText,
                  borderColor: currentTheme.borderSoft,
                } : {}}
                onClick={() => setSelectedItemType(null)}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {currentTheme.icon(14)}
                  <span>{selectedCategory}</span>
                </span>
              </button>
            </>
          )}

          {selectedItemType && (
            <>
              <ChevronRight size={14} className="inv-crumb-sep" style={{ margin: '0 4px', color: '#94a3b8' }} />
              <span
                className="inv-crumb inv-crumb--type-active"
                style={{
                  backgroundColor: '#f1f5f9',
                  color: '#0f172a',
                }}
              >
                <Layers size={13} style={{ marginRight: '6px', color: currentTheme.primary }} />
                <span>{selectedItemType}</span>
              </span>
            </>
          )}
        </div>

        <div className="inv-explorer__actions">
          {(selectedCategory || selectedItemType) && (
            <button
              type="button"
              className="inv-back-btn"
              onClick={() => {
                if (selectedItemType) setSelectedItemType(null)
                else setSelectedCategory(null)
              }}
            >
              <ArrowLeft size={14} style={{ marginRight: '6px' }} />
              <span>Back to {selectedItemType ? selectedCategory : 'Categories'}</span>
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
            categoryGroups.map((cat) => {
              const theme = getCategoryTheme(cat.name)
              return (
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
                  {/* Top color accent bar */}
                  <div
                    className="inv-cat-card__accent-bar"
                    style={{ backgroundColor: theme.primary }}
                  />

                  <div className="inv-cat-card__header">
                    <div
                      className="inv-cat-card__icon-wrapper"
                      style={{
                        backgroundColor: theme.badgeBg,
                        border: `1px solid ${theme.borderSoft}`,
                        boxShadow: `0 3px 8px -2px ${theme.accentGlow}`,
                      }}
                    >
                      {theme.icon(24)}
                    </div>
                    <div
                      className="inv-cat-card__arrow-circle"
                      style={{ color: theme.primary }}
                    >
                      <ChevronRight size={16} />
                    </div>
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
                      <span className="inv-cat-card__stock-label">Total In Stock:</span>
                      <strong className="inv-cat-card__stock-val" style={{ color: theme.primary }}>
                        {cat.totalQuantity.toLocaleString()}
                      </strong>
                      <span className="inv-cat-card__stock-unit">units</span>
                    </div>

                    {cat.lowStockCount > 0 && (
                      <div className="inv-cat-card__alert">
                        <AlertTriangle size={12} style={{ marginRight: '5px' }} />
                        <span>{cat.lowStockCount} {cat.lowStockCount === 1 ? 'item' : 'items'} low on stock</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* LEVEL 2: ITEM TYPES VIEW (INSIDE A CATEGORY) */}
      {selectedCategory && !selectedItemType && (
        <div className="inv-drilldown-container">
          {/* Enhanced Category Hero Banner */}
          <div
            className="inv-category-hero"
            style={{
              background: currentTheme.heroGradient,
              borderColor: currentTheme.borderSoft,
            }}
          >
            <div className="inv-category-hero__left">
              <div
                className="inv-category-hero__icon-box"
                style={{
                  backgroundColor: '#ffffff',
                  borderColor: currentTheme.borderSoft,
                  boxShadow: `0 8px 18px -4px ${currentTheme.accentGlow}`,
                }}
              >
                {currentTheme.icon(32)}
              </div>

              <div className="inv-category-hero__details">
                <div className="inv-category-hero__headline">
                  <h2 className="inv-category-hero__name">{selectedCategory}</h2>
                  <span
                    className="inv-category-hero__badge"
                    style={{
                      backgroundColor: currentTheme.badgeBg,
                      color: currentTheme.badgeText,
                      borderColor: currentTheme.borderSoft,
                    }}
                  >
                    Category Overview
                  </span>
                </div>

                <p className="inv-category-hero__desc">
                  Select an item type below to inspect brands, product packaging sizes, variants, and stock balances.
                </p>

                <div className="inv-category-hero__stats">
                  <div className="inv-stat-pill">
                    <Layers size={13} style={{ color: currentTheme.primary }} />
                    <span><strong>{itemTypeGroups.length}</strong> {itemTypeGroups.length === 1 ? 'Item Type' : 'Item Types'}</span>
                  </div>
                  <div className="inv-stat-pill">
                    <Box size={13} style={{ color: currentTheme.primary }} />
                    <span><strong>{currentCategoryData.items.length}</strong> {currentCategoryData.items.length === 1 ? 'Product Variation' : 'Product Variations'}</span>
                  </div>
                  <div className="inv-stat-pill inv-stat-pill--stock">
                    <span className="inv-stat-dot" style={{ backgroundColor: currentTheme.primary }} />
                    <span><strong>{currentCategoryData.totalQuantity.toLocaleString()}</strong> Units In Stock</span>
                  </div>
                  {currentCategoryData.lowStockCount > 0 && (
                    <div className="inv-stat-pill inv-stat-pill--alert">
                      <AlertTriangle size={13} />
                      <span><strong>{currentCategoryData.lowStockCount}</strong> Low Stock</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="inv-category-hero__right">
              <button
                type="button"
                className="inv-hero-add-btn"
                style={{
                  backgroundColor: currentTheme.primary,
                  color: '#ffffff',
                  boxShadow: `0 3px 12px ${currentTheme.accentGlow}`,
                }}
                onClick={() => onAddItem({ category: selectedCategory })}
                title={`Add a new item to ${selectedCategory}`}
              >
                <Plus size={15} style={{ marginRight: '5px' }} />
                <span>+ Add {selectedCategory} Item</span>
              </button>

              <div
                className="inv-hero-search"
                style={{
                  borderColor: currentTheme.borderSoft,
                }}
              >
                <Search size={15} style={{ color: currentTheme.primary, flexShrink: 0 }} />
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
          </div>

          {/* If user searched directly in category, show matching products list */}
          {searchQuery.trim() ? (
            <div className="inv-items-table-wrapper">
              <div className="inv-table-search-notice">
                <span>Showing search results for "<strong>{searchQuery}</strong>" in <strong>{selectedCategory}</strong>:</span>
                <button
                  type="button"
                  className="btn btn--ghost btn--xs"
                  onClick={() => setSearchQuery('')}
                >
                  Clear search
                </button>
              </div>
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
                      <tr key={item.dbId || item.id} className="inv-table-row">
                        <td>
                          <div className="font-semibold text-slate-800">{item.item}</div>
                          <span className="text-xs text-gray-400">SKU: {item.id}</span>
                        </td>
                        <td>
                          <span className="inv-type-pill">{item.itemType || '—'}</span>
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
                          <strong style={{ color: currentTheme.primary }}>{item.quantity}</strong>{' '}
                          <span className="text-muted text-xs">{item.unit}</span>
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
                  <button
                    type="button"
                    className="btn btn--primary btn--sm mt-2"
                    style={{ backgroundColor: currentTheme.primary }}
                    onClick={() => onAddItem({ category: selectedCategory })}
                  >
                    <Plus size={14} style={{ marginRight: '4px' }} />
                    Add First {selectedCategory} Item
                  </button>
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
                    {/* Top Accent Line */}
                    <div
                      className="inv-type-card__accent"
                      style={{ backgroundColor: currentTheme.primary }}
                    />

                    <div className="inv-type-card__header">
                      <div className="inv-type-card__tag">
                        <div
                          className="inv-type-card__icon-badge"
                          style={{
                            backgroundColor: currentTheme.badgeBg,
                            border: `1px solid ${currentTheme.borderSoft}`,
                          }}
                        >
                          <Layers size={16} color={currentTheme.primary} />
                        </div>
                        <div className="inv-type-card__titles">
                          <h4 className="inv-type-card__title">{g.name}</h4>
                          <span className="inv-type-card__subtitle">Item Classification</span>
                        </div>
                      </div>
                      <div className="inv-type-card__arrow-btn" style={{ color: currentTheme.primary }}>
                        <ChevronRight size={16} />
                      </div>
                    </div>

                    <div className="inv-type-card__body">
                      {/* Stock Quantity Highlight Box */}
                      <div
                        className="inv-type-card__stock-box"
                        style={{
                          backgroundColor: currentTheme.bgSoft,
                          borderColor: currentTheme.borderSoft,
                        }}
                      >
                        <div className="inv-type-card__stock-num">
                          <span className="inv-type-card__qty-label">Total Quantity</span>
                          <div className="inv-type-card__big-qty" style={{ color: currentTheme.primary }}>
                            {g.totalQuantity.toLocaleString()}
                          </div>
                        </div>
                        <div className="inv-type-card__var-badge">
                          <Box size={12} style={{ marginRight: '4px', color: '#64748b' }} />
                          <span>{g.items.length} {g.items.length === 1 ? 'variation' : 'variations'}</span>
                        </div>
                      </div>

                      {/* Brand Chips */}
                      {g.brandSet.size > 0 && (
                        <div className="inv-type-card__brands-sec">
                          <div className="inv-type-card__brands-header">
                            <Tag size={11} style={{ marginRight: '4px', color: '#64748b' }} />
                            <span>Brands ({g.brandSet.size}):</span>
                          </div>
                          <div className="inv-chips-wrap">
                            {Array.from(g.brandSet).slice(0, 3).map((b) => (
                              <span key={b} className="inv-brand-chip">{b}</span>
                            ))}
                            {g.brandSet.size > 3 && (
                              <span
                                className="inv-brand-chip inv-brand-chip--more"
                                style={{
                                  backgroundColor: currentTheme.badgeBg,
                                  color: currentTheme.badgeText,
                                  borderColor: currentTheme.borderSoft,
                                }}
                              >
                                +{g.brandSet.size - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {g.lowStockCount > 0 && (
                      <div className="inv-type-card__alert">
                        <AlertTriangle size={12} style={{ marginRight: '5px' }} />
                        <span>{g.lowStockCount} item needs replenishment</span>
                      </div>
                    )}

                    <div className="inv-type-card__footer">
                      <span className="inv-type-card__view-link" style={{ color: currentTheme.primary }}>
                        Inspect products & variants →
                      </span>
                    </div>
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
          {/* Enhanced Drilldown Hero Banner */}
          <div
            className="inv-category-hero"
            style={{
              background: currentTheme.heroGradient,
              borderColor: currentTheme.borderSoft,
            }}
          >
            <div className="inv-category-hero__left">
              <div
                className="inv-category-hero__icon-box"
                style={{
                  backgroundColor: '#ffffff',
                  borderColor: currentTheme.borderSoft,
                  boxShadow: `0 8px 18px -4px ${currentTheme.accentGlow}`,
                }}
              >
                <Layers size={30} color={currentTheme.primary} />
              </div>

              <div className="inv-category-hero__details">
                <div className="inv-category-hero__headline">
                  <h2 className="inv-category-hero__name">
                    {selectedCategory} <span style={{ color: '#94a3b8', fontWeight: 400 }}>›</span> {selectedItemType}
                  </h2>
                  <span
                    className="inv-category-hero__badge"
                    style={{
                      backgroundColor: currentTheme.badgeBg,
                      color: currentTheme.badgeText,
                      borderColor: currentTheme.borderSoft,
                    }}
                  >
                    Product Catalog
                  </span>
                </div>

                <p className="inv-category-hero__desc">
                  Detailed product variants, packaging sizes, brands, and current stock balances under {selectedItemType}.
                </p>

                <div className="inv-category-hero__stats">
                  <div className="inv-stat-pill">
                    <Box size={13} style={{ color: currentTheme.primary }} />
                    <span><strong>{visibleItems.length}</strong> {visibleItems.length === 1 ? 'Product' : 'Products'}</span>
                  </div>
                  <div className="inv-stat-pill inv-stat-pill--stock">
                    <span className="inv-stat-dot" style={{ backgroundColor: currentTheme.primary }} />
                    <span>
                      <strong>
                        {visibleItems.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0).toLocaleString()}
                      </strong> Units Total
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="inv-category-hero__right">
              <button
                type="button"
                className="inv-hero-add-btn"
                style={{
                  backgroundColor: currentTheme.primary,
                  color: '#ffffff',
                  boxShadow: `0 3px 12px ${currentTheme.accentGlow}`,
                }}
                onClick={() => onAddItem({ category: selectedCategory, itemType: selectedItemType })}
                title={`Add product under ${selectedItemType}`}
              >
                <Plus size={15} style={{ marginRight: '5px' }} />
                <span>+ Add {selectedItemType}</span>
              </button>

              <div
                className="inv-hero-search"
                style={{
                  borderColor: currentTheme.borderSoft,
                }}
              >
                <Search size={15} style={{ color: currentTheme.primary, flexShrink: 0 }} />
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
                      <div>No items recorded under {selectedItemType}.</div>
                      <button
                        type="button"
                        className="btn btn--primary btn--xs mt-2"
                        style={{ backgroundColor: currentTheme.primary }}
                        onClick={() => onAddItem({ category: selectedCategory, itemType: selectedItemType })}
                      >
                        <Plus size={13} style={{ marginRight: '4px' }} />
                        Add {selectedItemType}
                      </button>
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
                        <strong style={{ color: currentTheme.primary }}>{item.available ?? item.quantity}</strong>
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
                            <Pencil size={13} style={{ marginRight: '4px' }} /> Edit
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

