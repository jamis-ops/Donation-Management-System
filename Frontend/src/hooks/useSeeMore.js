import { useState } from 'react'

/**
 * Truncate long lists: show the first few items, then expand on demand.
 */
export function useSeeMore(items = [], initialCount = 3) {
  const [expanded, setExpanded] = useState(false)
  const list = Array.isArray(items) ? items : []
  const total = list.length
  const needsToggle = total > initialCount
  const visible = expanded || !needsToggle ? list : list.slice(0, initialCount)
  const hiddenCount = Math.max(0, total - initialCount)

  return {
    visible,
    expanded,
    setExpanded,
    toggle: () => setExpanded((v) => !v),
    needsToggle,
    total,
    hiddenCount,
    initialCount,
  }
}
