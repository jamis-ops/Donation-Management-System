import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { scrollToTargetWhenReady } from '../utils/scrollToTarget'

/**
 * When the URL hash changes (or on mount), scroll to that section id.
 * Example: /beneficiary/proofs#proof-submit-form
 */
export function useHashScroll({ enabled = true, offset = 88, deps = [] } = {}) {
  const location = useLocation()

  useEffect(() => {
    if (!enabled) return undefined
    const hash = location.hash?.replace(/^#/, '')
    if (!hash) return undefined
    // Fire-and-forget so clearing unrelated state does not cancel the scroll mid-flight.
    scrollToTargetWhenReady(hash, { offset })
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, location.hash, location.pathname, offset, ...deps])
}

/**
 * Scroll/focus when a query param (or other condition) is present and content is ready.
 * Once started for a target id, clearing the query will not cancel the in-flight scroll.
 *
 * @param {boolean} ready - e.g. !loading && Array.isArray(data)
 * @param {string|null} targetId - element id to scroll to
 */
export function useQueryFocus(ready, targetId, { offset = 88 } = {}) {
  const location = useLocation()
  const lastStartedRef = useRef('')

  // Allow the same section to be focused again on a new navigation.
  useEffect(() => {
    lastStartedRef.current = ''
  }, [location.key])

  useEffect(() => {
    if (!targetId) {
      lastStartedRef.current = ''
      return undefined
    }
    if (!ready) return undefined
    const id = String(targetId).replace(/^#/, '')
    if (!id || lastStartedRef.current === id) return undefined
    lastStartedRef.current = id
    scrollToTargetWhenReady(id, { offset })
    return undefined
  }, [ready, targetId, offset, location.key])
}
