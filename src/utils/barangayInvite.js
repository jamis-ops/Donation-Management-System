/**
 * Row-level Invite / Resend — only for open invitations, never registered partners.
 * Allowed: invited, expired, or rejected (re-invite after rejection).
 */
export function canInviteBarangay(row) {
  if (!row) return false
  if (row.userId) return false
  const inviteStatus = String(row.invitationStatus || 'none')
  const status = String(row.status || '')
  if (inviteStatus === 'accepted' || inviteStatus === 'applied') return false
  if (['Active', 'Approved'].includes(status)) return false
  return ['invited', 'expired', 'rejected'].includes(inviteStatus)
}

/**
 * Header "Invite Barangay" may refresh an existing non-registered draft/invite record.
 */
export function canStartOrRefreshInvite(row) {
  if (!row) return true
  if (row.userId) return false
  const inviteStatus = String(row.invitationStatus || 'none')
  const status = String(row.status || '')
  if (['Active', 'Approved'].includes(status)) return false
  if (inviteStatus === 'accepted' || inviteStatus === 'applied') return false
  return true
}

/** Submitted via invite form and waiting for admin decision. */
export function isAwaitingBarangayApproval(row) {
  if (!row) return false
  return row.status === 'Pending Approval' && row.invitationStatus === 'applied'
}
