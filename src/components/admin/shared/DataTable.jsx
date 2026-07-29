import { useSeeMore } from '../../../hooks/useSeeMore'
import { SeeMoreToggle } from './SeeMoreList'

export default function DataTable({
  columns,
  data,
  onRowClick,
  /** Optional className for a row (string or (row) => string). */
  rowClassName,
  /** When set, only the first N rows show until the user expands. */
  initialVisible,
}) {
  const limit = typeof initialVisible === 'number' && initialVisible > 0 ? initialVisible : null
  const { visible, expanded, toggle, needsToggle, hiddenCount, total } = useSeeMore(
    data,
    limit ?? (data?.length || 0),
  )
  const rows = limit ? visible : data

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
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="data-table__empty">
                No records found
              </td>
            </tr>
          ) : (
            rows.map((row, i) => {
              const extraClass = typeof rowClassName === 'function' ? rowClassName(row) : (rowClassName || '')
              const classes = [
                onRowClick ? 'data-table__row--clickable' : '',
                extraClass,
              ].filter(Boolean).join(' ')
              return (
                <tr
                  key={row.id ?? row.dbId ?? i}
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

      {data.length > 0 && (
        <div className={`data-table__footer${limit && needsToggle ? ' data-table__footer--see-more' : ''}`}>
          {limit && needsToggle && (
            <SeeMoreToggle
              expanded={expanded}
              onToggle={toggle}
              hiddenCount={hiddenCount}
            />
          )}
          <span className="data-table__count">
            {limit && needsToggle && !expanded ? (
              <>
                Showing <strong>{rows.length}</strong> of <strong>{total}</strong>{' '}
                {total === 1 ? 'record' : 'records'}
              </>
            ) : (
              <>
                Showing <strong>{data.length}</strong>{' '}
                {data.length === 1 ? 'record' : 'records'}
              </>
            )}
          </span>
        </div>
      )}
    </div>
  )
}
