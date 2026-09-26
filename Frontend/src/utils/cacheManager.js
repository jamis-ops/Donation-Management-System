/**
 * Central In-Memory Caching & Stale-While-Revalidate Engine
 * Rise Above Foundation Cebu - Donation & Operations Management System
 *
 * Guarantees fast instant-page navigation while ensuring operational data
 * (inventory, allocations, requests, statuses) is instantly invalidated upon mutation.
 */

// Cache Entry: { data, timestamp, ttl, staleTime, tags, scope }
const store = new Map()
const tagMap = new Map()
const inFlightRequests = new Map()

// Default TTL and Stale configurations (in milliseconds)
export const CACHE_CONFIG = {
  // Static & Reference Data: long cache with SWR
  CATALOGS: { ttl: 10 * 60 * 1000, staleTime: 5 * 60 * 1000 },
  PUBLIC_CONTENT: { ttl: 15 * 60 * 1000, staleTime: 5 * 60 * 1000 },
  
  // Operational Data: short cache with rapid invalidation on mutations
  OPERATIONAL: { ttl: 60 * 1000, staleTime: 20 * 1000 },
  DASHBOARD: { ttl: 60 * 1000, staleTime: 20 * 1000 },
  BADGES: { ttl: 20 * 1000, staleTime: 10 * 1000 },
}

/**
 * Resolves current user scope ID to prevent cross-user data leakage.
 */
function getCurrentScope() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('active_user')
      if (raw) {
        const u = JSON.parse(raw)
        return `user:${u.id || u.email || 'authenticated'}`
      }
      const token = localStorage.getItem('auth_token')
      if (token) return `token:${token.slice(-16)}`
    }
  } catch {
    // fallback
  }
  return 'anonymous'
}

/**
 * Mapping of API endpoint paths to their associated cache tags for automatic invalidation.
 */
export const ENDPOINT_TAG_MAP = {
  '/api/inventory.php': ['inventory', 'dashboard', 'reports', 'needs_stock'],
  '/api/inventory_catalog.php': ['inventory_catalog', 'catalogs', 'inventory'],
  '/api/allocations.php': ['allocations', 'inventory', 'requests', 'distributions', 'dashboard', 'reports', 'needs_stock'],
  '/api/donations.php': ['donations', 'dashboard', 'reports', 'donors', 'needs_stock'],
  '/api/donation_updates.php': ['donation_updates', 'donations'],
  '/api/donors.php': ['donors', 'dashboard', 'reports'],
  '/api/distributions.php': ['distributions', 'allocations', 'dashboard', 'reports', 'distribution_proofs'],
  '/api/distribution_proofs.php': ['distribution_proofs', 'distributions'],
  '/api/beneficiaries.php': ['beneficiaries', 'dashboard', 'reports', 'needs_stock'],
  '/api/assistance_requests.php': ['requests', 'dashboard', 'reports', 'needs_stock'],
  '/api/volunteers.php': ['volunteers', 'dashboard', 'reports', 'tasks'],
  '/api/tasks.php': ['tasks', 'dashboard', 'volunteers'],
  '/api/task_titles.php': ['task_titles', 'tasks', 'catalogs'],
  '/api/certificates.php': ['certificates', 'volunteers', 'donations'],
  '/api/catalog_items.php': ['catalogs', 'settings', 'inventory'],
  '/api/needs_stock.php': ['needs_stock', 'inventory', 'requests'],
  '/api/content.php': ['public_content', 'content'],
  '/api/content_catalog.php': ['public_content', 'content'],
  '/api/staff.php': ['staff', 'users'],
  '/api/dashboard.php': ['dashboard'],
  '/api/reports.php': ['reports'],
  '/api/admin_badges.php': ['badges'],
}

class CacheManager {
  /**
   * Determine associated tags for a given API endpoint or path.
   */
  resolveTags(path) {
    const cleanPath = path.split('?')[0].toLowerCase()
    for (const [endpoint, tags] of Object.entries(ENDPOINT_TAG_MAP)) {
      if (cleanPath.endsWith(endpoint.toLowerCase())) {
        return tags
      }
    }
    return ['general']
  }

  /**
   * Generate a stable, scoped cache key.
   */
  makeKey(identifier, isPublic = false) {
    const scope = isPublic ? 'public' : getCurrentScope()
    return `${scope}::${String(identifier).trim()}`
  }

  /**
   * Retrieve cached item if present and not expired.
   * Returns: { data, isStale, isMissing: false } or { data: null, isStale: true, isMissing: true }
   */
  get(key) {
    const entry = store.get(key)
    if (!entry) {
      return { data: null, isStale: true, isMissing: true }
    }

    const now = Date.now()
    const age = now - entry.timestamp

    if (age >= entry.ttl) {
      this.delete(key)
      return { data: null, isStale: true, isMissing: true }
    }

    return {
      data: entry.data,
      isStale: age >= entry.staleTime,
      isMissing: false,
    }
  }

  /**
   * Store data in cache with TTL, stale period, and invalidation tags.
   */
  set(key, data, options = {}) {
    if (data === undefined || data === null) return

    const {
      ttl = CACHE_CONFIG.OPERATIONAL.ttl,
      staleTime = CACHE_CONFIG.OPERATIONAL.staleTime,
      tags = [],
      isPublic = false,
    } = options

    const entry = {
      data,
      timestamp: Date.now(),
      ttl,
      staleTime,
      tags: Array.isArray(tags) ? tags : [tags],
      scope: isPublic ? 'public' : getCurrentScope(),
    }

    store.set(key, entry)

    // Index by tag for fast group invalidation
    entry.tags.forEach((tag) => {
      const normalizedTag = tag.toLowerCase()
      if (!tagMap.has(normalizedTag)) {
        tagMap.set(normalizedTag, new Set())
      }
      tagMap.get(normalizedTag).add(key)
    })
  }

  /**
   * Delete a specific cache key and remove it from tag index.
   */
  delete(key) {
    const entry = store.get(key)
    if (entry) {
      entry.tags.forEach((tag) => {
        const set = tagMap.get(tag.toLowerCase())
        if (set) {
          set.delete(key)
          if (set.size === 0) tagMap.delete(tag.toLowerCase())
        }
      })
    }
    store.delete(key)
    inFlightRequests.delete(key)
  }

  /**
   * Invalidate all cache entries matching specified tag(s).
   * Dispatches 'raf:cache-invalidate' so mounted UI hooks update immediately.
   */
  invalidateTags(tags) {
    const tagList = (Array.isArray(tags) ? tags : [tags]).map((t) => String(t).toLowerCase())
    const keysToDelete = new Set()

    tagList.forEach((tag) => {
      const matchingKeys = tagMap.get(tag)
      if (matchingKeys) {
        matchingKeys.forEach((k) => keysToDelete.add(k))
      }
    })

    keysToDelete.forEach((key) => {
      this.delete(key)
    })

    if (typeof window !== 'undefined' && keysToDelete.size > 0) {
      window.dispatchEvent(
        new CustomEvent('raf:cache-invalidate', {
          detail: { tags: tagList, count: keysToDelete.size },
        })
      )
    }
  }

  /**
   * Deduplicate in-flight requests so concurrent calls share the exact same promise.
   */
  async deduplicate(key, fetchFn) {
    if (inFlightRequests.has(key)) {
      return inFlightRequests.get(key)
    }

    const promise = (async () => {
      try {
        return await fetchFn()
      } finally {
        inFlightRequests.delete(key)
      }
    })()

    inFlightRequests.set(key, promise)
    return promise
  }

  /**
   * Clear all user-scoped data from cache upon logout or account switch.
   * Keeps public reference data intact.
   */
  clearUserScope() {
    const keysToDelete = []
    store.forEach((entry, key) => {
      if (entry.scope !== 'public') {
        keysToDelete.push(key)
      }
    })
    keysToDelete.forEach((key) => this.delete(key))
    inFlightRequests.clear()
  }

  /**
   * Complete purge of all cache entries (e.g. on selective DB wipe or hard reset).
   */
  clearAll() {
    store.clear()
    tagMap.clear()
    inFlightRequests.clear()
  }

  /**
   * Prefetch a query in the background so future navigation renders immediately.
   */
  async prefetch(identifier, fetchFn, options = {}) {
    const isPublic = !!options.isPublic
    const key = this.makeKey(identifier, isPublic)
    const cached = this.get(key)

    if (!cached.isMissing && !cached.isStale) {
      return cached.data
    }

    try {
      const data = await this.deduplicate(key, fetchFn)
      const tags = options.tags || this.resolveTags(String(identifier))
      this.set(key, data, { ...options, tags, isPublic })
      return data
    } catch {
      // background prefetch errors can be safely ignored
      return null
    }
  }
}

export const cacheManager = new CacheManager()
