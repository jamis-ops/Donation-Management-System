import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Package,
  Layers,
  Tag,
  Ruler,
  Hash,
  Plus,
  Pencil,
  Trash2,
  Search,
  CheckCircle2,
  XCircle,
  FolderTree,
  Filter,
} from 'lucide-react'
import ModalHeader from './ModalHeader'
import { Select } from '../../../components/ui/select'
import { inventoryCatalogApi } from '../../../api/resources'
import { notify, confirmAction, showSuccessModal } from '../../../utils/confirm'
import { useLoading } from '../../../context/LoadingContext'

const TABS = [
  { key: 'categories', label: 'Categories', icon: Package, desc: 'Top-level disaster relief categories (e.g. Food, Water, Clothing)' },
  { key: 'item_types', label: 'Item Types', icon: Layers, desc: 'Specific types within categories (e.g. Canned Goods, Rice, Bottled Water)' },
  { key: 'brands', label: 'Brands / Makers', icon: Tag, desc: 'Brand names and manufacturers (e.g. Nature\'s Spring, Mega, Lucky Me)' },
  { key: 'variants', label: 'Variants & Sizes', icon: Ruler, desc: 'Standard pack sizes or volume specs (e.g. 500ml, 155g, 25kg sack, XL)' },
  { key: 'units', label: 'Measurement Units', icon: Hash, desc: 'Units of measure (e.g. cans, bottles, packs, sacks, boxes, pcs)' },
]

export default function InventoryCmsModal({ open, onClose }) {
  const [activeTab, setActiveTab] = useState('categories')
  const { showLoading, hideLoading } = useLoading()

  // All catalog tables loaded in state
  const [categories, setCategories] = useState([])
  const [itemTypes, setItemTypes] = useState([])
  const [brands, setBrands] = useState([])
  const [variants, setVariants] = useState([])
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters & search
  const [search, setSearch] = useState('')
  const [parentFilter, setParentFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Sub-modal for Add / Edit
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [formName, setFormName] = useState('')
  const [formParentId, setFormParentId] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formIsActive, setFormIsActive] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [catsRes, typesRes, brandsRes, varsRes, unitsRes] = await Promise.all([
        inventoryCatalogApi.list('categories', { activeOnly: false }),
        inventoryCatalogApi.list('item_types', { activeOnly: false }),
        inventoryCatalogApi.list('brands', { activeOnly: false }),
        inventoryCatalogApi.list('variants', { activeOnly: false }),
        inventoryCatalogApi.list('units', { activeOnly: false }),
      ])

      const getList = (res, key) => {
        if (Array.isArray(res?.data)) return res.data
        if (res?.data && typeof res.data === 'object' && Array.isArray(res.data[key])) return res.data[key]
        if (Array.isArray(res)) return res
        return []
      }

      setCategories(getList(catsRes, 'categories'))
      setItemTypes(getList(typesRes, 'itemTypes'))
      setBrands(getList(brandsRes, 'brands'))
      setVariants(getList(varsRes, 'variants'))
      setUnits(getList(unitsRes, 'units'))
    } catch (err) {
      console.error('Failed to load CMS data:', err)
      notify.error(err.message || 'Failed to load catalog settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchAll()
    }
  }, [open, fetchAll])

  // Current list based on active tab
  const currentList = useMemo(() => {
    let list = []
    switch (activeTab) {
      case 'categories': list = categories; break
      case 'item_types': list = itemTypes; break
      case 'brands': list = brands; break
      case 'variants': list = variants; break
      case 'units': list = units; break
      default: list = []
    }
    return Array.isArray(list) ? list : []
  }, [activeTab, categories, itemTypes, brands, variants, units])

  // Filtered list
  const filteredList = useMemo(() => {
    return currentList.filter((item) => {
      // Status filter
      if (statusFilter === 'active' && !item.isActive) return false
      if (statusFilter === 'inactive' && item.isActive) return false

      // Parent filter
      if (parentFilter !== 'all') {
        if (activeTab === 'item_types' && String(item.categoryId) !== parentFilter) return false
        if (activeTab === 'brands' && String(item.itemTypeId) !== parentFilter) return false
        if (activeTab === 'variants' && String(item.itemTypeId) !== parentFilter) return false
      }

      // Search query
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const matchName = (item.name || '').toLowerCase().includes(q)
        const matchCat = (item.categoryName || '').toLowerCase().includes(q)
        const matchType = (item.itemTypeName || '').toLowerCase().includes(q)
        if (!matchName && !matchCat && !matchType) return false
      }

      return true
    })
  }, [currentList, statusFilter, parentFilter, search, activeTab])

  // Open Add modal
  const handleOpenAdd = () => {
    setEditingItem(null)
    setFormName('')
    setFormParentId('')
    setFormDescription('')
    setFormIsActive(true)
    setShowEditModal(true)
  }

  // Open Edit modal
  const handleOpenEdit = (item) => {
    setEditingItem(item)
    setFormName(item.name || '')
    setFormParentId(item.categoryId ? String(item.categoryId) : item.itemTypeId ? String(item.itemTypeId) : '')
    setFormDescription(item.description || '')
    setFormIsActive(Boolean(item.isActive))
    setShowEditModal(true)
  }

  // Save Add / Edit
  const handleSaveItem = async (e) => {
    e.preventDefault()
    if (!formName.trim()) {
      notify.warning('Name is required.')
      return
    }

    showLoading('Saving catalog entry…')
    try {
      const payload = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        isActive: formIsActive,
      }

      if (activeTab === 'item_types') {
        payload.categoryId = formParentId ? parseInt(formParentId, 10) : null
      } else if (activeTab === 'brands' || activeTab === 'variants') {
        payload.itemTypeId = formParentId ? parseInt(formParentId, 10) : null
      }

      if (editingItem) {
        await inventoryCatalogApi.update(activeTab, editingItem.id, payload)
        notify.success(`"${payload.name}" updated successfully.`)
      } else {
        await inventoryCatalogApi.create(activeTab, payload)
        notify.success(`"${payload.name}" created successfully.`)
      }

      showSuccessModal('Catalog updated.')
      setShowEditModal(false)
      fetchAll()
    } catch (err) {
      notify.error(err.message || 'Failed to save item')
    } finally {
      hideLoading()
    }
  }

  // Delete item
  const handleDeleteItem = async (item) => {
    const ok = await confirmAction({
      title: `Delete from ${activeTab.replace('_', ' ')}?`,
      message: `Are you sure you want to permanently delete "${item.name}"? This cannot be undone.`,
      confirmText: 'Delete',
      type: 'danger',
    })
    if (!ok) return

    showLoading('Deleting…')
    try {
      await inventoryCatalogApi.remove(activeTab, item.id)
      notify.success(`"${item.name}" deleted.`)
      showSuccessModal('Successfully removed.')
      fetchAll()
    } catch (err) {
      notify.error(err.message || 'Failed to delete')
    } finally {
      hideLoading()
    }
  }

  // Toggle active status
  const handleToggleActive = async (item) => {
    try {
      await inventoryCatalogApi.update(activeTab, item.id, {
        isActive: !item.isActive,
      })
      notify.success(`"${item.name}" set to ${!item.isActive ? 'Active' : 'Inactive'}.`)
      fetchAll()
    } catch (err) {
      notify.error(err.message || 'Failed to update status')
    }
  }

  if (!open) return null

  const currentTabInfo = TABS.find((t) => t.key === activeTab)

  return createPortal(
    <div className="admin-modal-overlay" onClick={onClose}>
      <div
        className="admin-modal admin-modal--wide inv-cms-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '900px', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        <ModalHeader
          title="Inventory Catalog CMS"
          onClose={onClose}
        />

        <div className="inv-cms-intro">
          <FolderTree size={18} className="text-red-700 mr-2 flex-shrink-0" />
          <p className="text-xs text-muted m-0">
            Configure the standardized <strong>Category → Item Type → Brand → Variant/Size</strong> hierarchy and measurement units used across inventory management and donation intakes.
          </p>
        </div>

        {/* Tab navigation bar */}
        <div className="admin-tabs inv-cms-tabs">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                type="button"
                className={`admin-tab${activeTab === tab.key ? ' admin-tab--active' : ''}`}
                onClick={() => {
                  setActiveTab(tab.key)
                  setSearch('')
                  setParentFilter('all')
                  setStatusFilter('all')
                }}
              >
                <Icon size={14} className="mr-1" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab toolbar with search, filters, and Add Button */}
        <div className="inv-cms-toolbar">
          <div className="inv-cms-toolbar__left">
            <div className="inv-cms-search">
              <Search size={14} className="text-gray-400" />
              <input
                type="text"
                placeholder={`Search ${currentTabInfo?.label.toLowerCase()}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Parent selector filter if applicable */}
            {activeTab === 'item_types' && (
              <select
                className="form-select-sm"
                value={parentFilter}
                onChange={(e) => setParentFilter(e.target.value)}
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
            )}

            {(activeTab === 'brands' || activeTab === 'variants') && (
              <select
                className="form-select-sm"
                value={parentFilter}
                onChange={(e) => setParentFilter(e.target.value)}
              >
                <option value="all">All Item Types</option>
                {itemTypes.map((t) => (
                  <option key={t.id} value={String(t.id)}>{t.name}</option>
                ))}
              </select>
            )}

            <select
              className="form-select-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={handleOpenAdd}
            style={{ backgroundColor: '#AF101A' }}
          >
            <Plus size={14} className="mr-1" /> Add {currentTabInfo?.label.slice(0, -1) || 'Item'}
          </button>
        </div>

        {/* Content Table */}
        <div className="inv-cms-content" style={{ flex: 1, overflowY: 'auto', minHeight: '260px' }}>
          {loading ? (
            <div className="text-center py-8 text-muted">Loading catalog entries…</div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-8 text-muted">
              No entries found. Click "+ Add" to create one.
            </div>
          ) : (
            <table className="inv-cms-table">
              <thead>
                <tr>
                  <th>Name / Value</th>
                  {activeTab === 'item_types' && <th>Category</th>}
                  {(activeTab === 'brands' || activeTab === 'variants') && <th>Linked Item Type</th>}
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((item) => (
                  <tr key={item.id} className={!item.isActive ? 'opacity-60 bg-gray-50' : ''}>
                    <td>
                      <div className="font-semibold text-slate-800">{item.name}</div>
                      {item.description && (
                        <span className="text-xs text-muted">{item.description}</span>
                      )}
                    </td>

                    {activeTab === 'item_types' && (
                      <td>
                        <span className="inv-category">
                          {item.categoryName || 'General / Unlinked'}
                        </span>
                      </td>
                    )}

                    {(activeTab === 'brands' || activeTab === 'variants') && (
                      <td>
                        <span className="inv-subcat-badge">
                          {item.itemTypeName || 'General / All Types'}
                        </span>
                      </td>
                    )}

                    <td>
                      <button
                        type="button"
                        className={`status-chip ${item.isActive ? 'status-chip--active' : 'status-chip--inactive'}`}
                        onClick={() => handleToggleActive(item)}
                        title="Click to toggle active status"
                      >
                        {item.isActive ? (
                          <>
                            <CheckCircle2 size={12} className="mr-1 text-emerald-600" /> Active
                          </>
                        ) : (
                          <>
                            <XCircle size={12} className="mr-1 text-slate-400" /> Inactive
                          </>
                        )}
                      </button>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div className="inv-action-buttons">
                        <button
                          type="button"
                          className="btn btn--ghost btn--xs"
                          onClick={() => handleOpenEdit(item)}
                          title="Edit Entry"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost btn--xs text-red-600"
                          onClick={() => handleDeleteItem(item)}
                          title="Delete Entry"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal footer */}
        <div className="admin-modal__actions border-t border-gray-200 pt-3 mt-2">
          <span className="text-xs text-muted">
            Showing {filteredList.length} of {currentList.length} entries
          </span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
            Close
          </button>
        </div>

        {/* Add / Edit Sub-Modal */}
        {showEditModal && (
          <div className="admin-modal-overlay" style={{ zIndex: 1100 }} onClick={() => setShowEditModal(false)}>
            <div
              className="admin-modal"
              style={{ maxWidth: '480px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <ModalHeader
                title={`${editingItem ? 'Edit' : 'Add'} ${currentTabInfo?.label.slice(0, -1) || 'Entry'}`}
                onClose={() => setShowEditModal(false)}
              />

              <form onSubmit={handleSaveItem} className="p-3">
                <div className="form-group mb-3">
                  <label className="text-xs font-semibold block mb-1">
                    Name / Display Label <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Canned Goods, 500ml, Wilkins..."
                    className="form-input-enhanced"
                    autoFocus
                  />
                </div>

                {activeTab === 'item_types' && (
                  <div className="form-group mb-3">
                    <label className="text-xs font-semibold block mb-1">
                      Parent Category <span className="text-muted font-normal">(Optional)</span>
                    </label>
                    <Select
                      value={formParentId}
                      onChange={(e) => setFormParentId(e.target.value)}
                    >
                      <option value="">Select Category...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={String(c.id)}>{c.name}</option>
                      ))}
                    </Select>
                  </div>
                )}

                {(activeTab === 'brands' || activeTab === 'variants') && (
                  <div className="form-group mb-3">
                    <label className="text-xs font-semibold block mb-1">
                      Parent Item Type <span className="text-muted font-normal">(Optional)</span>
                    </label>
                    <Select
                      value={formParentId}
                      onChange={(e) => setFormParentId(e.target.value)}
                    >
                      <option value="">Applies to all types / General</option>
                      {itemTypes.map((t) => (
                        <option key={t.id} value={String(t.id)}>{t.name}</option>
                      ))}
                    </Select>
                  </div>
                )}

                <div className="form-group mb-3">
                  <label className="text-xs font-semibold block mb-1">
                    Description / Notes <span className="text-muted font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Brief description or notes"
                    className="form-input-enhanced"
                  />
                </div>

                <div className="form-group mb-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      style={{ accentColor: '#AF101A' }}
                    />
                    <span>Active and available in dropdown lists</span>
                  </label>
                </div>

                <div className="admin-modal__actions">
                  <button
                    type="submit"
                    className="btn btn--primary"
                    style={{ backgroundColor: '#AF101A' }}
                  >
                    {editingItem ? 'Save Changes' : 'Create Entry'}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setShowEditModal(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
