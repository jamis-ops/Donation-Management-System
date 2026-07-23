import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getHomeForRole } from '../utils/roleRoutes'
import Logo from '../components/shared/Logo'
import Req from '../components/shared/Req'
import { heroBg } from '../assets'

export default function ChangePasswordPage() {
  const { user, loading: authLoading, isAuthenticated, changePassword, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (authLoading) {
    return (
      <div className="portal-loading">
        <div className="portal-loading__spinner" />
        <p>Loading your account...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.')
      return
    }
    setLoading(true)
    try {
      await changePassword({ currentPassword, newPassword })
      await refreshUser()
      navigate(getHomeForRole(user?.role), { replace: true })
    } catch (err) {
      setError(err.message || 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-page__visual">
        <img src={heroBg} alt="" className="auth-page__visual-image" />
        <div className="auth-page__visual-overlay">
          <p>Secure your account before continuing</p>
        </div>
      </div>

      <div className="auth-page__form-wrap">
        <div className="auth-card">
          <Logo className="auth-card__logo" />
          <h1>Change password</h1>
          <p className="auth-card__subtitle">
            {user?.mustChangePassword
              ? 'You signed in with a temporary password. Set a new password to continue.'
              : 'Update your account password.'}
          </p>

          {error && <div className="auth-card__error" role="alert">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <label>
              <Req required>Current password</Req>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Temporary or current password"
                autoComplete="current-password"
              />
            </label>

            <label>
              <Req required>New password</Req>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters"
                autoComplete="new-password"
              />
            </label>

            <label>
              <Req required>Confirm new password</Req>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
              />
            </label>

            <button type="submit" className="btn btn--primary btn--lg auth-form__submit" disabled={loading}>
              {loading ? 'Saving...' : 'Update Password'}
            </button>
          </form>

          {!user?.mustChangePassword && (
            <Link to={getHomeForRole(user?.role)} className="auth-back-link">Back to portal</Link>
          )}
        </div>
      </div>
    </div>
  )
}
