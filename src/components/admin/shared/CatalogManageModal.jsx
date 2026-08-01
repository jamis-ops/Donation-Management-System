import { useCallback, useEffect, useRef, useState } from 'react'
import { Eye, Pencil, Plus, Trash2, X } from 'lucide-react'
import { catalogItemsApi } from '../../../api/resources'
import ModalHeader from './ModalHeader'
import { useSeeMore } from '../../../hooks/useSeeMore'
import { SeeMoreToggle } from './SeeMoreList'
import { notify } from '../../../utils/toast'

/**
 * Full CRUD modal for a Settings-managed catalog (Add / Edit / Delete / View).
 */
export default function CatalogManageModal({
  open,
  onClose,
  catalog,
  title,
  description,
  onChanged,
}) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [label, setLabel] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editLabel, setEditLabel] = useState('')
  const [viewItem, setViewItem] = useState(null)
  const onChangedRef = useRef(onChanged)
  onChangedRef.current = onChanged

  const load = useCallback(async () => {
    if (!catalog) return
    setLoading(true)
    try {
      const res = await catalogItemsApi.list(catalog, true)
      setItems(res?.data || [])
      onChangedRef.current?.(res?.data || [])
    } catch (err) {
      notify.error(err.message || `Could not load ${title}.`)
    } finally {
      setLoading(false)
    }
  }, [catalog, title])

  useEffect(() => {
    if (!open) return undefined
    void load()
    return undefined
  }, [open, load])

  const seeMore = useSeeMore(items, 8)

  if (!open) return null

  const handleAdd = async (e) => {
    e.preventDefault()
    const next = label.trim()
    if (!next) return
    setBusy(true)
    try {
      await catalogItemsApi.create(catalog, { label: next })
      setLabel('')
      notify.success(`“${next}” added.`)
      await load()
    } catch (err) {
      notify.error(err.message || 'Could not add item.')
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (row) => {
    setViewItem(null)
    setEditingId(row.dbId || row.id)
    setEditLabel(row.label)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditLabel('')
  }

  const saveEdit = async (row) => {
    const next = editLabel.trim()
    if (!next) {
      notify.warning('Label cannot be empty.')
      return
    }
    setBusy(true)
    try {
      await catalogItemsApi.update(catalog, row.dbId || row.id, {
        label: next,
        isActive: row.isActive !== false,
      })
      notify.success('Item updated.')
      cancelEdit()
      await load()
    } catch (err) {
      notify.error(err.message || 'Could not update item.')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete “${row.label}”? It will no longer appear in forms across the system.`)) {
      return
    }
    setBusy(true)
    try {
      await catalogItemsApi.remove(catalog, row.dbId || row.id)
      notify.success(`“${row.label}” deleted.`)
      if (viewItem && (viewItem.dbId || viewItem.id) === (row.dbId || row.id)) {
        setViewItem(null)
      }
      await load()
    } catch (err) {
      notify.error(err.message || 'Could not delete item.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal admin-modal--wide catalog-manage-modal" onClick={(e) => e.stopPropagation()}>
        <ModalHeader title={title} onClose={onClose} />
        {description && <p className="catalog-manage-modal__desc">{description}</p>}

        <form className="catalog-manage-modal__add" onSubmit={handleAdd}>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={`Add new ${title.replace(/^Manage\s+/i, '')}…`}
            maxLength={120}
            disabled={busy}
            aria-label={`New ${title}`}
          />
          <button type="submit" className="btn btn--sm btn--primary" disabled={busy || !label.trim()}>
            <Plus size={15} /> Add
          </button>
        </form>

        {loading ? (
          <p className="catalog-manage-modal__empty">Loading…</p>
        ) : items.length === 0 ? (
          <p className="catalog-manage-modal__empty">No items yet. Add the first one above.</p>
        ) : (
          <>
            <ul className="catalog-manage-modal__list" aria-label={title}>
              {seeMore.visible.map((row) => {
                const id = row.dbId || row.id
                const isEditing = editingId === id
                return (
                  <li key={id} className="catalog-manage-modal__item">
                    {isEditing ? (
                      <div className="catalog-manage-modal__edit">
                        <input
                          type="text"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          maxLength={120}
                          disabled={busy}
                          autoFocus
                          aria-label="Edit label"
                        />
                        <button type="button" className="btn btn--sm btn--primary" disabled={busy} onClick={() => saveEdit(row)}>
                          Save
                        </button>
                        <button type="button" className="btn btn--sm btn--ghost" disabled={busy} onClick={cancelEdit}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="catalog-manage-modal__label">{row.label}</span>
                        <div className="catalog-manage-modal__actions">
                          <button type="button" className="icon-btn" title="View" disabled={busy} onClick={() => setViewItem(row)}>
                            <Eye size={15} />
                          </button>
                          <button type="button" className="icon-btn" title="Edit" disabled={busy} onClick={() => startEdit(row)}>
                            <Pencil size={15} />
                          </button>
                          <button type="button" className="icon-btn icon-btn--danger" title="Delete" disabled={busy} onClick={() => handleDelete(row)}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
            {seeMore.needsToggle && (
              <SeeMoreToggle
                expanded={seeMore.expanded}
                onToggle={seeMore.toggle}
                hiddenCount={seeMore.hiddenCount}
                moreLabel="Show More"
                lessLabel="Show Less"
              />
            )}
          </>
        )}

        {viewItem && (
          <div className="catalog-manage-modal__view" role="dialog" aria-label="Item details">
            <div className="catalog-manage-modal__view-header">
              <strong>Details</strong>
              <button type="button" className="icon-btn" aria-label="Close details" onClick={() => setViewItem(null)}>
                <X size={16} />
              </button>
            </div>
            <dl className="catalog-manage-modal__view-dl">
              <div>
                <dt>Label</dt>
                <dd>{viewItem.label}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{viewItem.isActive === false ? 'Inactive' : 'Active'}</dd>
              </div>
              {viewItem.createdAt && (
                <div>
                  <dt>Created</dt>
                  <dd>{viewItem.createdAt}</dd>
                </div>
              )}
              {viewItem.updatedAt && (
                <div>
                  <dt>Updated</dt>
                  <dd>{viewItem.updatedAt}</dd>
                </div>
              )}
            </dl>
            <div className="catalog-manage-modal__view-actions">
              <button type="button" className="btn btn--sm btn--outline" onClick={() => startEdit(viewItem)}>
                <Pencil size={14} /> Edit
              </button>
              <button type="button" className="btn btn--sm btn--outline-danger" onClick={() => handleDelete(viewItem)}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
