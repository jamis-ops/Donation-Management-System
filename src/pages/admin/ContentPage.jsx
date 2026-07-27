import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { contentApi } from '../../api/resources'
import PageHeader from '../../components/admin/shared/PageHeader'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import ModalHeader from '../../components/admin/shared/ModalHeader'
import Req from '../../components/shared/Req'
import { useAuth } from '../../context/AuthContext'
import { useSeeMore } from '../../hooks/useSeeMore'
import { SeeMoreToggle } from '../../components/admin/shared/SeeMoreList'

const TYPES = [
  { key: 'programs', label: 'Programs' },
  { key: 'stories', label: 'Stories' },
  { key: 'partners', label: 'Partners' },
  { key: 'announcements', label: 'Announcements' },
  { key: 'faqs', label: 'FAQs' },
  { key: 'impact', label: 'Impact' },
  { key: 'hero', label: 'Hero' },
]

const emptyForm = {
  title: '',
  summary: '',
  body: '',
  imageUrl: '',
  linkUrl: '',
  status: 'draft',
  sortOrder: 0,
  metaCategory: '',
  metaLocation: '',
  metaDate: '',
  metaSlug: '',
  metaTestimonial: '',
  metaValue: '',
}

function buildMeta(type, form) {
  const meta = {}
  if (form.metaCategory) meta.category = form.metaCategory
  if (form.metaLocation) meta.location = form.metaLocation
  if (form.metaDate) meta.date = form.metaDate
  if (form.metaSlug) meta.slug = form.metaSlug
  if (form.metaTestimonial) meta.testimonial = form.metaTestimonial
  if (form.metaValue) meta.value = form.metaValue
  if (type === 'programs') meta.active = true
  return meta
}

function formFromItem(item) {
  const meta = item.meta || {}
  return {
    title: item.title || '',
    summary: item.summary || '',
    body: item.body || '',
    imageUrl: item.imageUrl || '',
    linkUrl: item.linkUrl || '',
    status: item.status || 'draft',
    sortOrder: item.sortOrder ?? 0,
    metaCategory: meta.category || '',
    metaLocation: meta.location || '',
    metaDate: meta.date || '',
    metaSlug: meta.slug || '',
    metaTestimonial: meta.testimonial || '',
    metaValue: meta.value || '',
  }
}

export default function ContentPage() {
  const { user } = useAuth()
  const canEdit = user?.role === 'Admin'

  const [type, setType] = useState('programs')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (type) params.set('type', type)
      if (statusFilter) params.set('status', statusFilter)
      if (search.trim()) params.set('search', search.trim())
      const qs = params.toString() ? `?${params}` : ''
      const res = await contentApi.list(qs)
      setItems(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      setError(err.message || 'Failed to load content')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, statusFilter])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (i) =>
        i.title?.toLowerCase().includes(q) ||
        i.summary?.toLowerCase().includes(q) ||
        i.body?.toLowerCase().includes(q)
    )
  }, [items, search])

  const contentSeeMore = useSeeMore(filtered, 5)

  const openCreate = () => {
    setEditRow(null)
    setForm({ ...emptyForm, status: 'draft', sortOrder: items.length })
    setShowForm(true)
  }

  const openEdit = (row) => {
    setEditRow(row)
    setForm(formFromItem(row))
    setShowForm(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!canEdit) return
    setSaving(true)
    try {
      const payload = {
        type,
        title: form.title,
        summary: form.summary,
        body: form.body,
        imageUrl: form.imageUrl,
        linkUrl: form.linkUrl,
        status: form.status,
        sortOrder: Number(form.sortOrder) || 0,
        meta: buildMeta(type, form),
      }
      if (editRow) {
        await contentApi.update(editRow.id, payload)
      } else {
        await contentApi.create(payload)
      }
      setShowForm(false)
      setEditRow(null)
      setForm(emptyForm)
      await load()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const runAction = async (row, action, extra = {}) => {
    if (!canEdit) return
    try {
      await contentApi.action(row.id, action, extra)
      await load()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleDelete = async (row) => {
    if (!canEdit) return
    if (!window.confirm(`Delete “${row.title}”? This cannot be undone.`)) return
    try {
      await contentApi.remove(row.id)
      await load()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <>
      <PageHeader
        title="Website Content"
        description="Manage public website content — programs, stories, partners, announcements, FAQs, and more."
        actions={
          canEdit ? (
            <button type="button" className="btn btn--primary" onClick={openCreate}>
              <Plus size={15} /> Add Item
            </button>
          ) : null
        }
      />

      <div className="cms-type-tabs" role="tablist" aria-label="Content types">
        {TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={type === t.key}
            className={`admin-tab${type === t.key ? ' admin-tab--active' : ''}`}
            onClick={() => setType(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="cms-toolbar">
        <input
          type="search"
          className="cms-search"
          placeholder="Search title or body..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void load()
          }}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <button type="button" className="btn btn--outline btn--sm" onClick={() => void load()}>
          Refresh
        </button>
        <Link to="/" className="btn btn--ghost btn--sm" target="_blank" rel="noreferrer">
          Preview site ↗
        </Link>
      </div>

      <ApiState loading={loading} error={error} onRetry={load}>
        {filtered.length === 0 ? (
          <div className="cms-empty">
            <p>No {TYPES.find((t) => t.key === type)?.label || 'items'} found.</p>
            {canEdit && (
              <button type="button" className="btn btn--primary" onClick={openCreate}>
                + Add first item
              </button>
            )}
          </div>
        ) : (
          <div className="see-more-wrap">
          <div className="cms-table-wrap">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Image</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contentSeeMore.visible.map((row) => {
                  const idx = filtered.indexOf(row)
                  return (
                  <tr key={row.id}>
                    <td>
                      <div className="cms-order-btns">
                        <button
                          type="button"
                          className="btn btn--sm btn--ghost"
                          disabled={!canEdit || idx === 0}
                          title="Move up"
                          onClick={() => runAction(row, 'reorder', { direction: 'up' })}
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn--sm btn--ghost"
                          disabled={!canEdit || idx === filtered.length - 1}
                          title="Move down"
                          onClick={() => runAction(row, 'reorder', { direction: 'down' })}
                        >
                          <ArrowDown size={14} />
                        </button>
                        <span className="cms-order-num">{row.sortOrder}</span>
                      </div>
                    </td>
                    <td>
                      <strong>{row.title}</strong>
                      {row.summary && <p className="cms-row-summary">{row.summary}</p>}
                    </td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td>
                      {row.imageUrl ? (
                        <img src={row.imageUrl} alt="" className="cms-thumb" />
                      ) : (
                        <span className="cms-muted">—</span>
                      )}
                    </td>
                    <td className="cms-muted">
                      {row.updatedAt ? String(row.updatedAt).slice(0, 10) : '—'}
                    </td>
                    <td>
                      <div className="cms-row-actions">
                        {canEdit && (
                          <>
                            <button type="button" className="btn btn--sm btn--outline" onClick={() => openEdit(row)} title="Edit">
                              <Pencil size={14} />
                            </button>
                            {row.status !== 'published' && (
                              <button type="button" className="btn btn--sm btn--primary" onClick={() => runAction(row, 'publish')} title="Publish">
                                <Eye size={14} /> Publish
                              </button>
                            )}
                            {row.status === 'published' && (
                              <button type="button" className="btn btn--sm btn--outline" onClick={() => runAction(row, 'unpublish')} title="Unpublish">
                                <EyeOff size={14} /> Unpublish
                              </button>
                            )}
                            {row.status !== 'archived' ? (
                              <button type="button" className="btn btn--sm btn--ghost" onClick={() => runAction(row, 'archive')} title="Archive">
                                <Archive size={14} />
                              </button>
                            ) : (
                              <button type="button" className="btn btn--sm btn--ghost" onClick={() => runAction(row, 'restore')} title="Restore">
                                <RotateCcw size={14} />
                              </button>
                            )}
                            <button type="button" className="btn btn--sm btn--ghost" onClick={() => handleDelete(row)} title="Delete">
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {contentSeeMore.needsToggle && (
            <SeeMoreToggle
              expanded={contentSeeMore.expanded}
              onToggle={contentSeeMore.toggle}
              hiddenCount={contentSeeMore.hiddenCount}
            />
          )}
          </div>
        )}
      </ApiState>

      {showForm && (
        <div className="admin-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title={editRow ? `Edit ${TYPES.find((t) => t.key === type)?.label || 'Item'}` : `Add ${TYPES.find((t) => t.key === type)?.label || 'Item'}`}
              onClose={() => setShowForm(false)}
            />
            <form onSubmit={handleSave} className="cms-form">
              <label>
                <Req required>Title</Req>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Headline or name"
                />
              </label>

              <label>
                Summary / Excerpt
                <textarea
                  rows={2}
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                  placeholder="Short description shown in lists"
                />
              </label>

              <label>
                Body
                <textarea
                  rows={5}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder="Full content / answer"
                />
              </label>

              <div className="form-row">
                <label>
                  Image URL
                  <input
                    value={form.imageUrl}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                    placeholder="/media/programs/… or /media/partners/…"
                  />
                </label>
                <label>
                  Link URL
                  <input
                    value={form.linkUrl}
                    onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                    placeholder="Optional external or internal link"
                  />
                </label>
              </div>

              {form.imageUrl && (
                <div className="cms-image-preview">
                  <img src={form.imageUrl} alt="Preview" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                </div>
              )}

              <div className="form-row">
                {(type === 'announcements' || type === 'stories' || type === 'faqs') && (
                  <label>
                    Category
                    <input
                      value={form.metaCategory}
                      onChange={(e) => setForm({ ...form, metaCategory: e.target.value })}
                      placeholder="e.g. Education"
                    />
                  </label>
                )}
                {type === 'partners' && (
                  <label>
                    Location
                    <input
                      value={form.metaLocation}
                      onChange={(e) => setForm({ ...form, metaLocation: e.target.value })}
                      placeholder="e.g. Cebu"
                    />
                  </label>
                )}
                {(type === 'announcements' || type === 'stories') && (
                  <label>
                    Date
                    <input
                      type="date"
                      value={form.metaDate}
                      onChange={(e) => setForm({ ...form, metaDate: e.target.value })}
                    />
                  </label>
                )}
                {type === 'programs' && (
                  <label>
                    Program slug
                    <input
                      value={form.metaSlug}
                      onChange={(e) => setForm({ ...form, metaSlug: e.target.value })}
                      placeholder="e.g. community-center"
                    />
                  </label>
                )}
                {type === 'impact' && (
                  <label>
                    Value
                    <input
                      value={form.metaValue || form.summary}
                      onChange={(e) => setForm({ ...form, metaValue: e.target.value, summary: e.target.value })}
                      placeholder="e.g. 45,000+"
                    />
                  </label>
                )}
              </div>

              {type === 'stories' && (
                <label>
                  Testimonial
                  <textarea
                    rows={2}
                    value={form.metaTestimonial}
                    onChange={(e) => setForm({ ...form, metaTestimonial: e.target.value })}
                    placeholder="Quoted testimonial"
                  />
                </label>
              )}

              <div className="form-row">
                <label>
                  Status
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
                <label>
                  Sort order
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                  />
                </label>
              </div>

              <div className="admin-modal__actions">
                <button type="submit" className="btn btn--primary" disabled={saving || !canEdit}>
                  {saving ? 'Saving…' : editRow ? 'Save changes' : 'Create item'}
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
