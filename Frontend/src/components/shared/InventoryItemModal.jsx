import { useState, useEffect, useMemo } from 'react'
import { Package, Layers, Tag, Ruler, Hash, AlertTriangle, Sparkles, Check, X } from 'lucide-react'
import ModalHeader from '../../admin/components/shared/ModalHeader'
import { FormSelect, Select } from '../ui/select'
import { useInventoryCatalog } from '../../hooks/useInventoryCatalog'

export default function InventoryItemModal({
  isOpen,
  onClose,
  onSave,
  initialData = null,
  isEditing = false,
  saving = false,
  presetCategory = '',
  presetItemType = '',
  existingItems = [],
}) {
  const { categories, units, getItemTypesByCategory, getBrandsByItemType, getVariantsByItemType } = useInventoryCatalog()

  const [category, setCategory] = useState('')
  const [isCustomCategory, setIsCustomCategory] = useState(false)
  const [itemType, setItemType] = useState('')
  const [isCustomItemType, setIsCustomItemType] = useState(false)
  const [brand, setBrand] = useState('')
  const [isCustomBrand, setIsCustomBrand] = useState(false)
  const [variant, setVariant] = useState('')
  const [isCustomVariant, setIsCustomVariant] = useState(false)
  const [customItemName, setCustomItemName] = useState('')
  const [useCustomName, setUseCustomName] = useState(false)
  
  const [quantity, setQuantity] = useState('0')
  const [unit, setUnit] = useState('pcs')
  const [isCustomUnit, setIsCustomUnit] = useState(false)
  const [lowStockThreshold, setLowStockThreshold] = useState('100')
  const [moderateStockThreshold, setModerateStockThreshold] = useState('')
  const [allocated, setAllocated] = useState('0')
  const [distributed, setDistributed] = useState('0')

  // Comprehensive merged categories list guaranteed to have all standard categories
  const allCategoriesList = useMemo(() => {
    const map = new Map()
    // Standard base categories
    const base = [
      'Water',
      'Food',
      'Clothing',
      'Medical Supplies',
      'Hygiene Kits',
      'Shelter & Bedding',
      'Logistics & Equipment',
    ]
    base.forEach((name) => map.set(name.toLowerCase(), { name }))

    // Add catalog categories from backend
    if (Array.isArray(categories)) {
      categories.forEach((c) => {
        if (c && c.name && c.name.trim()) {
          map.set(c.name.trim().toLowerCase(), { ...c, name: c.name.trim() })
        }
      })
    }

    // Add any categories from existing items
    if (Array.isArray(existingItems)) {
      existingItems.forEach((it) => {
        if (it && it.category && it.category.trim()) {
          const name = it.category.trim()
          if (!map.has(name.toLowerCase())) {
            map.set(name.toLowerCase(), { name })
          }
        }
      })
    }

    // Include initialData category if editing
    if (initialData?.category && initialData.category.trim()) {
      const name = initialData.category.trim()
      if (!map.has(name.toLowerCase())) {
        map.set(name.toLowerCase(), { name })
      }
    }

    return Array.from(map.values())
  }, [categories, existingItems, initialData])

  // Populate or reset form when modal opens or initialData changes
  useEffect(() => {
    if (initialData) {
      const initialCat = initialData.category || presetCategory || 'Water'
      setCategory(initialCat)
      const isKnownCat = allCategoriesList.some(c => c.name.toLowerCase() === initialCat.toLowerCase())
      setIsCustomCategory(!isKnownCat && Boolean(initialCat))

      const initialType = initialData.itemType || presetItemType || ''
      setItemType(initialType)
      setIsCustomItemType(false)

      setBrand(initialData.brand || '')
      setIsCustomBrand(false)
      setVariant(initialData.variant || '')
      setIsCustomVariant(false)
      setQuantity(String(initialData.quantity ?? '0'))
      setUnit(initialData.unit || 'pcs')
      setIsCustomUnit(false)
      setLowStockThreshold(String(initialData.lowStockThreshold ?? '100'))
      setModerateStockThreshold(initialData.moderateStockThreshold ? String(initialData.moderateStockThreshold) : '')
      setAllocated(String(initialData.allocated ?? '0'))
      setDistributed(String(initialData.distributed ?? '0'))
      
      // Check if custom name was used
      const rawName = initialData.item || initialData.item_name || ''
      setCustomItemName(rawName)
      if (rawName && !initialData.itemType) {
        setUseCustomName(true)
      } else {
        setUseCustomName(false)
      }
    } else {
      const defaultCat = presetCategory || allCategoriesList[0]?.name || 'Water'
      setCategory(defaultCat)
      setIsCustomCategory(false)
      setItemType(presetItemType || '')
      setIsCustomItemType(false)
      setBrand('')
      setIsCustomBrand(false)
      setVariant('')
      setIsCustomVariant(false)
      setCustomItemName('')
      setUseCustomName(false)
      setQuantity('0')
      setUnit('pcs')
      setIsCustomUnit(false)
      setLowStockThreshold('50')
      setModerateStockThreshold('')
      setAllocated('0')
      setDistributed('0')
    }
  }, [initialData, presetCategory, presetItemType, allCategoriesList])

  // Cascading options based on catalog hook
  const availableItemTypes = useMemo(() => {
    const list = getItemTypesByCategory(category)
    const map = new Map()
    if (Array.isArray(list)) {
      list.forEach((t) => {
        if (t && t.name) map.set(t.name.toLowerCase(), t)
      })
    }
    // Also include any item types from existingItems in same category
    if (Array.isArray(existingItems) && category) {
      existingItems.forEach((it) => {
        if (
          it &&
          it.category &&
          it.category.toLowerCase() === category.toLowerCase() &&
          it.itemType &&
          it.itemType.trim()
        ) {
          const name = it.itemType.trim()
          if (!map.has(name.toLowerCase())) {
            map.set(name.toLowerCase(), { id: `ext-${name}`, name })
          }
        }
      })
    }
    return Array.from(map.values())
  }, [category, getItemTypesByCategory, existingItems])

  const availableBrands = useMemo(() => {
    const list = getBrandsByItemType(itemType, category)
    const map = new Map()
    if (Array.isArray(list)) {
      list.forEach((b) => {
        if (b && b.name && b.name.trim()) {
          map.set(b.name.trim().toLowerCase(), { ...b, name: b.name.trim() })
        }
      })
    }
    // Include existing item brand if editing to preserve existing data
    if (initialData?.brand && initialData.brand.trim()) {
      const bName = initialData.brand.trim()
      if (!map.has(bName.toLowerCase())) {
        map.set(bName.toLowerCase(), { id: `ext-brand-${bName}`, name: bName })
      }
    }
    // Also include any brands from existingItems matching same category/itemType
    if (Array.isArray(existingItems) && itemType) {
      existingItems.forEach((it) => {
        if (
          it &&
          it.brand &&
          it.brand.trim() &&
          it.itemType &&
          it.itemType.toLowerCase() === itemType.toLowerCase()
        ) {
          const name = it.brand.trim()
          if (!map.has(name.toLowerCase())) {
            map.set(name.toLowerCase(), { id: `ext-${name}`, name })
          }
        }
      })
    }
    return Array.from(map.values())
  }, [itemType, category, getBrandsByItemType, initialData, existingItems])

  const availableVariants = useMemo(() => {
    const list = getVariantsByItemType(itemType, category)
    const map = new Map()
    if (Array.isArray(list)) {
      list.forEach((v) => {
        if (v && v.name && v.name.trim()) {
          map.set(v.name.trim().toLowerCase(), { ...v, name: v.name.trim() })
        }
      })
    }
    // Include existing item variant if editing to preserve existing data
    if (initialData?.variant && initialData.variant.trim()) {
      const vName = initialData.variant.trim()
      if (!map.has(vName.toLowerCase())) {
        map.set(vName.toLowerCase(), { id: `ext-var-${vName}`, name: vName })
      }
    }
    // Also include any variants from existingItems matching same category/itemType
    if (Array.isArray(existingItems) && itemType) {
      existingItems.forEach((it) => {
        if (
          it &&
          it.variant &&
          it.variant.trim() &&
          it.itemType &&
          it.itemType.toLowerCase() === itemType.toLowerCase()
        ) {
          const name = it.variant.trim()
          if (!map.has(name.toLowerCase())) {
            map.set(name.toLowerCase(), { id: `ext-${name}`, name })
          }
        }
      })
    }
    return Array.from(map.values())
  }, [itemType, category, getVariantsByItemType, initialData, existingItems])

  const availableUnits = useMemo(() => {
    const standard = ['pcs', 'bottles', 'cans', 'sacks', 'packs', 'boxes', 'kits', 'pairs', 'kg', 'gallons', 'liters']
    const set = new Set(standard)
    if (Array.isArray(units)) {
      units.forEach((u) => {
        if (u && u.name) set.add(u.name.toLowerCase())
      })
    }
    if (initialData?.unit && initialData.unit.trim()) {
      set.add(initialData.unit.trim().toLowerCase())
    }
    return Array.from(set)
  }, [units, initialData])

  // Auto-assembled item name from hierarchy
  const autoGeneratedName = useMemo(() => {
    const parts = []
    if (brand?.trim()) parts.push(brand.trim())
    if (itemType?.trim()) parts.push(itemType.trim())
    let name = parts.join(' ')
    if (!name) {
      name = category ? `${category} Item` : 'Item'
    }
    if (variant?.trim()) {
      name += ` (${variant.trim()})`
    }
    return name
  }, [brand, itemType, category, variant])

  const effectiveItemName = useCustomName ? customItemName : autoGeneratedName

  const handleSubmit = (e) => {
    e.preventDefault()
    
    const payload = {
      item: effectiveItemName.trim(),
      category: category.trim(),
      itemType: itemType.trim() || null,
      brand: brand.trim() || null,
      variant: variant.trim() || null,
      quantity: Math.max(0, parseInt(quantity, 10) || 0),
      unit: unit.trim() || 'pcs',
      lowStockThreshold: Math.max(0, parseInt(lowStockThreshold, 10) || 0),
      moderateStockThreshold: moderateStockThreshold ? Math.max(0, parseInt(moderateStockThreshold, 10)) : null,
      allocated: Math.max(0, parseInt(allocated, 10) || 0),
      distributed: Math.max(0, parseInt(distributed, 10) || 0),
    }

    onSave(payload)
  }

  if (!isOpen) return null

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div 
        className="admin-modal admin-modal--wide inv-item-modal" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <ModalHeader
          title={isEditing ? `Update Stock Item — ${initialData?.item || initialData?.item_name}` : 'Add Inventory Item'}
          onClose={onClose}
        />

        <form onSubmit={handleSubmit} className="inv-item-form">
          {/* Classification Hierarchy Card */}
          <div className="inv-form-card">
            <div className="inv-form-card__header">
              <Layers size={16} className="text-red-700" />
              <h4>Item Classification Hierarchy</h4>
            </div>
            <p className="inv-form-card__subtext">
              Organize item by <strong>Category → Item Type → Brand → Variant/Size</strong>. Brand &amp; variant are optional for generic or bulk relief goods.
            </p>

            <div className="form-row form-row--2">
              {/* Category */}
              {!isCustomCategory ? (
                <FormSelect
                  label="Category"
                  icon={Package}
                  required
                  value={category}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setIsCustomCategory(true)
                      setCategory('')
                    } else {
                      setCategory(e.target.value)
                    }
                    setItemType('')
                    setBrand('')
                    setVariant('')
                    setIsCustomItemType(false)
                    setIsCustomBrand(false)
                    setIsCustomVariant(false)
                  }}
                >
                  <option value="" disabled>-- Select Category --</option>
                  {allCategoriesList.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                  <option value="__custom__">+ Custom Category...</option>
                </FormSelect>
              ) : (
                <div className="form-select-group">
                  <span className="form-label-with-icon">
                    <Package size={14} className="form-label-icon" />
                    <span className="form-label-title">Category</span>
                    <span className="text-red-600 font-bold ml-0.5">*</span>
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      required
                      value={category}
                      onChange={(e) => {
                        setCategory(e.target.value)
                        setItemType('')
                        setBrand('')
                        setVariant('')
                      }}
                      placeholder="Type custom category..."
                      className="form-input-enhanced"
                      autoFocus
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="btn btn--ghost btn--xs"
                      onClick={() => {
                        setIsCustomCategory(false)
                        setCategory(allCategoriesList[0]?.name || 'Water')
                        setItemType('')
                      }}
                      title="Choose from list"
                    >
                      Choose list
                    </button>
                  </div>
                </div>
              )}

              {/* Item Type */}
              {!isCustomItemType && (!category || availableItemTypes.length > 0) ? (
                <FormSelect
                  label="Item Type"
                  icon={Layers}
                  required={!useCustomName}
                  disabled={!category}
                  value={
                    !category
                      ? ''
                      : availableItemTypes.some((t) => t.name.toLowerCase() === (itemType || '').toLowerCase())
                      ? itemType
                      : itemType
                      ? '__custom__'
                      : ''
                  }
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setIsCustomItemType(true)
                      setItemType('')
                    } else {
                      setItemType(e.target.value)
                    }
                    setBrand('')
                    setVariant('')
                    setIsCustomBrand(false)
                    setIsCustomVariant(false)
                  }}
                >
                  {!category ? (
                    <option value="">-- Select Category First --</option>
                  ) : (
                    <>
                      <option value="" disabled>-- Select {category} Type --</option>
                      {availableItemTypes.map((t) => (
                        <option key={t.id || t.name} value={t.name}>
                          {t.name}
                        </option>
                      ))}
                      <option value="__custom__">+ Custom Item Type...</option>
                    </>
                  )}
                </FormSelect>
              ) : (
                <div className="form-select-group">
                  <span className="form-label-with-icon">
                    <Layers size={14} className="form-label-icon" />
                    <span className="form-label-title">Item Type</span>
                    <span className="text-red-600 font-bold ml-0.5">*</span>
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      required={!useCustomName}
                      value={itemType}
                      onChange={(e) => {
                        setItemType(e.target.value)
                        setBrand('')
                        setVariant('')
                      }}
                      placeholder="e.g. Bottled Water, Canned Goods, Rice..."
                      className="form-input-enhanced"
                      style={{ flex: 1 }}
                      autoFocus={isCustomItemType}
                    />
                    <button
                      type="button"
                      className="btn btn--ghost btn--xs"
                      onClick={() => {
                        setIsCustomItemType(false)
                        setItemType(availableItemTypes[0]?.name || '')
                      }}
                      title="Choose from list"
                    >
                      Choose list
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="form-row form-row--2">
              {/* Brand / Manufacturer */}
              {!isCustomBrand ? (
                <FormSelect
                  label="Brand / Manufacturer"
                  icon={Tag}
                  optional
                  disabled={!itemType}
                  value={
                    !itemType
                      ? ''
                      : availableBrands.some((b) => b.name.toLowerCase() === (brand || '').toLowerCase()) ||
                        brand === 'Generic / Unbranded' ||
                        brand === ''
                      ? brand
                      : '__custom__'
                  }
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setIsCustomBrand(true)
                      setBrand('')
                    } else {
                      setBrand(e.target.value)
                    }
                  }}
                >
                  {!itemType ? (
                    <option value="">-- Select Item Type First --</option>
                  ) : (
                    <>
                      <option value="">-- Select or enter brand --</option>
                      <option value="Generic / Unbranded">Generic / Unbranded</option>
                      {availableBrands.map((b) => (
                        <option key={b.id || b.name} value={b.name}>
                          {b.name}
                        </option>
                      ))}
                      <option value="__custom__">+ Custom Brand...</option>
                    </>
                  )}
                </FormSelect>
              ) : (
                <div className="form-select-group">
                  <span className="form-label-with-icon">
                    <Tag size={14} className="form-label-icon" />
                    <span className="form-label-title">Brand / Manufacturer</span>
                    <span className="field-hint-inline">(Optional)</span>
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      placeholder="e.g. Nature's Spring, Wilkins, Mega..."
                      className="form-input-enhanced"
                      style={{ flex: 1 }}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="btn btn--ghost btn--xs"
                      onClick={() => {
                        setIsCustomBrand(false)
                        setBrand('')
                      }}
                      title="Choose from list"
                    >
                      Choose list
                    </button>
                  </div>
                </div>
              )}

              {/* Variant / Size / Spec */}
              {!isCustomVariant ? (
                <FormSelect
                  label="Variant / Size / Spec"
                  icon={Ruler}
                  optional
                  disabled={!itemType}
                  value={
                    !itemType
                      ? ''
                      : availableVariants.some((v) => v.name.toLowerCase() === (variant || '').toLowerCase()) ||
                        variant === 'Standard / Regular' ||
                        variant === ''
                      ? variant
                      : '__custom__'
                  }
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setIsCustomVariant(true)
                      setVariant('')
                    } else {
                      setVariant(e.target.value)
                    }
                  }}
                >
                  {!itemType ? (
                    <option value="">-- Select Item Type First --</option>
                  ) : (
                    <>
                      <option value="">-- e.g. 500ml, 155g, XL, 25kg... --</option>
                      <option value="Standard / Regular">Standard / Regular</option>
                      {availableVariants.map((v) => (
                        <option key={v.id || v.name} value={v.name}>
                          {v.name}
                        </option>
                      ))}
                      <option value="__custom__">+ Custom Spec / Size...</option>
                    </>
                  )}
                </FormSelect>
              ) : (
                <div className="form-select-group">
                  <span className="form-label-with-icon">
                    <Ruler size={14} className="form-label-icon" />
                    <span className="form-label-title">Variant / Size / Spec</span>
                    <span className="field-hint-inline">(Optional)</span>
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      value={variant}
                      onChange={(e) => setVariant(e.target.value)}
                      placeholder="e.g. 500ml, 155g, XL, 25kg..."
                      className="form-input-enhanced"
                      style={{ flex: 1 }}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="btn btn--ghost btn--xs"
                      onClick={() => {
                        setIsCustomVariant(false)
                        setVariant('')
                      }}
                      title="Choose from list"
                    >
                      Choose list
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Assembled Item Preview */}
            <div className="inv-name-preview-box">
              <div className="inv-name-preview-header">
                <span className="inv-name-preview-label">
                  <Sparkles size={14} style={{ color: '#AF101A' }} /> Effective Item Display Name:
                </span>
                <button
                  type="button"
                  className="btn-link-small"
                  onClick={() => setUseCustomName(!useCustomName)}
                >
                  {useCustomName ? 'Switch to Auto-Generated Name' : 'Custom Override'}
                </button>
              </div>

              {useCustomName ? (
                <input
                  type="text"
                  required
                  value={customItemName}
                  onChange={(e) => setCustomItemName(e.target.value)}
                  placeholder="Enter custom full item name..."
                  className="form-input-enhanced mt-1"
                />
              ) : (
                <div className="inv-name-preview-value">
                  {autoGeneratedName || <span className="text-gray-400">Specify details above...</span>}
                </div>
              )}
            </div>
          </div>

          {/* Stock & Measurement Card */}
          <div className="inv-form-card mt-3">
            <div className="inv-form-card__header">
              <Hash size={16} className="text-red-700" />
              <h4>Stock &amp; Thresholds</h4>
            </div>

            <div className="form-row form-row--2">
              <label>
                <span className="form-label-with-icon">
                  <span className="form-label-title">{isEditing ? 'Available Quantity' : 'Initial Quantity Received'}</span>
                  <span className="text-red-600 font-bold ml-0.5">*</span>
                </span>
                <input
                  type="number"
                  min="0"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="form-input-enhanced"
                />
                {isEditing && (
                  <span className="field-hint-inline">
                    Original total received: {initialData?.totalQuantity ?? initialData?.quantity ?? 0} {initialData?.unit || unit}
                  </span>
                )}
              </label>

              {!isCustomUnit ? (
                <FormSelect
                  label="Unit of Measurement"
                  required
                  value={
                    availableUnits.includes((unit || '').toLowerCase())
                      ? (unit || '').toLowerCase()
                      : unit
                      ? '__custom__'
                      : 'pcs'
                  }
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setIsCustomUnit(true)
                      setUnit('')
                    } else {
                      setUnit(e.target.value)
                    }
                  }}
                >
                  {availableUnits.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                  <option value="__custom__">+ Custom Unit...</option>
                </FormSelect>
              ) : (
                <div className="form-select-group">
                  <span className="form-label-with-icon">
                    <span className="form-label-title">Unit of Measurement</span>
                    <span className="text-red-600 font-bold ml-0.5">*</span>
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      required
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="e.g. bundles, crates..."
                      className="form-input-enhanced"
                      style={{ flex: 1 }}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="btn btn--ghost btn--xs"
                      onClick={() => {
                        setIsCustomUnit(false)
                        setUnit('pcs')
                      }}
                      title="Choose from list"
                    >
                      Choose list
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="form-row form-row--2">
              <label>
                <span className="form-label-with-icon">
                  <span className="form-label-title">Low Stock Threshold</span>
                </span>
                <input
                  type="number"
                  min="0"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                  className="form-input-enhanced"
                  placeholder="e.g. 50"
                />
              </label>

              <label>
                <span className="form-label-with-icon">
                  <span className="form-label-title">Moderate Stock Threshold</span>
                  <span className="field-hint-inline">(Optional)</span>
                </span>
                <input
                  type="number"
                  min="0"
                  value={moderateStockThreshold}
                  onChange={(e) => setModerateStockThreshold(e.target.value)}
                  className="form-input-enhanced"
                  placeholder="e.g. 150"
                />
              </label>
            </div>

            {isEditing && (
              <div className="form-row form-row--2 mt-2 pt-2 border-t border-gray-100">
                <label>
                  <span>Currently Allocated (System-Controlled)</span>
                  <input
                    type="number"
                    min="0"
                    value={allocated}
                    readOnly
                    disabled
                    className="form-input-enhanced"
                  />
                </label>
                <label>
                  <span>Distributed Stock (System-Controlled)</span>
                  <input
                    type="number"
                    min="0"
                    value={distributed}
                    readOnly
                    disabled
                    className="form-input-enhanced"
                  />
                </label>
              </div>
            )}
          </div>

          <div className="admin-modal__actions mt-4">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--success"
              disabled={saving || !effectiveItemName.trim()}
            >
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : '+ Add to Inventory'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
