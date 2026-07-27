/** Fired when barangays/beneficiaries are created, updated, or deleted. */
export const BENEFICIARIES_CHANGED = 'beneficiaries:changed'

export function notifyBeneficiariesChanged(detail = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(BENEFICIARIES_CHANGED, { detail }))
}
