/**
 * Centralized Inventory Stock Level and Status Calculation Utility
 * Rise Above Foundation Cebu
 *
 * Enforces unified stock status logic across the entire system:
 * 🟢 Sufficient -> Green (Quantity > Moderate Threshold)
 * 🟡 Moderate / Medium Stock -> Yellow/Amber (Low Threshold < Quantity <= Moderate Threshold)
 * 🔴 Low Stock -> Red (Quantity <= Low Threshold)
 */

/**
 * Calculates stock level code, display label, and semantic badge variant.
 *
 * @param {number|string} availableQuantity - The current available or on-hand stock quantity
 * @param {number|string} [lowThreshold=100] - Configured low stock alert threshold
 * @param {number|string|null} [moderateThreshold=null] - Configured moderate stock threshold (defaults to 2× lowThreshold)
 * @returns {{
 *   level: 'low'|'moderate'|'sufficient',
 *   label: 'Low Stock'|'Moderate'|'Sufficient',
 *   variant: 'danger'|'warning'|'success',
 *   dotColor: string,
 *   percent: number
 * }}
 */
export function calculateInventoryStatus(availableQuantity, lowThreshold = 100, moderateThreshold = null) {
  const qty = Math.max(0, Number(availableQuantity) || 0)
  const low = Math.max(0, Number(lowThreshold) || 100)
  const mod = (moderateThreshold !== null && moderateThreshold !== undefined && !isNaN(Number(moderateThreshold)) && Number(moderateThreshold) > 0)
    ? Number(moderateThreshold)
    : Math.max(low * 2, low + 1)

  // Percent calculation relative to moderate target (capped at 100)
  const percent = mod > 0 ? Math.min(100, Math.round((qty / mod) * 100)) : 100

  if (qty <= low) {
    return {
      level: 'low',
      label: 'Low Stock',
      variant: 'danger',
      dotColor: '#dc2626',
      percent,
    }
  }

  if (qty <= mod) {
    return {
      level: 'moderate',
      label: 'Moderate',
      variant: 'warning',
      dotColor: '#d97706',
      percent,
    }
  }

  return {
    level: 'sufficient',
    label: 'Sufficient',
    variant: 'success',
    dotColor: '#16a34a',
    percent,
  }
}

/**
 * Resolves stock level and label from an inventory item object.
 *
 * @param {Object} item
 * @returns {{
 *   level: 'low'|'moderate'|'sufficient',
 *   label: string,
 *   variant: 'danger'|'warning'|'success',
 *   percent: number
 * }}
 */
export function getStockStatusFromItem(item) {
  if (!item) {
    return {
      level: 'sufficient',
      label: 'Available',
      variant: 'success',
      percent: 100,
    }
  }

  const available = item.available !== undefined && item.available !== null
    ? item.available
    : item.quantity

  const low = item.lowStockThreshold ?? item.low_stock_threshold ?? 100
  const moderate = item.moderateStockThreshold ?? item.moderate_stock_threshold ?? null

  return calculateInventoryStatus(available, low, moderate)
}

/**
 * Maps a stock level or status string into a human-readable label.
 */
export function formatStockLabel(levelOrStatus) {
  if (!levelOrStatus) return 'Sufficient'
  const normalized = String(levelOrStatus).toLowerCase().trim()
  if (normalized === 'low' || normalized.includes('low')) return 'Low Stock'
  if (normalized === 'moderate' || normalized.includes('mod') || normalized.includes('medium')) return 'Moderate'
  return 'Sufficient'
}
