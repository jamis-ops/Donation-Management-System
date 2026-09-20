import { useState, useEffect } from 'react'
import {
  Package,
  Layers,
  Tag,
  Ruler,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Info,
  Layers3,
} from 'lucide-react'
import ModalHeader from './ModalHeader'
import { Select } from '../../../components/ui/select'
import { useInventoryCatalog } from '../../../hooks/useInventoryCatalog'

export default function InKindIntakeModal({
  isOpen,
  onClose,
  donation,
  onConfirm,
  saving = false,
}) {
  const { categories, units, getItemTypesByCategory, getBrandsByItemType, getVariantsByItemType } = useInventoryCatalog()

  const [items, setItems] = useState([
    {
      id: 1,
      category: 'Food',
      itemType: '',
      brand: '',
      variant: '',
      quantity: '1',
      unit: 'pcs',
      lowStockThreshold: '50',
    },
  ])

  // Pre-seed first item category if donation already had one
  useEffect(() => {
    if (donation && isOpen) {
      const initCat = donation.category || 'Food'
      setItems([
        {
          id: Date.now(),
          category: initCat,
          itemType: '',
          brand: '',
          variant: '',
          quantity: '1',
          unit: 'pcs',
          lowStockThreshold: '50',
        },
      ])
    }
  }, [donation, isOpen])

  const handleAddItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        category: prev[prev.length - 1]?.category || 'Food',
        itemType: '',
        brand: '',
        variant: '',
        quantity: '1',
        unit: 'pcs',
        lowStockThreshold: '50',
      },
    ])
  }

  const handleRemoveItemRow = (index) => {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpdateItemRow = (index, field, value) => {
    setItems((prev) => {
      const updated = [...prev]
      const row = { ...updated[index], [field]: value }
      if (field === 'category') {
        row.itemType = ''
        row.brand = ''
        row.variant = ''
      } else if (field === 'itemType') {
        row.brand = ''
        row.variant = ''
      }
      updated[index] = row
      return updated
    })
  }

  const assembleRowName = (row) => {
    const parts = []
    if (row.brand?.trim()) parts.push(row.brand.trim())
    if (row.itemType?.trim()) parts.push(row.itemType.trim())
    let name = parts.join(' ')
    if (!name) name = row.category ? `${row.category} Item` : 'Item'
    if (row.variant?.trim()) name += ` (${row.variant.trim()})`
    return name
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    const preparedItems = items.map((row) => ({
      category: row.category.trim(),
      itemType: row.itemType.trim() || null,
      brand: row.brand.trim() || null,
      variant: row.variant.trim() || null,
      quantity: Math.max(1, parseInt(row.quantity, 10) || 1),
      unit: row.unit.trim() || 'pcs',
      lowStockThreshold: Math.max(0, parseInt(row.lowStockThreshold, 10) || 50),
      item: assembleRowName(row),
    }))

    onConfirm({
      classifiedItems: preparedItems,
      status: 'Verified',
    })
  }

  if (!isOpen || !donation) return null

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div
        className="admin-modal admin-modal--wide"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '820px', maxHeight: '92vh', overflowY: 'auto' }}
      >
        <ModalHeader
          title={`Verify & Classify In-Kind Donation — ${donation.trackingCode || donation.id}`}
          onClose={onClose}
        />

        <form onSubmit={handleSubmit} className="in-kind-intake-form">
          {/* Donor Source Overview Box */}
          <div className="intake-donor-summary">
            <div className="intake-donor-summary__item">
              <span className="text-muted text-xs">Donor</span>
              <strong>{donation.donor}</strong>
            </div>
            <div className="intake-donor-summary__item">
              <span className="text-muted text-xs">Category</span>
              <strong>{donation.category || 'General In-Kind'}</strong>
            </div>
            <div className="intake-donor-summary__item">
              <span className="text-muted text-xs">Date Received</span>
              <span>{donation.date || donation.donationDate}</span>
            </div>
          </div>

          <div className="intake-raw-description">
            <div className="intake-raw-desc-header">
              <Info size={14} className="text-blue-600" />
              <span>Original Donor Description:</span>
            </div>
            <p className="intake-raw-desc-text">
              "{donation.itemsDescription || 'No detailed description provided by donor.'}"
            </p>
          </div>

          <div className="intake-instructions">
            <Layers3 size={16} className="text-red-700" />
            <div>
              <strong>Warehouse Intake Classification</strong>
              <p className="text-xs text-muted">
                Classify this donation into exact items (Category → Item Type → Brand → Variant/Size → Quantity).
                These will be automatically credited to warehouse inventory balances.
              </p>
            </div>
          </div>

          {/* Items breakdown list */}
          <div className="intake-items-list">
            {items.map((row, index) => {
              const typesForCat = getItemTypesByCategory(row.category)
              const brandsForType = getBrandsByItemType(row.itemType, row.category)
              const variantsForType = getVariantsByItemType(row.itemType, row.category)
              const assembled = assembleRowName(row)

              return (
                <div key={row.id} className="intake-item-row-card">
                  <div className="intake-item-row-card__header">
                    <div className="flex items-center gap-2">
                      <span className="intake-row-number">#{index + 1}</span>
                      <strong className="text-sm">{assembled}</strong>
                    </div>
                    {items.length > 1 && (
                      <button
                        type="button"
                        className="btn-remove-row"
                        onClick={() => handleRemoveItemRow(index)}
                        title="Remove item"
                      >
                        <Trash2 size={14} /> Remove
                      </button>
                    )}
                  </div>

                  <div className="intake-form-grid">
                    {/* Category */}
                    <div className="form-group">
                      <label className="text-xs font-semibold">
                        Category <span className="text-red-600">*</span>
                      </label>
                      <Select
                        required
                        value={row.category}
                        onChange={(e) => handleUpdateItemRow(index, 'category', e.target.value)}
                        className="form-select-sm"
                      >
                        <option value="" disabled>-- Category --</option>
                        {categories.map((c) => (
                          <option key={c.id || c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </Select>
                    </div>

                    {/* Item Type */}
                    <div className="form-group">
                      <label className="text-xs font-semibold">
                        Item Type <span className="text-red-600">*</span>
                      </label>
                      <Select
                        required
                        disabled={!row.category}
                        value={row.itemType}
                        onChange={(e) => handleUpdateItemRow(index, 'itemType', e.target.value)}
                        className="form-select-sm"
                      >
                        {!row.category ? (
                          <option value="">-- Select Category First --</option>
                        ) : (
                          <>
                            <option value="" disabled>-- Select Item Type --</option>
                            {typesForCat.map((t) => (
                              <option key={t.id || t.name} value={t.name}>
                                {t.name}
                              </option>
                            ))}
                          </>
                        )}
                      </Select>
                    </div>

                    {/* Brand */}
                    <div className="form-group">
                      <label className="text-xs font-semibold">
                        Brand <span className="text-muted font-normal">(Optional)</span>
                      </label>
                      <Select
                        disabled={!row.itemType}
                        value={row.brand}
                        onChange={(e) => handleUpdateItemRow(index, 'brand', e.target.value)}
                        className="form-select-sm"
                      >
                        {!row.itemType ? (
                          <option value="">-- Select Type First --</option>
                        ) : (
                          <>
                            <option value="">-- Select or enter brand --</option>
                            <option value="Generic / Unbranded">Generic / Unbranded</option>
                            {brandsForType.map((b) => (
                              <option key={b.id || b.name} value={b.name}>
                                {b.name}
                              </option>
                            ))}
                          </>
                        )}
                      </Select>
                    </div>

                    {/* Variant */}
                    <div className="form-group">
                      <label className="text-xs font-semibold">
                        Variant / Size <span className="text-muted font-normal">(Optional)</span>
                      </label>
                      <Select
                        disabled={!row.itemType}
                        value={row.variant}
                        onChange={(e) => handleUpdateItemRow(index, 'variant', e.target.value)}
                        className="form-select-sm"
                      >
                        {!row.itemType ? (
                          <option value="">-- Select Type First --</option>
                        ) : (
                          <>
                            <option value="">-- e.g. 500ml, 155g, XL... --</option>
                            <option value="Standard / Regular">Standard / Regular</option>
                            {variantsForType.map((v) => (
                              <option key={v.id || v.name} value={v.name}>
                                {v.name}
                              </option>
                            ))}
                          </>
                        )}
                      </Select>
                    </div>

                    {/* Quantity */}
                    <div className="form-group form-group--qty">
                      <label className="text-xs font-semibold">
                        Qty <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={row.quantity}
                        onChange={(e) => handleUpdateItemRow(index, 'quantity', e.target.value)}
                        className="form-input-enhanced form-input-sm"
                      />
                    </div>

                    {/* Unit */}
                    <div className="form-group form-group--unit">
                      <label className="text-xs font-semibold">
                        Unit <span className="text-red-600">*</span>
                      </label>
                      <Select
                        required
                        value={row.unit}
                        onChange={(e) => handleUpdateItemRow(index, 'unit', e.target.value)}
                        className="form-select-sm"
                      >
                        {units.map((u) => (
                          <option key={u.id || u.name} value={u.name.toLowerCase()}>
                            {u.name}
                          </option>
                        ))}
                        <option value="pcs">pcs</option>
                        <option value="bottles">bottles</option>
                        <option value="cans">cans</option>
                        <option value="packs">packs</option>
                        <option value="sacks">sacks</option>
                        <option value="boxes">boxes</option>
                      </Select>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="intake-add-more-row">
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={handleAddItemRow}
            >
              <Plus size={14} className="mr-1" /> Add Another Item From This Donation
            </button>
          </div>

          {/* Action buttons */}
          <div className="admin-modal__actions mt-4 pt-3 border-t border-gray-200">
            <button
              type="submit"
              className="btn btn--primary"
              disabled={saving}
              style={{ backgroundColor: '#AF101A' }}
            >
              {saving ? 'Verifying & Posting...' : 'Verify & Add to Warehouse Inventory'}
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
