import { useState, useEffect, useMemo } from 'react'
import { Package, Layers, Tag, Ruler, Hash, AlertTriangle, Sparkles, Check, X } from 'lucide-react'
import ModalHeader from '../../admin/components/shared/ModalHeader'
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
  const [variant, setVariant] = useState('')
  const [customItemName, setCustomItemName] = useState('')
  const [useCustomName, setUseCustomName] = useState(false)
  
  const [quantity, setQuantity] = useState('0')
  const [unit, setUnit] = useState('pcs')
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
      setVariant(initialData.variant || '')
      setQuantity(String(initialData.quantity ?? '0'))
      setUnit(initialData.unit || 'pcs')
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
      setVariant('')
      setCustomItemName('')
      setUseCustomName(false)
      setQuantity('0')
      setUnit('pcs')
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
    return getBrandsByItemType(itemType)
  }, [itemType, getBrandsByItemType])

  const availableVariants = useMemo(() => {
    return getVariantsByItemType(itemType)
  }, [itemType, getVariantsByItemType])

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
              <label>
                <span className="form-label-with-icon">
                  <Package size={14} /> Category <span className="text-red-600">*</span>
                </span>
                {!isCustomCategory ? (
                  <select
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
                    }}
                    className="form-input-enhanced"
                    style={{ fontWeight: 600 }}
                  >
                    <option value="" disabled>-- Select Category --</option>
                    {allCategoriesList.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                    <option value="__custom__">+ Custom Category...</option>
                  </select>
                ) : (
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
                )}
              </label>

              <label>
                <span className="form-label-with-icon">
                  <Layers size={14} /> Item Type <span className="text-red-600">*</span>
                </span>
                {!isCustomItemType && availableItemTypes.length > 0 ? (
                  <select
                    required={!useCustomName}
                    value={availableItemTypes.some(t => t.name.toLowerCase() === (itemType || '').toLowerCase()) ? itemType : (itemType ? '__custom__' : '')}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setIsCustomItemType(true)
                        setItemType('')
                      } else {
                        setItemType(e.target.value)
                        setBrand('')
                        setVariant('')
                      }
                    }}
                    className="form-input-enhanced"
                  >
                    <option value="" disabled>-- Select {category || 'Item'} Type --</option>
                    {availableItemTypes.map((t) => (
                      <option key={t.id || t.name} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                    <option value="__custom__">+ Custom Item Type...</option>
                  </select>
                ) : (
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
                    {availableItemTypes.length > 0 && (
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
                    )}
                  </div>
                )}
              </label>
            </div>

            <div className="form-row form-row--2">
              <label>
                <span className="form-label-with-icon">
                  <Tag size={14} /> Brand / Manufacturer <span className="field-hint-inline">(Optional)</span>
                </span>
                <input
                  list="inv-modal-brand-list"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="e.g. Nature's Spring, Wilkins, Mega..."
                  className="form-input-enhanced"
                />
                <datalist id="inv-modal-brand-list">
                  {availableBrands.map((b) => (
                    <option key={b.id || b.name} value={b.name} />
                  ))}
                </datalist>
              </label>

              <label>
                <span className="form-label-with-icon">
                  <Ruler size={14} /> Variant / Size / Spec <span className="field-hint-inline">(Optional)</span>
                </span>
                <input
                  list="inv-modal-variant-list"
                  value={variant}
                  onChange={(e) => setVariant(e.target.value)}
                  placeholder="e.g. 500ml, 155g, XL, 25kg..."
                  className="form-input-enhanced"
                />
                <datalist id="inv-modal-variant-list">
                  {availableVariants.map((v) => (
                    <option key={v.id || v.name} value={v.name} />
                  ))}
                </datalist>
              </label>
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
                <span>Stock Quantity <span className="text-red-600">*</span></span>
                <input
                  type="number"
                  min="0"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="form-input-enhanced"
                />
              </label>

              <label>
                <span>Unit of Measurement <span className="text-red-600">*</span></span>
                <input
                  list="inv-modal-unit-list"
                  required
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="e.g. bottles, cans, packs, kg, pcs..."
                  className="form-input-enhanced"
                />
                <datalist id="inv-modal-unit-list">
                  {units.map((u) => (
                    <option key={u.id} value={u.name} />
                  ))}
                  <option value="pcs" />
                  <option value="bottles" />
                  <option value="cans" />
                  <option value="packs" />
                  <option value="sacks" />
                  <option value="boxes" />
                  <option value="kg" />
                  <option value="liters" />
                </datalist>
              </label>
            </div>

            <div className="form-row form-row--2">
              <label>
                <span>Low Stock Threshold</span>
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
                <span>Moderate Stock Threshold <span className="field-hint-inline">(Optional)</span></span>
                <input
                  type="number"
                  min="0"
                  value={moderateStockThreshold}
                  onChange={(e) => setModerateStockThreshold(e.target.value)}
                  className="form-input-enhanced"
                  placeholder="Defaults to 2× Low"
                />
              </label>
            </div>

            {isEditing && (
              <div className="form-row form-row--2 mt-2 pt-2 border-t border-gray-100">
                <label>
                  <span>Allocated Stock</span>
                  <input
                    type="number"
                    min="0"
                    value={allocated}
                    onChange={(e) => setAllocated(e.target.value)}
                    className="form-input-enhanced"
                  />
                </label>
                <label>
                  <span>Distributed Stock</span>
                  <input
                    type="number"
                    min="0"
                    value={distributed}
                    onChange={(e) => setDistributed(e.target.value)}
                    className="form-input-enhanced"
                  />
                </label>
              </div>
            )}
          </div>

          <div className="admin-modal__actions mt-4">
            <button
              type="submit"
              className="btn btn--primary"
              disabled={saving || !effectiveItemName.trim()}
              style={{ backgroundColor: '#AF101A' }}
            >
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : '+ Add to Inventory'}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
