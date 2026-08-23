import { usePagination, DEFAULT_PAGE_SIZE } from '../../../hooks/usePagination'
import Pagination from './Pagination'

export default function DataTable({
  columns,
  data,
  onRowClick,
  /** Optional className for a row (string or (row) => string). */
  rowClassName,
  /** Rows per page (default 10). */
  pageSize = DEFAULT_PAGE_SIZE,
  /** @deprecated Use pageSize. Kept so existing call sites keep working. */
  initialVisible,
  /** Change this when search/filters change so the pager returns to page 1. */
  resetKey = '',
  noun = 'records',
  /** Multi-select support */
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  onBulkDelete,
  deleting = false,
  bulkDeleteLabel = 'Delete Selected',
  idKey = null,
}) {
  const list = Array.isArray(data) ? data : []
  const size = (
    typeof pageSize === 'number' && pageSize > 0
      ? pageSize
      : (typeof initialVisible === 'number' && initialVisible > 0 ? initialVisible : DEFAULT_PAGE_SIZE)
  )

  const {
    page,
    setPage,
    pageItems,
    total,
    totalPages,
    startIndex,
    endIndex,
  } = usePagination(list, size, String(resetKey))

  const getRowId = (row) => {
    if (idKey && row[idKey] !== undefined) return row[idKey]
    return row.dbId ?? row.id
  }

  // Calculate if all items currently displayed on this page are selected
  const currentPageIds = pageItems.map(getRowId).filter((id) => id !== undefined && id !== null)
  const isAllPageSelected = currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.includes(id))
  const isSomePageSelected = currentPageIds.some((id) => selectedIds.includes(id))

  const handleToggleSelectAll = (e) => {
    e.stopPropagation()
    if (!onSelectionChange) return
    if (isAllPageSelected) {
      // Unselect all items on the current page
      onSelectionChange(selectedIds.filter((id) => !currentPageIds.includes(id)))
    } else {
      // Add all unselected items on the current page
      const combined = Array.from(new Set([...selectedIds, ...currentPageIds]))
      onSelectionChange(combined)
    }
  }

  const handleToggleRow = (e, row) => {
    e.stopPropagation()
    if (!onSelectionChange) return
    const id = getRowId(row)
    if (id === undefined || id === null) return
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((item) => item !== id))
    } else {
      onSelectionChange([...selectedIds, id])
    }
  }

  const colSpanCount = columns.length + (selectable ? 1 : 0)

  return (
    <div className="data-table-wrapper">
      {/* Minimal clean Bulk Action Bar when records are selected */}
      {selectable && selectedIds.length > 0 && (
        <div className="table-bulk-actions-bar">
          <div className="table-bulk-actions-bar__info">
            <span className="table-bulk-actions-bar__count">
              <strong>{selectedIds.length}</strong> {selectedIds.length === 1 ? 'record' : 'records'} selected
            </span>
            <button
              type="button"
              className="table-bulk-actions-bar__btn-clear"
              onClick={() => onSelectionChange?.([])}
            >
              Clear selection
            </button>
          </div>

          {onBulkDelete && (
            <button
              type="button"
              className="btn btn--sm btn--danger table-bulk-actions-bar__btn-delete"
              disabled={deleting}
              onClick={onBulkDelete}
            >
              {deleting ? 'Deleting…' : `${bulkDeleteLabel} (${selectedIds.length})`}
            </button>
          )}
        </div>
      )}

      <table className="data-table">
        <thead>
          <tr>
            {selectable && (
              <th className="data-table__checkbox-col" style={{ width: '42px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  className="data-table__checkbox"
                  checked={isAllPageSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !isAllPageSelected && isSomePageSelected
                  }}
                  onChange={handleToggleSelectAll}
                  aria-label="Select all on this page"
                />
              </th>
            )}
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.length === 0 ? (
            <tr>
              <td colSpan={colSpanCount} className="data-table__empty">
                No records found
              </td>
            </tr>
          ) : (
            pageItems.map((row, i) => {
              const id = getRowId(row)
              const isSelected = id !== undefined && id !== null && selectedIds.includes(id)
              const extraClass = typeof rowClassName === 'function' ? rowClassName(row) : (rowClassName || '')
              const classes = [
                onRowClick ? 'data-table__row--clickable' : '',
                isSelected ? 'data-table__row--selected' : '',
                extraClass,
              ].filter(Boolean).join(' ')

              return (
                <tr
                  key={row.id ?? row.dbId ?? `${startIndex + i}`}
                  onClick={() => onRowClick?.(row)}
                  className={classes || undefined}
                >
                  {selectable && (
                    <td
                      className="data-table__checkbox-col"
                      style={{ width: '42px', textAlign: 'center' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className="data-table__checkbox"
                        checked={isSelected}
                        onChange={(e) => handleToggleRow(e, row)}
                        aria-label={`Select row ${row.id ?? i + 1}`}
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key}>
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              )
            })
          )}
        </tbody>
      </table>

      {list.length > 0 && (
        <div className="data-table__footer">
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            startIndex={startIndex}
            endIndex={endIndex}
            onPageChange={setPage}
            noun={noun}
          />
        </div>
      )}
    </div>
  )
}
