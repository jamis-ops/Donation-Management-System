import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getHomeForRole } from '../../utils/roleRoutes'
import { passwordError } from '../../utils/validation'
import Logo from '../../components/shared/Logo'
import Req from '../../components/shared/Req'
import PasswordRequirements from '../../components/shared/PasswordRequirements'
import { heroBg } from '../../assets'
import { useLoading } from '../../context/LoadingContext'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import PolicyConsentBox from '../../components/shared/PolicyConsentBox'

export default function ChangePasswordPage() {
  const { user, loading: authLoading, isAuthenticated, changePassword, refreshUser } = useAuth()
  const navigate = useNavigate()
  const { showLoading, hideLoading } = useLoading()
  const [currentPassword, setCurrentPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)
  const isFirstTimeSetup = Boolean(user?.mustChangePassword)

  if (authLoading) {
    return <LoadingSpinner message="Loading your account…" />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const pwValidationErr = passwordError(newPassword, { fieldLabel: 'New password' })
    if (pwValidationErr) {
      setError(pwValidationErr)
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.')
      return
    }
    if (isFirstTimeSetup && (!acceptedTerms || !acceptedPrivacy)) {
      setError('Accept both the Terms and Conditions and Data Privacy Policy before continuing.')
      return
    }
    setLoading(true)
    showLoading('Saving changes…')
    try {
      await changePassword({ currentPassword, newPassword, ...(isFirstTimeSetup ? { acceptedTerms, acceptedPrivacy } : {}) })
      await refreshUser()
      navigate(getHomeForRole(user?.role), { replace: true })
    } catch (err) {
      setError(err.message || 'Failed to change password')
    } finally {
      hideLoading()
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
              <div className="password-input-wrap">
                <input
                  id="account-current-password"
                  name="currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  maxLength={64}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value.replace(/\s/g, ''))}
                  onKeyDown={(e) => { if (e.key === ' ') e.preventDefault() }}
                  placeholder="Temporary or current password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((v) => !v)}
                  className="password-toggle-btn"
                  title={showCurrentPassword ? 'Hide password' : 'Show password'}
                  aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            <label>
              <Req required>New password</Req>
              <div className="password-input-wrap">
                <input
                  id="account-new-password"
                  name="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  maxLength={64}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value.replace(/\s/g, ''))}
                  onKeyDown={(e) => { if (e.key === ' ') e.preventDefault() }}
                  placeholder="Min. 8 chars (upper, lower, digit, symbol)"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="password-toggle-btn"
                  title={showNewPassword ? 'Hide password' : 'Show password'}
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            <PasswordRequirements password={newPassword} />

            <label>
              <Req required>Confirm new password</Req>
              <div className="password-input-wrap">
                <input
                  id="account-confirm-password"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  maxLength={64}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value.replace(/\s/g, ''))}
                  onKeyDown={(e) => { if (e.key === ' ') e.preventDefault() }}
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="password-toggle-btn"
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {isFirstTimeSetup && (
              <PolicyConsentBox
                acceptedTerms={acceptedTerms}
                onTermsChange={setAcceptedTerms}
                acceptedPrivacy={acceptedPrivacy}
                onPrivacyChange={setAcceptedPrivacy}
                actionLabel="change your password"
                title="Terms and Privacy Agreement"
                description="Review and accept both policies to complete your first-time account setup."
              />
            )}

            <button type="submit" className="btn btn--primary btn--lg auth-form__submit" disabled={loading || (isFirstTimeSetup && (!acceptedTerms || !acceptedPrivacy))}>
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
