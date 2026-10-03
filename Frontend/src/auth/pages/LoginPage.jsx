import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getHomeForRole, isAdminPortalRole } from '../../utils/roleRoutes'
import Logo from '../../components/shared/Logo'
import Req from '../../components/shared/Req'
import { heroBg } from '../../assets'
import { useLoading } from '../../context/LoadingContext'

export default function LoginPage() {
  const [email, setEmail] = useState(() =>
    localStorage.getItem('raf_remember') === '1' ? (localStorage.getItem('raf_remember_email') || '') : ''
  )
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(() => localStorage.getItem('raf_remember') === '1')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { showLoading, hideLoading } = useLoading()
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname
  const [params] = useSearchParams()
  const justVerified = params.get('verified') === '1'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    showLoading('Processing…')
    try {
      const result = await login(email, password, { remember })
      if (remember) {
        localStorage.setItem('raf_remember', '1')
        localStorage.setItem('raf_remember_email', email.trim().toLowerCase())
      } else {
        localStorage.removeItem('raf_remember')
        localStorage.removeItem('raf_remember_email')
      }
      if (result.user?.mustChangePassword) {
        navigate('/change-password', { replace: true })
        return
      }
      if (from && (isAdminPortalRole(result.user?.role) || from.startsWith('/staff') || from.startsWith('/donor') || from.startsWith('/volunteer') || from.startsWith('/intern') || from.startsWith('/beneficiary'))) {
        navigate(from, { replace: true })
        return
      }
      navigate(getHomeForRole(result.user?.role), { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed')
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
          <p>Together we can make a difference</p>
        </div>
      </div>

      <div className="auth-page__form-wrap">
        <div className="auth-card">
          <Logo className="auth-card__logo" />
          <h1>Welcome back</h1>
          <p className="auth-card__subtitle">Sign in to access your portal or dashboard.</p>

          {justVerified && (
            <div className="auth-card__success auth-card__success--verified" role="status">
              <span className="auth-card__success-check" aria-hidden>✓</span>
              <span>
                <strong>Your account has been successfully verified.</strong>
                {' '}Sign in with the password you created during registration.
              </span>
            </div>
          )}

          {error && <div className="auth-card__error" role="alert">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <label>
              <Req required>Email</Req>
              <input
                type="email"
                required
                maxLength={100}
                value={email}
                onChange={(e) => setEmail(e.target.value.replace(/\s/g, ''))}
                onKeyDown={(e) => { if (e.key === ' ') e.preventDefault() }}
                placeholder="you@email.com"
                autoComplete="username"
              />
            </label>

            <label>
              <Req required>Password</Req>
              <div className="password-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  maxLength={64}
                  value={password}
                  onChange={(e) => setPassword(e.target.value.replace(/\s/g, ''))}
                  onKeyDown={(e) => { if (e.key === ' ') e.preventDefault() }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="password-toggle-btn"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            <div className="auth-form__row">
              <label className="auth-checkbox">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Remember me
              </label>
              <Link to="/forgot-password" className="auth-link-btn">Forgot password?</Link>
            </div>

            <button type="submit" className="btn btn--primary btn--lg auth-form__submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Log In'}
            </button>
          </form>

          <p className="auth-alt">
            Barangay partners join by invitation only.{' '}
            <Link to="/contact">Contact us</Link> to partner with Rise Above.
            <br />
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Donors: <Link to="/donate">Donate</Link> · Volunteers: <Link to="/volunteer">Be a Volunteer</Link>
            </span>
          </p>

          <Link to="/" className="auth-back-link">Back to website</Link>
        </div>
      </div>
    </div>
  )
}
