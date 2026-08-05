import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Shared pager control for admin tables and portal lists.
 */
export default function Pagination({
  page = 1,
  totalPages = 1,
  total = 0,
  startIndex = 0,
  endIndex = 0,
  onPageChange,
  className = '',
  noun = 'records',
}) {
  if (total <= 0) return null

  const canPrev = page > 1
  const canNext = page < totalPages
  const showControls = totalPages > 1

  // Compact page number window around current page
  const windowSize = 5
  let from = Math.max(1, page - Math.floor(windowSize / 2))
  let to = Math.min(totalPages, from + windowSize - 1)
  from = Math.max(1, to - windowSize + 1)
  const pages = []
  for (let i = from; i <= to; i += 1) pages.push(i)

  return (
    <div className={`pagination${className ? ` ${className}` : ''}`} role="navigation" aria-label="Pagination">
      <span className="pagination__summary">
        Showing <strong>{startIndex + 1}</strong>–<strong>{endIndex}</strong> of{' '}
        <strong>{total}</strong> {total === 1 ? noun.replace(/s$/, '') : noun}
      </span>

      {showControls ? (
        <div className="pagination__controls">
          <button
            type="button"
            className="pagination__btn"
            disabled={!canPrev}
            onClick={() => onPageChange?.(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
            <span>Prev</span>
          </button>

          <div className="pagination__pages">
            {from > 1 && (
              <>
                <button
                  type="button"
                  className={`pagination__page${page === 1 ? ' pagination__page--active' : ''}`}
                  onClick={() => onPageChange?.(1)}
                >
                  1
                </button>
                {from > 2 ? <span className="pagination__ellipsis">…</span> : null}
              </>
            )}
            {pages.map((n) => (
              <button
                key={n}
                type="button"
                className={`pagination__page${n === page ? ' pagination__page--active' : ''}`}
                onClick={() => onPageChange?.(n)}
                aria-current={n === page ? 'page' : undefined}
              >
                {n}
              </button>
            ))}
            {to < totalPages && (
              <>
                {to < totalPages - 1 ? <span className="pagination__ellipsis">…</span> : null}
                <button
                  type="button"
                  className={`pagination__page${page === totalPages ? ' pagination__page--active' : ''}`}
                  onClick={() => onPageChange?.(totalPages)}
                >
                  {totalPages}
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            className="pagination__btn"
            disabled={!canNext}
            onClick={() => onPageChange?.(page + 1)}
            aria-label="Next page"
          >
            <span>Next</span>
            <ChevronRight size={16} />
          </button>
        </div>
      ) : null}
    </div>
  )
}
