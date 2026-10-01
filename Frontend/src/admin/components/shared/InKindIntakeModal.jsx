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
      status: 'Completed',
    })
  }

  if (!isOpen || !donation) return null

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div
        className="admin-modal in-kind-intake-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalHeader
          title={`Verify & Classify In-Kind Donation — ${donation.trackingCode || donation.id}`}
          onClose={onClose}
        />

        <form id="in-kind-intake-form" onSubmit={handleSubmit} className="in-kind-intake-form">
          <div className="in-kind-intake-modal__body">
            {/* Donor Source Overview Box */}
            <div className="intake-donor-summary">
              <div className="intake-donor-summary__item">
                <span className="intake-donor-summary__label">Donor</span>
                <strong className="intake-donor-summary__value">{donation.donor}</strong>
              </div>
              <div className="intake-donor-summary__item">
                <span className="intake-donor-summary__label">Category</span>
                <strong className="intake-donor-summary__value">{donation.category || 'General In-Kind'}</strong>
              </div>
              <div className="intake-donor-summary__item">
                <span className="intake-donor-summary__label">Date Received</span>
                <span className="intake-donor-summary__value">{donation.date || donation.donationDate}</span>
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
                      <div className="intake-item-row-card__title-group">
                        <span className="intake-row-number">#{index + 1}</span>
                        <strong className="intake-row-title">{assembled}</strong>
                      </div>
                      {items.length > 1 && (
                        <button
                          type="button"
                          className="btn-remove-row"
                          onClick={() => handleRemoveItemRow(index)}
                          title="Remove item"
                        >
                          <Trash2 size={13} /> Remove
                        </button>
                      )}
                    </div>

                    <div className="intake-form-grid">
                      {/* 1. Category */}
                      <div className="intake-field intake-field--category">
                        <label className="intake-label">
                          <span>Category</span>
                          <span className="req">*</span>
                        </label>
                        <Select
                          required
                          value={row.category}
                          onChange={(e) => handleUpdateItemRow(index, 'category', e.target.value)}
                          className="intake-select"
                        >
                          <option value="" disabled>-- Select Category --</option>
                          {categories.map((c) => (
                            <option key={c.id || c.name} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        </Select>
                      </div>

                      {/* 2. Item Type */}
                      <div className="intake-field intake-field--type">
                        <label className="intake-label">
                          <span>Item Type</span>
                          <span className="req">*</span>
                        </label>
                        <Select
                          required
                          disabled={!row.category}
                          value={row.itemType}
                          onChange={(e) => handleUpdateItemRow(index, 'itemType', e.target.value)}
                          className="intake-select"
                        >
                          {!row.category ? (
                            <option value="">-- Select Category --</option>
                          ) : (
                            <>
                              <option value="" disabled>-- Select Type --</option>
                              {typesForCat.map((t) => (
                                <option key={t.id || t.name} value={t.name}>
                                  {t.name}
                                </option>
                              ))}
                            </>
                          )}
                        </Select>
                      </div>

                      {/* 3. Brand */}
                      <div className="intake-field intake-field--brand">
                        <label className="intake-label">
                          <span>Brand</span>
                          <span className="intake-label-opt">(Optional)</span>
                        </label>
                        <Select
                          disabled={!row.itemType}
                          value={row.brand}
                          onChange={(e) => handleUpdateItemRow(index, 'brand', e.target.value)}
                          className="intake-select"
                        >
                          {!row.itemType ? (
                            <option value="">-- Select Type --</option>
                          ) : (
                            <>
                              <option value="">-- Select Brand --</option>
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

                      {/* 4. Variant / Size */}
                      <div className="intake-field intake-field--variant">
                        <label className="intake-label">
                          <span>Variant / Size</span>
                          <span className="intake-label-opt">(Optional)</span>
                        </label>
                        <Select
                          disabled={!row.itemType}
                          value={row.variant}
                          onChange={(e) => handleUpdateItemRow(index, 'variant', e.target.value)}
                          className="intake-select"
                        >
                          {!row.itemType ? (
                            <option value="">-- Select Type --</option>
                          ) : (
                            <>
                              <option value="">-- Select Variant --</option>
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

                      {/* 5. Quantity */}
                      <div className="intake-field intake-field--qty">
                        <label className="intake-label">
                          <span>Qty</span>
                          <span className="req">*</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={row.quantity}
                          onChange={(e) => handleUpdateItemRow(index, 'quantity', e.target.value)}
                          className="intake-input intake-input--qty"
                        />
                      </div>

                      {/* 6. Unit */}
                      <div className="intake-field intake-field--unit">
                        <label className="intake-label">
                          <span>Unit</span>
                          <span className="req">*</span>
                        </label>
                        <Select
                          required
                          value={row.unit}
                          onChange={(e) => handleUpdateItemRow(index, 'unit', e.target.value)}
                          className="intake-select"
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
                id="intake-add-item-btn"
                className="btn btn--outline intake-add-btn"
                onClick={handleAddItemRow}
              >
                <Plus size={16} /> Add Another Item From This Donation
              </button>
            </div>
          </div>

          {/* Action buttons footer */}
          <div className="admin-modal__actions in-kind-intake-modal__footer">
            <button
              type="button"
              className="btn btn--danger"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={saving}
            >
              {saving ? 'Verifying & Posting...' : 'Verify & Add to Warehouse Inventory'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
