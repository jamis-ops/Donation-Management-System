export async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  const text = await res.text()
  let data = null
  try {
    if (text) data = JSON.parse(text)
  } catch (err) {
    // If not valid JSON, we still want to throw so the UI shows the real error instead of 'Cannot read properties of null'.
    if (!res.ok) {
      if (res.status === 502 || res.status === 503) {
        throw new Error('Cannot reach the PHP backend. Run: npm run api')
      }
      throw new Error(`Request failed (${res.status}): ` + text.substring(0, 200))
    }
    throw new Error('Invalid JSON from server: ' + text.substring(0, 200))
  }

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
export const beneficiariesApi = {
  ...resourceApi('/api/beneficiaries.php'),
  invite: (body) => apiFetch('/api/beneficiaries.php?action=invite', {
    method: 'POST',
    body: JSON.stringify({ ...body, action: 'invite' }),
  }),
  reinvite: (id, body = {}) => apiFetch(`/api/beneficiaries.php?id=${id}&action=reinvite`, {
    method: 'POST',
    body: JSON.stringify({ ...body, action: 'reinvite' }),
  }),
  approve: (id, body = {}) => apiFetch(`/api/beneficiaries.php?id=${id}&action=approve`, {
    method: 'POST',
    body: JSON.stringify({ ...body, action: 'approve' }),
  }),
  reject: (id, body = {}) => apiFetch(`/api/beneficiaries.php?id=${id}&action=reject`, {
    method: 'POST',
    body: JSON.stringify({ ...body, action: 'reject' }),
  }),
}
export const assistanceRequestsApi = resourceApi('/api/assistance_requests.php')
export const inventoryApi = resourceApi('/api/inventory.php')
export const volunteersApi = resourceApi('/api/volunteers.php')
export const volunteerMatchApi = {
  suggest: (params = {}) => {
    const q = new URLSearchParams()
    const skills = params.skills || params.requiredSkills || []
    if (Array.isArray(skills) && skills.length) q.set('skills', skills.join(','))
    if (Array.isArray(params.programs) && params.programs.length) q.set('programs', params.programs.join(','))
    if (params.availability) q.set('availability', params.availability)
    if (params.excludeVolunteerId) q.set('excludeVolunteerId', String(params.excludeVolunteerId))
    if (params.limit) q.set('limit', String(params.limit))
    const qs = q.toString()
    return apiFetch(`/api/volunteer_match.php${qs ? `?${qs}` : ''}`)
  },
}
export const tasksApi = resourceApi('/api/tasks.php')
export const distributionsApi = {
  ...resourceApi('/api/distributions.php'),
  listForProof: () => apiFetch('/api/distributions.php?forProof=1'),
}
export const allocationsApi = {
  ...resourceApi('/api/allocations.php'),
  listReadyForDistribution: () => apiFetch('/api/allocations.php?readyForDistribution=1'),
}
export const certificatesApi = resourceApi('/api/certificates.php')
export const needsStockApi = {
  get: () => apiFetch('/api/needs_stock.php'),
  barangayAnalysis: (barangayId) => apiFetch(`/api/needs_stock.php?action=barangay_analysis&barangay_id=${barangayId}`),
}

/** Settings-managed catalogs: needs | barangay_types | task_types */
export const catalogItemsApi = {
  list: (catalog, all = false) =>
    apiFetch(`/api/catalog_items.php?catalog=${encodeURIComponent(catalog)}${all ? '&all=1' : ''}`),
  get: (catalog, id) =>
    apiFetch(`/api/catalog_items.php?catalog=${encodeURIComponent(catalog)}&id=${id}`),
  create: (catalog, body = {}) =>
    apiFetch(`/api/catalog_items.php?catalog=${encodeURIComponent(catalog)}`, {
      method: 'POST',
      body: JSON.stringify({ ...body, catalog }),
    }),
  update: (catalog, id, body = {}) =>
    apiFetch(`/api/catalog_items.php?catalog=${encodeURIComponent(catalog)}&id=${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...body, catalog }),
    }),
  remove: (catalog, id) =>
    apiFetch(`/api/catalog_items.php?catalog=${encodeURIComponent(catalog)}&id=${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ catalog }),
    }),
}

/** @deprecated Prefer catalogItemsApi with catalog "needs" */
export const needTypesApi = {
  list: (all = false) => catalogItemsApi.list('needs', all),
  create: (body) => catalogItemsApi.create('needs', body),
  update: (id, body) => catalogItemsApi.update('needs', id, body),
  remove: (id) => catalogItemsApi.remove('needs', id),
}

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

export function createStaffAccount(body) {
  return apiFetch('/api/staff.php', { method: 'POST', body: JSON.stringify(body) })
}

export function updateStaff(id, body) {
  return apiFetch(`/api/staff.php?id=${id}`, { method: 'PUT', body: JSON.stringify(body) })
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

export function submitPublicAssistance(body) {
  return apiFetch('/api/assistance_requests.php', {
    method: 'POST',
    body: JSON.stringify({ ...body, public: true }),
  })
}

export function submitPublicVolunteer(body) {
  return apiFetch('/api/volunteers.php', {
    method: 'POST',
    body: JSON.stringify({ ...body, public: true }),
  })
}

export function submitContactMessage(body) {
  return apiFetch('/api/contact.php', {
    method: 'POST',
    body: JSON.stringify(body),
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

export const contentApi = {
  list: (query = '') => apiFetch(`/api/content.php${query}`),
  get: (id) => apiFetch(`/api/content.php?id=${id}`),
  create: (body) => apiFetch('/api/content.php', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => apiFetch(`/api/content.php?id=${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id) => apiFetch(`/api/content.php?id=${id}`, { method: 'DELETE', body: '{}' }),
  action: (id, action, extra = {}) =>
    apiFetch(`/api/content.php?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify({ action, ...extra }),
    }),
  publicList: (type) => apiFetch(`/api/content.php?public=1&type=${encodeURIComponent(type)}`),
  publicPage: (slug) => apiFetch(`/api/content.php?public=1&page=${encodeURIComponent(slug)}`),
}

export async function uploadProfilePhoto(formData) {
  const res = await fetch('/api/account.php', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || 'Photo upload failed')
  return data
}

/** Fetch published CMS items; return fallback when empty or request fails. */
export async function fetchPublishedContent(type, fallback = []) {
  try {
    const res = await contentApi.publicList(type)
    const data = Array.isArray(res.data) ? res.data : []
    return data.length > 0 ? data : fallback
  } catch {
    return fallback
  }
}

export async function fetchPublishedPage(slug) {
  try {
    const res = await contentApi.publicPage(slug)
    return res.data || null
  } catch {
    return null
  }
}

export const repackingApi = {
  list: () => apiFetch('/api/inventory.php?tab=repacking'),
  create: (body) => apiFetch('/api/inventory.php?tab=repacking', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => apiFetch(`/api/inventory.php?id=${id}&tab=repacking`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id) => apiFetch(`/api/inventory.php?id=${id}&tab=repacking`, { method: 'DELETE', body: '{}' }),
}
