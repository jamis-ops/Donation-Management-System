export const ROLE_HOME = {
  Admin: '/admin',
  Staff: '/staff',
  Donor: '/donor',
  Volunteer: '/volunteer-portal',
  Beneficiary: '/beneficiary',
}

export function getHomeForRole(role) {
  return ROLE_HOME[role] || '/login'
}
