/** Broadcast catalog CRUD changes so dropdowns refresh without a page reload. */

export const CATALOG_CHANGED_EVENT = 'raf:catalog-changed'

export function notifyCatalogChanged(catalog, list = null) {
  if (typeof window === 'undefined' || !catalog) return
  window.dispatchEvent(new CustomEvent(CATALOG_CHANGED_EVENT, {
    detail: { catalog, list },
  }))
}
