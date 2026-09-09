const RAW_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
export const API_BASE_URL = (!RAW_URL || RAW_URL.includes('donation-system-api.onrender.com'))
  ? (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? '' : 'https://donation-management-system-1.onrender.com')
  : RAW_URL

function apiUrl(path) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${cleanPath}`
}

async function apiFetch(path, options = {}) {
  const url = apiUrl(path)
  const res = await fetch(url, {
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
      throw new Error(
        'Cannot reach the PHP backend. Open a second terminal and run: npm run api'
      )
    }
    const message = data?.error || `Request failed (${res.status})`
    throw new Error(message)
  }
  return data
}

export async function login(email, password, { remember = false } = {}) {
  return apiFetch('/api/login.php', {
    method: 'POST',
    body: JSON.stringify({ email, password, remember: !!remember }),
  })
}

export async function register(payload) {
  return apiFetch('/api/signup.php', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function logout() {
  return apiFetch('/api/logout.php', { method: 'POST', body: '{}' })
}

export async function me() {
  return apiFetch('/api/me.php', { method: 'GET' })
}

export async function updateAccount(payload) {
  return apiFetch('/api/account.php', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function changePassword({ currentPassword, newPassword }) {
  return updateAccount({ currentPassword, newPassword })
}

