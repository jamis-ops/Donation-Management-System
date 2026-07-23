import { createContext, useContext, useState, useEffect } from 'react'
import * as authApi from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = async () => {
    const res = await authApi.me()
    setUser(res.user)
    return res.user
  }

  useEffect(() => {
    authApi
      .me()
      .then((res) => setUser(res.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = async (email, password) => {
    const res = await authApi.login(email, password)
    setUser(res.user)
    return { success: true, user: res.user }
  }

  const register = async (payload) => {
    // Accounts now require email verification before sign-in, so we do NOT
    // authenticate the user here. Return the server response for the UI.
    return authApi.register(payload)
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } finally {
      setUser(null)
    }
  }

  const changePassword = async ({ currentPassword, newPassword }) => {
    const res = await authApi.changePassword({ currentPassword, newPassword })
    if (res?.data) {
      setUser((prev) => (prev ? { ...prev, ...res.data, mustChangePassword: false } : res.data))
    } else {
      setUser((prev) => (prev ? { ...prev, mustChangePassword: false } : prev))
    }
    return res
  }

  const updateAccount = async (payload) => {
    const res = await authApi.updateAccount(payload)
    if (res?.data) {
      setUser((prev) => (prev ? { ...prev, ...res.data } : res.data))
    }
    return res
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        changePassword,
        updateAccount,
        refreshUser,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
