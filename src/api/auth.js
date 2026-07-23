async function apiFetch(path, options = {}) {
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
      throw new Error(
        'Cannot reach the PHP backend. Open a second terminal and run: npm run api'
      )
    }
    const message = data?.error || `Request failed (${res.status})`
    throw new Error(message)
  }
  return data
}

export async function login(email, password) {
  return apiFetch('/api/login.php', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
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

