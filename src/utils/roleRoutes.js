export const ROLE_HOME = {
  SuperAdmin: '/admin',
  Admin: '/admin',
  Staff: '/staff',
  Donor: '/donor',
  Volunteer: '/volunteer-portal',
  Beneficiary: '/beneficiary',
}

/** Admin portal roles (hardcoded SuperAdmin + database Admin). */
export function isAdminPortalRole(role) {
  return role === 'SuperAdmin' || role === 'Admin'
}

/** Only the hardcoded Super Admin may manage database Admin accounts. */
export function isSuperAdminRole(role, user) {
  return role === 'SuperAdmin' || !!user?.isSuperAdmin
}

export function getHomeForRole(role) {
  return ROLE_HOME[role] || '/login'
}
