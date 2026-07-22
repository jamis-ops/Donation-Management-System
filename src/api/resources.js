export async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 502 || res.status === 503) {
      throw new Error('Cannot reach the PHP backend. Run: npm run api')
    }
    throw new Error(data?.error || `Request failed (${res.status})`)
  }
  return data
}

export function resourceApi(basePath) {
  return {
    list: (query = '') => apiFetch(`${basePath}${query}`),
    get: (id) => apiFetch(`${basePath}?id=${id}`),
    create: (body) => apiFetch(basePath, { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => apiFetch(`${basePath}?id=${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id) => apiFetch(`${basePath}?id=${id}`, { method: 'DELETE', body: '{}' }),
  }
}

export const donationsApi = resourceApi('/api/donations.php')
export const donationUpdatesApi = {
  list: (donationId) => apiFetch(`/api/donation_updates.php?donationId=${donationId}`),
  create: (body) => apiFetch('/api/donation_updates.php', { method: 'POST', body: JSON.stringify(body) }),
}
export const donorsApi = resourceApi('/api/donors.php')
export const beneficiariesApi = resourceApi('/api/beneficiaries.php')
export const assistanceRequestsApi = resourceApi('/api/assistance_requests.php')
export const inventoryApi = resourceApi('/api/inventory.php')
export const volunteersApi = resourceApi('/api/volunteers.php')
export const tasksApi = resourceApi('/api/tasks.php')
export const distributionsApi = {
  ...resourceApi('/api/distributions.php'),
  listForProof: () => apiFetch('/api/distributions.php?forProof=1'),
}
export const allocationsApi = resourceApi('/api/allocations.php')
export const certificatesApi = resourceApi('/api/certificates.php')

export function getDashboard() {
  return apiFetch('/api/dashboard.php')
}

export function getReports() {
  return apiFetch('/api/reports.php')
}

export function getPortalData() {
  return apiFetch('/api/portal.php')
}

export function getStaff() {
  return apiFetch('/api/staff.php')
}

export function submitPublicDonation(bodyOrFormData) {
  if (bodyOrFormData instanceof FormData) {
    if (!bodyOrFormData.has('public')) bodyOrFormData.append('public', '1')
    return fetch('/api/donations.php', {
      method: 'POST',
      credentials: 'include',
      body: bodyOrFormData,
    }).then(async (res) => {
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
      return data
    })
  }
  return apiFetch('/api/donations.php', {
    method: 'POST',
    body: JSON.stringify({ ...bodyOrFormData, public: true }),
  })
}

export function createStaffAccount(body) {
  return apiFetch('/api/staff.php', { method: 'POST', body: JSON.stringify(body) })
}

export function submitPublicAssistance(body) {
  return apiFetch('/api/assistance_requests.php', {
    method: 'POST',
    body: JSON.stringify({ ...body, public: true }),
  })
}

export function getNotifications(unreadOnly = false) {
  return apiFetch(`/api/notifications.php${unreadOnly ? '?unread=1' : ''}`)
}

export function markNotificationRead(id) {
  return apiFetch(`/api/notifications.php?id=${id}`, { method: 'PUT', body: '{}' })
}

export function markAllNotificationsRead() {
  return apiFetch('/api/notifications.php', { method: 'PUT', body: JSON.stringify({ markAllRead: true }) })
}

export function getDistributionProofs(beneficiaryId = null) {
  const qs = beneficiaryId ? `?beneficiaryId=${beneficiaryId}` : ''
  return apiFetch(`/api/distribution_proofs.php${qs}`)
}

export async function uploadDistributionProof(formData) {
  const res = await fetch('/api/distribution_proofs.php', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || 'Upload failed')
  return data
}

export function reviewProof(id, status, remarks = '') {
  return apiFetch(`/api/distribution_proofs.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status, remarks }),
  })
}

export async function getInventoryWithSummary() {
  return apiFetch('/api/inventory.php')
}

export const repackingApi = {
  list: () => apiFetch('/api/inventory.php?tab=repacking'),
  create: (body) => apiFetch('/api/inventory.php?tab=repacking', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => apiFetch(`/api/inventory.php?id=${id}&tab=repacking`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id) => apiFetch(`/api/inventory.php?id=${id}&tab=repacking`, { method: 'DELETE', body: '{}' }),
}
