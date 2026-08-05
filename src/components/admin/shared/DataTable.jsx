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

  return (
    <div className="data-table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="data-table__empty">
                No records found
              </td>
            </tr>
          ) : (
            pageItems.map((row, i) => {
              const extraClass = typeof rowClassName === 'function' ? rowClassName(row) : (rowClassName || '')
              const classes = [
                onRowClick ? 'data-table__row--clickable' : '',
                extraClass,
              ].filter(Boolean).join(' ')
              return (
                <tr
                  key={row.id ?? row.dbId ?? `${startIndex + i}`}
                  onClick={() => onRowClick?.(row)}
                  className={classes || undefined}
                >
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
