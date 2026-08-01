import { useEffect, useState } from 'react'
import { catalogItemsApi } from '../api/resources'

/**
 * Load active labels for a Settings-managed catalog.
 * Falls back to static defaults when the API is unavailable.
 */
export function useCatalogOptions(catalog, fallback = []) {
  const [options, setOptions] = useState(() => (Array.isArray(fallback) ? fallback : []))
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    catalogItemsApi.list(catalog, false)
      .then((res) => {
        if (!active) return
        const list = (res?.data || []).map((n) => n.label).filter(Boolean)
        if (list.length > 0) setOptions(list)
        else if (Array.isArray(fallback) && fallback.length > 0) setOptions(fallback)
      })
      .catch(() => {
        if (active && Array.isArray(fallback) && fallback.length > 0) {
          setOptions(fallback)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [catalog, version])

  const applyList = (list) => {
    const labels = (Array.isArray(list) ? list : [])
      .filter((item) => item && item.isActive !== false)
      .map((item) => (typeof item === 'string' ? item : item.label))
      .filter(Boolean)
    if (labels.length > 0) {
      setOptions(labels)
      return
    }
    setVersion((v) => v + 1)
  }

  return {
    options,
    loading,
    reload: () => setVersion((v) => v + 1),
    applyList,
  }
}
