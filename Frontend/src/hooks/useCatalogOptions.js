import { useEffect, useState } from 'react'
import { catalogItemsApi } from '../api/resources'
import { CATALOG_CHANGED_EVENT } from '../utils/catalogSync'
import { sortLabelsAz } from '../utils/sortLabels'
import { cacheManager, CACHE_CONFIG } from '../utils/cacheManager'

/**
 * Load active labels for a Settings-managed catalog (always A–Z).
 * Caches in memory with SWR and auto-refreshes when any catalog modal saves changes.
 */
export function useCatalogOptions(catalog, fallback = []) {
  const cacheKey = cacheManager.makeKey(`catalog_options::${catalog}`, true)
  const cached = cacheManager.get(cacheKey)

  const [options, setOptions] = useState(() => {
    if (!cached.isMissing && Array.isArray(cached.data) && cached.data.length > 0) {
      return cached.data
    }
    return sortLabelsAz(Array.isArray(fallback) ? fallback : [])
  })

  const [loading, setLoading] = useState(() => cached.isMissing)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    const currentCached = cacheManager.get(cacheKey)
    if (!currentCached.isMissing && !currentCached.isStale && version === 0) {
      setLoading(false)
      return
    }

    if (currentCached.isMissing) {
      setLoading(true)
    }

    catalogItemsApi.list(catalog, false)
      .then((res) => {
        if (!active) return
        const list = (res?.data || []).map((n) => n.label).filter(Boolean)
        const sorted = list.length > 0
          ? sortLabelsAz(list)
          : (Array.isArray(fallback) && fallback.length > 0 ? sortLabelsAz(fallback) : [])

        if (sorted.length > 0) {
          setOptions(sorted)
          cacheManager.set(cacheKey, sorted, {
            ttl: CACHE_CONFIG.CATALOGS.ttl,
            staleTime: CACHE_CONFIG.CATALOGS.staleTime,
            tags: ['catalogs', `catalog_${catalog}`],
            isPublic: true,
          })
        }
      })
      .catch(() => {
        if (active && Array.isArray(fallback) && fallback.length > 0) {
          setOptions(sortLabelsAz(fallback))
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [catalog, version, cacheKey])

  useEffect(() => {
    const onChanged = (event) => {
      if (event?.detail?.catalog !== catalog) return
      cacheManager.delete(cacheKey)
      const incoming = event.detail?.list
      if (Array.isArray(incoming) && incoming.length > 0) {
        const labels = incoming
          .filter((item) => item && item.isActive !== false)
          .map((item) => (typeof item === 'string' ? item : item.label))
          .filter(Boolean)
        if (labels.length > 0) {
          const sorted = sortLabelsAz(labels)
          setOptions(sorted)
          cacheManager.set(cacheKey, sorted, {
            ttl: CACHE_CONFIG.CATALOGS.ttl,
            staleTime: CACHE_CONFIG.CATALOGS.staleTime,
            tags: ['catalogs', `catalog_${catalog}`],
            isPublic: true,
          })
          return
        }
      }
      setVersion((v) => v + 1)
    }

    window.addEventListener(CATALOG_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(CATALOG_CHANGED_EVENT, onChanged)
  }, [catalog, cacheKey])

  const applyList = (list) => {
    const labels = (Array.isArray(list) ? list : [])
      .filter((item) => item && item.isActive !== false)
      .map((item) => (typeof item === 'string' ? item : item.label))
      .filter(Boolean)
    if (labels.length > 0) {
      const sorted = sortLabelsAz(labels)
      setOptions(sorted)
      cacheManager.set(cacheKey, sorted, {
        ttl: CACHE_CONFIG.CATALOGS.ttl,
        staleTime: CACHE_CONFIG.CATALOGS.staleTime,
        tags: ['catalogs', `catalog_${catalog}`],
        isPublic: true,
      })
      return
    }
    cacheManager.delete(cacheKey)
    setVersion((v) => v + 1)
  }

  return {
    options,
    loading,
    reload: () => {
      cacheManager.delete(cacheKey)
      setVersion((v) => v + 1)
    },
    applyList,
  }
}
