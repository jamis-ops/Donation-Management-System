import { useEffect, useState, useMemo, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Database,
  Table2,
  Trash2,
  RefreshCw,
  Search,
  AlertTriangle,
  CheckSquare,
  Square,
  Shield,
  Key,
  Layers,
  HardDrive,
  Filter,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { isSuperAdminRole } from '../../utils/roleRoutes'
import { databaseManagementApi } from '../../api/resources'
import { useLoading } from '../../context/LoadingContext'
import { notify } from '../../utils/confirm'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import ModalHeader from '../components/shared/ModalHeader'
import PageHeader from '../components/shared/PageHeader'

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export default function DatabaseManagementPage() {
  const { user } = useAuth()
  const isSuperAdmin = isSuperAdminRole(user?.role, user)
  const { showLoading, hideLoading } = useLoading()

  // Table list state
  const [tables, setTables] = useState([])
  const [tablesLoading, setTablesLoading] = useState(true)
  const [tableSearch, setTableSearch] = useState('')
  const [selectedTable, setSelectedTable] = useState('')

  // Table data state
  const [tableData, setTableData] = useState(null)
  const [dataLoading, setDataLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortCol, setSortCol] = useState('')
  const [sortOrder, setSortOrder] = useState('DESC')

  // Selection state
  const [selectedIds, setSelectedIds] = useState([])

  // Modal states
  const [showWipeModal, setShowWipeModal] = useState(false)
  const [showClearTableModal, setShowClearTableModal] = useState(false)
  const [showDeleteRowsModal, setShowDeleteRowsModal] = useState(false)
  const [preservedTables, setPreservedTables] = useState(['roles', 'users'])
  const [wipeConfirmText, setWipeConfirmText] = useState('')

  // Security Guard: Super Admin Only
  if (!isSuperAdmin) {
    return <Navigate to="/admin/admins" replace />
  }

  // Debounce record search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(handler)
  }, [search])

  // Fetch Tables
  const loadTables = useCallback(async (autoSelectFirst = false) => {
    setTablesLoading(true)
    try {
      const res = await databaseManagementApi.getTables()
      if (res?.data) {
        setTables(res.data)
        if (autoSelectFirst && res.data.length > 0) {
          setSelectedTable((prev) => prev || res.data[0].name)
        }
      }
    } catch (err) {
      notify.error(err.message || 'Failed to load database tables')
    } finally {
      setTablesLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTables(true)
  }, [loadTables])

  // Fetch active table data
  const loadTableData = useCallback(async () => {
    if (!selectedTable) return
    setDataLoading(true)
    try {
      const res = await databaseManagementApi.getTableData({
        table: selectedTable,
        page,
        limit,
        search: debouncedSearch,
        sort: sortCol,
        order: sortOrder,
      })
      if (res?.data) {
        setTableData(res.data)
        setSelectedIds([])
      }
    } catch (err) {
      notify.error(err.message || `Failed to load records for '${selectedTable}'`)
    } finally {
      setDataLoading(false)
    }
  }, [selectedTable, page, limit, debouncedSearch, sortCol, sortOrder])

  useEffect(() => {
    loadTableData()
  }, [loadTableData])

  // Reset pagination & filters on table change
  const handleSelectTable = (name) => {
    if (name === selectedTable) return
    setSelectedTable(name)
    setPage(1)
    setSearch('')
    setDebouncedSearch('')
    setSortCol('')
    setSortOrder('DESC')
    setSelectedIds([])
  }

  // Filtered tables for left sidebar
  const filteredTables = useMemo(() => {
    if (!tableSearch.trim()) return tables
    const q = tableSearch.toLowerCase()
    return tables.filter((t) => t.name.toLowerCase().includes(q))
  }, [tables, tableSearch])

  // Active primary key
  const primaryKey = tableData?.primaryKey || 'id'

  // Row selection handlers
  const handleToggleSelectAll = () => {
    if (!tableData?.rows?.length) return
    const allRowIds = tableData.rows.map((r) => r[primaryKey]).filter((id) => id != null)
    const isAllSelected = allRowIds.every((id) => selectedIds.includes(id))

    if (isAllSelected) {
      setSelectedIds((prev) => prev.filter((id) => !allRowIds.includes(id)))
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...allRowIds])))
    }
  }

  const handleToggleRow = (id) => {
    if (id == null) return
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  // Sort handler
  const handleSort = (colName) => {
    if (sortCol === colName) {
      setSortOrder((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'))
    } else {
      setSortCol(colName)
      setSortOrder('ASC')
    }
    setPage(1)
  }

  // Action: Delete Selected Rows
  const handleDeleteSelected = async () => {
    if (!selectedIds.length || !selectedTable) return
    showLoading(`Deleting ${selectedIds.length} record(s)…`)
    try {
      const res = await databaseManagementApi.deleteRows(selectedTable, selectedIds, primaryKey)
      notify.success(res.message || 'Records successfully deleted.')
      setShowDeleteRowsModal(false)
      setSelectedIds([])
      await loadTableData()
      await loadTables()
    } catch (err) {
      notify.error(err.message || 'Failed to delete records')
    } finally {
      hideLoading()
    }
  }

  // Action: Truncate / Clear Single Table
  const handleClearTable = async () => {
    if (!selectedTable) return
    showLoading(`Clearing all data from '${selectedTable}'…`)
    try {
      const res = await databaseManagementApi.truncateTable(selectedTable)
      notify.success(res.message || `Table '${selectedTable}' cleared successfully.`)
      setShowClearTableModal(false)
      setSelectedIds([])
      await loadTableData()
      await loadTables()
    } catch (err) {
      notify.error(err.message || `Failed to clear '${selectedTable}'`)
    } finally {
      hideLoading()
    }
  }

  // Action: Delete Everything Except...
  const handleWipeExcept = async () => {
    if (wipeConfirmText.trim().toUpperCase() !== 'DELETE' && wipeConfirmText.trim().toUpperCase() !== 'CONFIRM') {
      notify.error('Please type CONFIRM or DELETE to verify.')
      return
    }

    showLoading('Executing selective database wipe…')
    try {
      const res = await databaseManagementApi.wipeExcept(preservedTables, wipeConfirmText.trim())
      notify.success(res.message || 'Database wipe completed.')
      setShowWipeModal(false)
      setWipeConfirmText('')
      await loadTables()
      await loadTableData()
    } catch (err) {
      notify.error(err.message || 'Failed to execute database wipe')
    } finally {
      hideLoading()
    }
  }

  // Toggle preserved table for wipe modal
  const handleTogglePreserve = (tName) => {
    setPreservedTables((prev) =>
      prev.includes(tName) ? prev.filter((t) => t !== tName) : [...prev, tName]
    )
  }

  const currentTableMeta = tables.find((t) => t.name === selectedTable)

  return (
    <div className="db-management-page">
      <PageHeader
        title="Database Management"
        description="Live schema inspection, table data explorer, and maintenance for Super Administrator."
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => {
                loadTables()
                loadTableData()
              }}
              title="Refresh database state"
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <button
              type="button"
              className="btn btn--danger btn--sm"
              onClick={() => {
                setPreservedTables(['roles', 'users'])
                setWipeConfirmText('')
                setShowWipeModal(true)
              }}
              title="Selective wipe preserving chosen tables"
            >
              <Trash2 size={14} /> Delete Everything Except…
            </button>
          </div>
        }
      />

      <div className="db-manager-layout">
        {/* Left Pane: Database Tables List */}
        <aside className="db-manager-sidebar">
          <div className="db-manager-sidebar__header">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Database size={13} style={{ color: '#AF101A' }} /> Database Tables ({tables.length})
              </span>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                {formatBytes(tables.reduce((sum, t) => sum + (t.sizeBytes || 0), 0))} total
              </span>
            </div>
            <div className="db-search-input-wrap">
              <Search size={14} className="db-search-icon" />
              <input
                type="text"
                placeholder="Search tables…"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="db-search-input"
              />
              {tableSearch && (
                <button type="button" className="db-search-clear" onClick={() => setTableSearch('')}>
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          <div className="db-manager-table-list">
            {tablesLoading ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                Loading tables…
              </div>
            ) : filteredTables.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                No tables matching &ldquo;{tableSearch}&rdquo;
              </div>
            ) : (
              filteredTables.map((t) => {
                const isSelected = t.name === selectedTable
                return (
                  <button
                    key={t.name}
                    type="button"
                    className={`db-table-nav-item ${isSelected ? 'db-table-nav-item--active' : ''}`}
                    onClick={() => handleSelectTable(t.name)}
                  >
                    <div className="db-table-nav-item__main">
                      <Table2 size={16} className="db-table-nav-item__icon" />
                      <span className="db-table-nav-item__name">{t.name}</span>
                    </div>
                    <div className="db-table-nav-item__meta">
                      <span className={`db-row-badge ${t.rows === 0 ? 'db-row-badge--empty' : ''}`}>
                        {t.rows.toLocaleString()}
                      </span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        {/* Right Pane: Dynamic Table Explorer */}
        <main className="db-manager-content">
          {selectedTable ? (
            <div className="db-table-view">
              {/* Table Top Bar */}
              <div className="db-table-header">
                <div className="db-table-header__info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                      {selectedTable}
                    </h2>
                    {currentTableMeta?.isSystem && (
                      <span className="db-badge db-badge--system">
                        <Shield size={11} /> System Table
                      </span>
                    )}
                    <span className="db-badge db-badge--engine">
                      {currentTableMeta?.engine || 'InnoDB'}
                    </span>
                  </div>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    <strong>{tableData?.totalRows?.toLocaleString() ?? currentTableMeta?.rows ?? 0}</strong> total records · {formatBytes(currentTableMeta?.sizeBytes)} · {tableData?.columns?.length || 0} columns
                  </p>
                </div>

                <div className="db-table-header__actions">
                  <button
                    type="button"
                    className="btn btn--outline btn--sm"
                    onClick={() => loadTableData()}
                    disabled={dataLoading}
                    title="Reload records"
                  >
                    <RefreshCw size={13} /> Reload
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    onClick={() => setShowClearTableModal(true)}
                    disabled={(tableData?.totalRows || 0) === 0 || dataLoading}
                    title={`Clear all rows from ${selectedTable}`}
                  >
                    <Trash2 size={13} /> Clear Table
                  </button>
                </div>
              </div>

              {/* Data Filtering & Batch Toolbar */}
              <div className="db-toolbar">
                <div className="db-toolbar__search">
                  <Search size={14} className="db-search-icon" />
                  <input
                    type="text"
                    placeholder={`Search records in ${selectedTable}…`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="db-search-input"
                  />
                  {search && (
                    <button type="button" className="db-search-clear" onClick={() => setSearch('')}>
                      <X size={13} />
                    </button>
                  )}
                </div>

                {selectedIds.length > 0 && (
                  <div className="db-batch-actions">
                    <span className="db-batch-count">
                      {selectedIds.length} selected
                    </span>
                    <button
                      type="button"
                      className="btn btn--danger btn--sm"
                      onClick={() => setShowDeleteRowsModal(true)}
                    >
                      <Trash2 size={13} /> Delete Selected ({selectedIds.length})
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => setSelectedIds([])}
                    >
                      Deselect
                    </button>
                  </div>
                )}
              </div>

              {/* Dynamic Grid */}
              <div className="db-grid-container">
                {dataLoading ? (
                  <LoadingSpinner message={`Loading live records from ${selectedTable}…`} />
                ) : !tableData?.rows || tableData.rows.length === 0 ? (
                  <div className="portal-empty" style={{ padding: '3.5rem 1rem' }}>
                    <Table2 size={36} />
                    <p style={{ margin: '0.5rem 0 0', fontWeight: 600 }}>No records found in table &ldquo;{selectedTable}&rdquo;</p>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {debouncedSearch ? 'Try a different search query' : 'This table is currently empty'}
                    </span>
                  </div>
                ) : (
                  <div className="db-table-scroll-wrap">
                    <table className="db-data-table">
                      <thead>
                        <tr>
                          <th style={{ width: '40px', textAlign: 'center' }}>
                            <button
                              type="button"
                              className="db-checkbox-btn"
                              onClick={handleToggleSelectAll}
                              aria-label="Select all rows on this page"
                            >
                              {tableData.rows.length > 0 && tableData.rows.every((r) => selectedIds.includes(r[primaryKey])) ? (
                                <CheckSquare size={16} style={{ color: '#AF101A' }} />
                              ) : (
                                <Square size={16} />
                              )}
                            </button>
                          </th>
                          {(tableData.columns || []).map((col) => {
                            const isSorted = sortCol === col.name
                            return (
                              <th
                                key={col.name}
                                onClick={() => handleSort(col.name)}
                                className="db-th-sortable"
                                title={`Click to sort by ${col.name}`}
                              >
                                <div className="db-th-content">
                                  <span className="db-th-name">
                                    {col.isPrimary && <Key size={11} style={{ color: '#d97706', marginRight: 3 }} title="Primary Key" />}
                                    {col.name}
                                  </span>
                                  <span className="db-th-type">{col.dataType}</span>
                                  <ArrowUpDown size={12} className={`db-th-sort-icon ${isSorted ? 'db-th-sort-icon--active' : ''}`} />
                                </div>
                              </th>
                            )
                          })}
                          <th style={{ width: '50px', textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableData.rows.map((row, idx) => {
                          const rowId = row[primaryKey]
                          const isSelected = rowId != null && selectedIds.includes(rowId)

                          return (
                            <tr key={rowId != null ? rowId : idx} className={isSelected ? 'db-tr--selected' : ''}>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="db-checkbox-btn"
                                  onClick={() => handleToggleRow(rowId)}
                                  aria-label={`Select row ${rowId}`}
                                >
                                  {isSelected ? (
                                    <CheckSquare size={16} style={{ color: '#AF101A' }} />
                                  ) : (
                                    <Square size={16} />
                                  )}
                                </button>
                              </td>
                              {(tableData.columns || []).map((col) => {
                                const val = row[col.name]
                                let displayVal = 'NULL'
                                let isNull = false

                                if (val === null || val === undefined) {
                                  displayVal = 'NULL'
                                  isNull = true
                                } else if (typeof val === 'object') {
                                  displayVal = JSON.stringify(val)
                                } else {
                                  displayVal = String(val)
                                }

                                return (
                                  <td key={col.name} className={isNull ? 'db-cell--null' : ''} title={displayVal}>
                                    <span className="db-cell-text">{displayVal}</span>
                                  </td>
                                )
                              })}
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="db-row-action-btn"
                                  onClick={() => {
                                    if (rowId != null) {
                                      setSelectedIds([rowId])
                                      setShowDeleteRowsModal(true)
                                    }
                                  }}
                                  title={`Delete row ${rowId}`}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Pagination */}
              {tableData && tableData.totalPages > 1 && (
                <div className="db-pagination-bar">
                  <span className="db-pagination-info">
                    Showing <strong>{((page - 1) * limit) + 1}</strong>–<strong>{Math.min(page * limit, tableData.filteredRows)}</strong> of <strong>{tableData.filteredRows.toLocaleString()}</strong> rows
                  </span>

                  <div className="db-pagination-controls">
                    <select
                      value={limit}
                      onChange={(e) => {
                        setLimit(Number(e.target.value))
                        setPage(1)
                      }}
                      className="db-limit-select"
                    >
                      <option value={10}>10 / page</option>
                      <option value={25}>25 / page</option>
                      <option value={50}>50 / page</option>
                      <option value={100}>100 / page</option>
                    </select>

                    <button
                      type="button"
                      className="btn btn--sm btn--outline"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft size={14} /> Prev
                    </button>
                    <span className="db-page-indicator">
                      Page {page} of {tableData.totalPages}
                    </span>
                    <button
                      type="button"
                      className="btn btn--sm btn--outline"
                      onClick={() => setPage((p) => Math.min(tableData.totalPages, p + 1))}
                      disabled={page >= tableData.totalPages}
                    >
                      Next <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="portal-empty" style={{ padding: '4rem 1rem' }}>
              <Database size={44} />
              <p style={{ marginTop: '0.75rem', fontWeight: 700 }}>Select a table from the sidebar</p>
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Browse live columns, query records, and manage database entities.
              </span>
            </div>
          )}
        </main>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 1: Delete Selected Rows Confirmation                               */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {showDeleteRowsModal && (
        <div className="admin-modal-overlay" onClick={() => setShowDeleteRowsModal(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <ModalHeader title="Confirm Record Deletion" onClose={() => setShowDeleteRowsModal(false)} />
            <div style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem', background: '#fef2f2', border: '1px solid #fecaca', padding: '0.9rem 1rem', borderRadius: '10px', color: '#991b1b' }}>
                <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem' }}>Destructive Action</strong>
                  <span style={{ fontSize: '0.85rem' }}>
                    You are about to permanently delete <strong>{selectedIds.length}</strong> record(s) from table <code>{selectedTable}</code>.
                  </span>
                </div>
              </div>

              <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
                Selected ID(s): <code style={{ wordBreak: 'break-all', fontSize: '0.8rem' }}>{selectedIds.slice(0, 10).join(', ')}{selectedIds.length > 10 ? ` … (+${selectedIds.length - 10} more)` : ''}</code>
              </p>

              <div className="admin-modal__actions admin-modal__actions--split" style={{ marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowDeleteRowsModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={handleDeleteSelected}
                >
                  <Trash2 size={14} /> Permanently Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 2: Clear Entire Table Confirmation                                 */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {showClearTableModal && (
        <div className="admin-modal-overlay" onClick={() => setShowClearTableModal(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <ModalHeader title={`Clear Table: ${selectedTable}`} onClose={() => setShowClearTableModal(false)} />
            <div style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem', background: '#fef2f2', border: '1px solid #fecaca', padding: '0.9rem 1rem', borderRadius: '10px', color: '#991b1b' }}>
                <AlertTriangle size={22} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem' }}>Truncate / Delete All Records</strong>
                  <span style={{ fontSize: '0.85rem' }}>
                    This will delete all <strong>{tableData?.totalRows?.toLocaleString() ?? currentTableMeta?.rows ?? 0}</strong> records from <code>{selectedTable}</code> and reset the primary key auto-increment.
                  </span>
                </div>
              </div>

              {currentTableMeta?.isSystem && (
                <p style={{ fontSize: '0.85rem', color: '#b45309', background: '#fef3c7', padding: '0.75rem', borderRadius: '8px' }}>
                  ⚠️ Warning: <code>{selectedTable}</code> is a critical system table. Clearing it may impact application roles or configuration.
                </p>
              )}

              <div className="admin-modal__actions admin-modal__actions--split" style={{ marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowClearTableModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={handleClearTable}
                >
                  <Trash2 size={14} /> Clear All Records
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 3: "Delete Everything Except..." Selective Wipe Modal              */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {showWipeModal && (
        <div className="admin-modal-overlay" onClick={() => setShowWipeModal(false)}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px' }}>
            <ModalHeader title="Selective Database Wipe (Delete Everything Except…)" onClose={() => setShowWipeModal(false)} />
            <div style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1.25rem', background: '#fef2f2', border: '1px solid #fecaca', padding: '0.9rem 1rem', borderRadius: '10px', color: '#991b1b' }}>
                <AlertTriangle size={24} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem' }}>Selective Database Wipe</strong>
                  <span style={{ fontSize: '0.85rem' }}>
                    Select the tables you wish to <strong>PRESERVE</strong>. All other database tables will be purged.
                  </span>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569' }}>
                    Check Tables to Keep Safe (Preserve):
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn--xs btn--ghost"
                      onClick={() => setPreservedTables(tables.map((t) => t.name))}
                    >
                      Preserve All
                    </button>
                    <button
                      type="button"
                      className="btn btn--xs btn--ghost"
                      onClick={() => setPreservedTables(['roles', 'users'])}
                    >
                      System Default
                    </button>
                    <button
                      type="button"
                      className="btn btn--xs btn--ghost"
                      onClick={() => setPreservedTables([])}
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="db-preserve-grid">
                  {tables.map((t) => {
                    const isPreserved = preservedTables.includes(t.name)
                    return (
                      <label
                        key={t.name}
                        className={`db-preserve-card ${isPreserved ? 'db-preserve-card--kept' : 'db-preserve-card--wiped'}`}
                      >
                        <input
                          type="checkbox"
                          checked={isPreserved}
                          onChange={() => handleTogglePreserve(t.name)}
                          style={{ margin: 0 }}
                        />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <strong style={{ fontSize: '0.85rem', color: isPreserved ? '#065f46' : '#991b1b' }}>
                              {t.name}
                            </strong>
                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                              {t.rows.toLocaleString()} rows
                            </span>
                          </div>
                          <span style={{ fontSize: '0.72rem', color: isPreserved ? '#047857' : '#dc2626', fontWeight: 600 }}>
                            {isPreserved ? '✓ Will be preserved' : '✕ Will be wiped'}
                          </span>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Summary of Deletion */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.85rem 1rem', borderRadius: '10px', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  <span>Tables to preserve:</span>
                  <strong style={{ color: '#059669' }}>{preservedTables.length} table(s)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>Tables to be wiped:</span>
                  <strong style={{ color: '#dc2626' }}>{tables.length - preservedTables.length} table(s)</strong>
                </div>
              </div>

              {/* Verification Text Input */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
                  Type <span style={{ color: '#AF101A', fontFamily: 'monospace', fontWeight: 800 }}>CONFIRM</span> or <span style={{ color: '#AF101A', fontFamily: 'monospace', fontWeight: 800 }}>DELETE</span> to authorize:
                </label>
                <input
                  type="text"
                  placeholder="Type CONFIRM here..."
                  value={wipeConfirmText}
                  onChange={(e) => setWipeConfirmText(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    fontFamily: 'monospace',
                  }}
                />
              </div>

              <div className="admin-modal__actions admin-modal__actions--split" style={{ marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowWipeModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={handleWipeExcept}
                  disabled={
                    wipeConfirmText.trim().toUpperCase() !== 'CONFIRM' &&
                    wipeConfirmText.trim().toUpperCase() !== 'DELETE'
                  }
                >
                  <Trash2 size={14} /> Wipe Unpreserved Tables
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
