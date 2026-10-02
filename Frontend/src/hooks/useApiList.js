/* eslint-disable react-hooks/set-state-in-effect, react-hooks/refs */
import { useCallback, useEffect, useRef, useState } from 'react'
import { cacheManager, CACHE_CONFIG } from '../utils/cacheManager'

function inferTagsFromFn(fnStr) {
  const str = String(fnStr).toLowerCase()
  const detected = []
  if (str.includes('donation')) detected.push('donations')
  if (str.includes('inventory')) detected.push('inventory')
  if (str.includes('allocation')) detected.push('allocations')
  if (str.includes('distribution')) detected.push('distributions')
  if (str.includes('beneficiar')) detected.push('beneficiaries')
  if (str.includes('volunteer')) detected.push('volunteers')
  if (str.includes('task')) detected.push('tasks')
  if (str.includes('request') || str.includes('assistance')) detected.push('requests')
  if (str.includes('certificate')) detected.push('certificates')
  if (str.includes('catalog')) detected.push('catalogs')
  if (str.includes('report')) detected.push('reports')
  if (str.includes('dashboard')) detected.push('dashboard')
  if (str.includes('staff')) detected.push('staff')
  return detected.length > 0 ? detected : ['general']
}

function resolveKey(fetchFn, refreshKey, options = {}) {
  if (options.key) return String(options.key)
  if (typeof refreshKey === 'string' || typeof refreshKey === 'number') {
    return `${fetchFn.name || 'apiList'}::${refreshKey}`
  }
  const fnStr = fetchFn.name || fetchFn.toString().replace(/\s+/g, ' ').slice(0, 120)
  return `api::${fnStr}`
}

export function useApiList(fetchFn, refreshKey, maybeOptions = {}) {
  const options = (typeof refreshKey === 'object' && refreshKey !== null) ? refreshKey : maybeOptions
  const bypassCache = !!options.bypassCache
  const fetchRef = useRef(fetchFn)
  fetchRef.current = fetchFn

  const rawKey = resolveKey(fetchFn, refreshKey, options)
  const cacheKey = cacheManager.makeKey(rawKey, !!options.isPublic)
  const tags = options.tags || inferTagsFromFn(fetchFn.toString())
  const ttl = options.ttl || CACHE_CONFIG.OPERATIONAL.ttl
  const staleTime = options.staleTime || CACHE_CONFIG.OPERATIONAL.staleTime

  // Initialize synchronously with cached data if available (instant page rendering)
  const [data, setData] = useState(() => {
    if (bypassCache) return []
    const cached = cacheManager.get(cacheKey)
    if (!cached.isMissing && cached.data !== null && cached.data !== undefined) {
      return Array.isArray(cached.data) ? cached.data : (cached.data.data ?? cached.data)
    }
    return []
  })

  const [loading, setLoading] = useState(() => {
    if (bypassCache) return true
    const cached = cacheManager.get(cacheKey)
    return cached.isMissing || cached.data === null || cached.data === undefined
  })

  const [isRevalidating, setIsRevalidating] = useState(false)
  const [error, setError] = useState('')

  const reload = useCallback(async (silent = false) => {
    if (!silent) {
      // If we already have data, don't flash the full-screen modal during reload; mark as revalidating
      setLoading(() => (data && data.length > 0 ? false : true))
    }
    setIsRevalidating(true)
    setError('')

    try {
      const res = await fetchRef.current()
      const payload = res?.data ?? res
      const cleanData = Array.isArray(payload) ? payload : (payload ? [payload] : [])

      setData(cleanData)
      if (!bypassCache) {
        cacheManager.set(cacheKey, cleanData, { ttl, staleTime, tags, isPublic: options.isPublic })
      }
    } catch (err) {
      setError(err.message || 'Failed to load data')
      // Only empty data if there was no cached data to begin with
      setData((prev) => (prev && prev.length > 0 ? prev : []))
    } finally {
      setLoading(false)
      setIsRevalidating(false)
    }
  }, [cacheKey, bypassCache, ttl, staleTime, tags, options.isPublic, data])

  // Initial load / refreshKey changes
  useEffect(() => {
    if (!bypassCache) {
      const cached = cacheManager.get(cacheKey)
      if (!cached.isMissing && !cached.isStale) {
        // Data is completely fresh; no network call needed
        return
      }
      // If stale, revalidate in the background silently
      if (!cached.isMissing) {
        void reload(true)
        return
      }
    }
    void reload(false)
  }, [reload, refreshKey, cacheKey, bypassCache])

  // React to cache invalidations from other components/actions
  useEffect(() => {
    const onCacheInvalidate = (e) => {
      const invalidatedTags = e.detail?.tags || []
      const isAffected = tags.some((t) => invalidatedTags.includes(t.toLowerCase()))
      if (isAffected) {
        void reload(true)
      }
    }
    window.addEventListener('raf:cache-invalidate', onCacheInvalidate)
    return () => window.removeEventListener('raf:cache-invalidate', onCacheInvalidate)
  }, [reload, tags])

  // Refresh list when user opens a notification link
  useEffect(() => {
    const onNav = () => { void reload(true) }
    window.addEventListener('raf:notification-navigate', onNav)
    return () => window.removeEventListener('raf:notification-navigate', onNav)
  }, [reload])

  return { data, loading, error, reload, setData, isRevalidating }
}

export function useApiObject(fetchFn, refreshKey, maybeOptions = {}) {
  const options = (typeof refreshKey === 'object' && refreshKey !== null) ? refreshKey : maybeOptions
  const bypassCache = !!options.bypassCache
  const fetchRef = useRef(fetchFn)
  fetchRef.current = fetchFn
  const dataRef = useRef(null)

  const rawKey = resolveKey(fetchFn, refreshKey, options)
  const cacheKey = cacheManager.makeKey(rawKey, !!options.isPublic)
  const tags = options.tags || inferTagsFromFn(fetchFn.toString())
  const ttl = options.ttl || CACHE_CONFIG.OPERATIONAL.ttl
  const staleTime = options.staleTime || CACHE_CONFIG.OPERATIONAL.staleTime

  // Initialize synchronously with cached data if available (instant page rendering)
  const [data, setData] = useState(() => {
    if (bypassCache) return null
    const cached = cacheManager.get(cacheKey)
    if (!cached.isMissing && cached.data !== null && cached.data !== undefined) {
      return cached.data?.data ?? cached.data
    }
    return null
  })
  dataRef.current = data

  const [loading, setLoading] = useState(() => {
    if (bypassCache) return true
    const cached = cacheManager.get(cacheKey)
    return cached.isMissing || cached.data === null || cached.data === undefined
  })

  const [isRevalidating, setIsRevalidating] = useState(false)
  const [error, setError] = useState('')

  const reload = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(() => (dataRef.current ? false : true))
    }
    setIsRevalidating(true)
    setError('')

    try {
      const res = await fetchRef.current()
      const payload = res?.data ?? res
      setData(payload)

      if (!bypassCache) {
        cacheManager.set(cacheKey, payload, { ttl, staleTime, tags, isPublic: options.isPublic })
      }
    } catch (err) {
      setError(err.message || 'Failed to load data')
      setData((prev) => prev ?? null)
    } finally {
      setLoading(false)
      setIsRevalidating(false)
    }
  }, [cacheKey, bypassCache, ttl, staleTime, tags, options.isPublic])

  // Initial load / refreshKey changes
  useEffect(() => {
    if (!bypassCache) {
      const cached = cacheManager.get(cacheKey)
      if (!cached.isMissing && !cached.isStale) {
        return
      }
      if (!cached.isMissing) {
        void reload(true)
        return
      }
    }
    void reload(false)
  }, [reload, refreshKey, cacheKey, bypassCache])

  // React to cache invalidations from other components/actions
  useEffect(() => {
    const onCacheInvalidate = (e) => {
      const invalidatedTags = e.detail?.tags || []
      const isAffected = tags.some((t) => invalidatedTags.includes(t.toLowerCase()))
      if (isAffected) {
        void reload(true)
      }
    }
    window.addEventListener('raf:cache-invalidate', onCacheInvalidate)
    return () => window.removeEventListener('raf:cache-invalidate', onCacheInvalidate)
  }, [reload, tags])

  // Refresh on notification navigate
  useEffect(() => {
    const onNav = () => { void reload(true) }
    window.addEventListener('raf:notification-navigate', onNav)
    return () => window.removeEventListener('raf:notification-navigate', onNav)
  }, [reload])

  return { data, loading, error, reload, setData, isRevalidating }
}
