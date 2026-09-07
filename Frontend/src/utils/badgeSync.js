/**
 * Global event bus for triggering badge count updates when records are created, approved, rejected, or updated.
 */
export const BADGES_CHANGED = 'app:badges-changed'

export function notifyBadgesChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BADGES_CHANGED))
  }
}
