import { useEffect, useState } from 'react'
import { catalogItemsApi } from '../api/resources'
import { CATALOG_CHANGED_EVENT } from '../utils/catalogSync'

/**
 * Load active labels for a Settings-managed catalog.
 * Auto-refreshes when any catalog modal saves changes.
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

  useEffect(() => {
    const onChanged = (event) => {
      if (event?.detail?.catalog !== catalog) return
      const incoming = event.detail?.list
      if (Array.isArray(incoming) && incoming.length > 0) {
        const labels = incoming
          .filter((item) => item && item.isActive !== false)
          .map((item) => (typeof item === 'string' ? item : item.label))
          .filter(Boolean)
        if (labels.length > 0) {
          setOptions(labels)
          return
        }
      }
      setVersion((v) => v + 1)
    }
    window.addEventListener(CATALOG_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(CATALOG_CHANGED_EVENT, onChanged)
  }, [catalog])

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
