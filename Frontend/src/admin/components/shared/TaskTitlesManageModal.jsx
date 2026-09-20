import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, ListTodo, Pencil, Plus, Search, Trash2, XCircle } from 'lucide-react'
import { taskTitlesApi } from '../../../api/resources'
import ModalHeader from './ModalHeader'
import { usePagination, DEFAULT_PAGE_SIZE } from '../../../hooks/usePagination'
import Pagination from './Pagination'
import { notify, confirmAction, showSuccessModal } from '../../../utils/confirm'
import { notifyTaskTitlesChanged } from '../../../hooks/useTaskTitles'
import { useCatalogOptions } from '../../../hooks/useCatalogOptions'
import { VOLUNTEER_PROGRAMS } from '../../../constants/options'
import { useLoading } from '../../../context/LoadingContext'
import Req from '../../../components/shared/Req'

const emptyForm = {
  title: '',
  program: 'All Programs',
  description: '',
  isActive: true,
}

export default function TaskTitlesManageModal({ open, onClose }) {
  const { showLoading, hideLoading } = useLoading()
  const { options: programList } = useCatalogOptions('volunteer_programs', VOLUNTEER_PROGRAMS)
  const availablePrograms = useMemo(() => {
    const list = Array.isArray(programList) ? [...programList] : []
    if (!list.includes('All Programs')) list.unshift('All Programs')
    return list
  }, [programList])

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  // Filters
  const [filterProgram, setFilterProgram] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')

  // Add / Edit form mode
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState(emptyForm)

  const load = useCallback(async () => {
    try {
      const res = await taskTitlesApi.list()
      const data = Array.isArray(res?.data) ? res.data : []
      setItems(data)
      return data
    } catch (err) {
      notify.error(err.message || 'Could not load task titles.')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    let active = true
    taskTitlesApi.list()
      .then((res) => {
        if (!active) return
        setItems(Array.isArray(res?.data) ? res.data : [])
      })
      .catch(() => {
        if (active) setItems([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [open])

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Program filter
      if (filterProgram !== 'all') {
        const p = (item.program || '').trim().toLowerCase()
        const target = filterProgram.trim().toLowerCase()
        if (p !== target && p !== 'all programs') return false
      }
      // Status filter
      if (filterStatus === 'active' && !item.isActive) return false
      if (filterStatus === 'inactive' && item.isActive) return false

      // Search
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const inTitle = (item.title || '').toLowerCase().includes(q)
        const inProg = (item.program || '').toLowerCase().includes(q)
        const inDesc = (item.description || '').toLowerCase().includes(q)
        if (!inTitle && !inProg && !inDesc) return false
      }

      return true
    })
  }, [items, filterProgram, filterStatus, search])

  const paging = usePagination(filteredItems, DEFAULT_PAGE_SIZE, `${filteredItems.length}:${filterProgram}:${filterStatus}:${search}`)

  const handleClose = () => {
    setShowFormModal(false)
    setEditingItem(null)
    setFormData(emptyForm)
    onClose()
  }

  if (!open || typeof document === 'undefined') return null

  const handleOpenAdd = () => {
    setEditingItem(null)
    setFormData({
      ...emptyForm,
      program: filterProgram !== 'all' ? filterProgram : 'All Programs',
    })
    setShowFormModal(true)
  }

  const handleOpenEdit = (item) => {
    setEditingItem(item)
    setFormData({
      title: item.title || '',
      program: item.program || 'All Programs',
      description: item.description || '',
      isActive: item.isActive !== false,
    })
    setShowFormModal(true)
  }

  const handleSaveForm = async (e) => {
    e.preventDefault()
    const trimmedTitle = formData.title.trim()
    if (!trimmedTitle) {
      notify.warning('Task title is required.')
      return
    }

    setBusy(true)
    showLoading('Saving…')
    try {
      if (editingItem) {
        await taskTitlesApi.update(editingItem.dbId || editingItem.id, {
          title: trimmedTitle,
          program: formData.program || 'All Programs',
          description: formData.description.trim(),
          isActive: formData.isActive,
        })
        notify.success(`Task title "${trimmedTitle}" updated successfully.`)
        showSuccessModal('Task title successfully updated.')
      } else {
        await taskTitlesApi.create({
          title: trimmedTitle,
          program: formData.program || 'All Programs',
          description: formData.description.trim(),
          isActive: formData.isActive,
        })
        notify.success(`Task title "${trimmedTitle}" created successfully.`)
        showSuccessModal('Task title successfully created.')
      }
      setShowFormModal(false)
      setEditingItem(null)
      setFormData(emptyForm)
      notifyTaskTitlesChanged()
      await load()
    } catch (err) {
      notify.error(err.message || 'Failed to save task title.')
    } finally {
      hideLoading()
      setBusy(false)
    }
  }

  const handleToggleStatus = async (item) => {
    const nextStatus = !item.isActive
    setBusy(true)
    showLoading('Updating…')
    try {
      await taskTitlesApi.toggleActive(item.dbId || item.id, nextStatus)
      notify.success(`Task title "${item.title}" is now ${nextStatus ? 'Active' : 'Inactive'}.`)
      notifyTaskTitlesChanged()
      await load()
    } catch (err) {
      notify.error(err.message || 'Could not change status.')
    } finally {
      hideLoading()
      setBusy(false)
    }
  }

  const handleDelete = async (item) => {
    const ok = await confirmAction({
      title: 'Delete Task Title',
      message: `Are you sure you want to delete "${item.title}"? Existing assigned tasks will keep their recorded title, but it will no longer appear in task dropdowns.`,
      confirmText: 'Delete Task Title',
      type: 'danger',
    })
    if (!ok) return

    setBusy(true)
    showLoading('Deleting…')
    try {
      await taskTitlesApi.remove(item.dbId || item.id)
      notify.success(`Task title "${item.title}" deleted.`)
      showSuccessModal('Task title successfully deleted.')
      notifyTaskTitlesChanged()
      await load()
    } catch (err) {
      notify.error(err.message || 'Could not delete task title.')
    } finally {
      hideLoading()
      setBusy(false)
    }
  }

  return createPortal(
    <div className="admin-modal-overlay catalog-manage-overlay" onClick={handleClose}>
      <div
        className="admin-modal admin-modal--wide catalog-manage-modal task-titles-manage-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Task Title CMS"
        style={{ maxWidth: '940px' }}
      >
        <ModalHeader title="Task Title Management" onClose={handleClose} />
        <p className="catalog-manage-modal__desc">
          Manage standardized task titles and connect them to specific programs for Staff, Volunteers, and Interns.
        </p>

        {/* Action / Filter Bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '180px' }}>
            <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search task titles…"
              style={{ width: '100%', paddingLeft: '2.25rem', height: '36px', fontSize: '0.85rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              value={filterProgram}
              onChange={(e) => setFilterProgram(e.target.value)}
              style={{ height: '36px', fontSize: '0.82rem', minWidth: '180px' }}
            >
              <option value="all">All Programs & General</option>
              {availablePrograms.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ height: '36px', fontSize: '0.82rem', width: '120px' }}
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>

            <button
              type="button"
              className="btn btn--sm btn--primary"
              onClick={handleOpenAdd}
              disabled={busy}
              style={{ height: '36px', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Plus size={15} /> Add Task Title
            </button>
          </div>
        </div>

        {/* Task Titles Table / List */}
        {loading ? (
          <p className="catalog-manage-modal__empty">Loading task titles…</p>
        ) : filteredItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#64748b' }}>
            <ListTodo size={36} style={{ margin: '0 auto 0.75rem', color: '#94a3b8' }} />
            <p style={{ margin: 0, fontWeight: 500 }}>No task titles found matching your filters.</p>
            <button
              type="button"
              className="btn btn--sm btn--outline"
              onClick={handleOpenAdd}
              style={{ marginTop: '0.75rem' }}
            >
              + Add a Task Title
            </button>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--table-header-bg, #f8fafc)', borderBottom: '1px solid var(--border-color, #e2e8f0)', textAlign: 'left' }}>
                    <th style={{ padding: '0.65rem 0.85rem', fontWeight: 600 }}>Task Title</th>
                    <th style={{ padding: '0.65rem 0.85rem', fontWeight: 600, width: '220px' }}>Assigned Program</th>
                    <th style={{ padding: '0.65rem 0.85rem', fontWeight: 600, width: '110px' }}>Status</th>
                    <th style={{ padding: '0.65rem 0.85rem', fontWeight: 600, width: '120px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paging.pageItems.map((row) => {
                    const rowId = row.dbId || row.id
                    const isAll = row.program === 'All Programs' || !row.program
                    return (
                      <tr
                        key={rowId}
                        style={{
                          borderBottom: '1px solid var(--border-color, #f1f5f9)',
                          opacity: row.isActive ? 1 : 0.65,
                          transition: 'opacity 0.2s',
                        }}
                      >
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <strong style={{ display: 'block', color: 'var(--text-primary, #0f172a)' }}>
                            {row.title}
                          </strong>
                          {row.description && (
                            <span style={{ display: 'block', fontSize: '0.76rem', color: '#64748b', marginTop: '0.15rem' }}>
                              {row.description}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              background: isAll ? '#f1f5f9' : '#e0f2fe',
                              color: isAll ? '#475569' : '#0369a1',
                              maxWidth: '210px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={row.program}
                          >
                            {row.program}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(row)}
                            disabled={busy}
                            title={row.isActive ? 'Click to deactivate' : 'Click to activate'}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.2rem 0.45rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: row.isActive ? '#16a34a' : '#94a3b8',
                              backgroundColor: row.isActive ? '#dcfce7' : '#f1f5f9',
                            }}
                          >
                            {row.isActive ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                            {row.isActive ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                            <button
                              type="button"
                              className="icon-btn"
                              title="Edit Task Title"
                              disabled={busy}
                              onClick={() => handleOpenEdit(row)}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn icon-btn--danger"
                              title="Delete Task Title"
                              disabled={busy}
                              onClick={() => handleDelete(row)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              page={paging.page}
              totalPages={paging.totalPages}
              totalItems={filteredItems.length}
              pageSize={DEFAULT_PAGE_SIZE}
              onPageChange={paging.setPage}
            />
          </>
        )}

        {/* Add / Edit Modal */}
        {showFormModal && (
          <div
            className="admin-modal-overlay"
            style={{ zIndex: 100000 }}
            onClick={() => setShowFormModal(false)}
          >
            <div
              className="admin-modal"
              style={{ maxWidth: '520px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <ModalHeader
                title={editingItem ? 'Edit Task Title' : 'Add Task Title'}
                onClose={() => setShowFormModal(false)}
              />
              <form onSubmit={handleSaveForm} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                <label>
                  <Req required>Task Title</Req>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Pack food relief kits, Assist medical triage"
                    maxLength={200}
                    autoFocus
                  />
                </label>

                <label>
                  <Req required>Assign to Program</Req>
                  <select
                    required
                    value={formData.program}
                    onChange={(e) => setFormData({ ...formData, program: e.target.value })}
                  >
                    {availablePrograms.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
                    Select a specific foundation program, or “All Programs” to make this task title available across any program.
                  </span>
                </label>

                <label>
                  Description / Notes (Optional)
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of task expectations, duties, or requirements..."
                    style={{ resize: 'vertical' }}
                  />
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <div>
                    <strong style={{ fontSize: '0.85rem' }}>Active Status</strong>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>
                      Active task titles appear in Staff, Volunteer, and Intern task assignment dropdowns.
                    </span>
                  </div>
                </label>

                <div className="admin-modal__actions" style={{ marginTop: '0.75rem' }}>
                  <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setShowFormModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn--primary" disabled={busy}>
                    {editingItem ? 'Save Changes' : 'Create Task Title'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
