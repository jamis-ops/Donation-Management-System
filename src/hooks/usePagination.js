import { useEffect, useMemo, useState } from 'react'

export const DEFAULT_PAGE_SIZE = 10

/**
 * Client-side pagination for tables and lists.
 * Resets to page 1 when resetKey changes (e.g. search/filter).
 */
export function usePagination(items = [], pageSize = DEFAULT_PAGE_SIZE, resetKey = '') {
  const list = Array.isArray(items) ? items : []
  const size = pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE
  const [page, setPage] = useState(1)

  const total = list.length
  const totalPages = Math.max(1, Math.ceil(total / size) || 1)

  useEffect(() => {
    setPage(1)
  }, [resetKey, size])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const startIndex = total === 0 ? 0 : (page - 1) * size
  const endIndex = Math.min(startIndex + size, total)
  const pageItems = useMemo(
    () => list.slice(startIndex, endIndex),
    [list, startIndex, endIndex],
  )

  return {
    page,
    setPage,
    pageSize: size,
    pageItems,
    total,
    totalPages,
    startIndex,
    endIndex,
    hasPrev: page > 1,
    hasNext: page < totalPages,
    prev: () => setPage((p) => Math.max(1, p - 1)),
    next: () => setPage((p) => Math.min(totalPages, p + 1)),
    goTo: (n) => setPage(Math.min(totalPages, Math.max(1, Number(n) || 1))),
  }
}
