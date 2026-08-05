import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getHomeForRole } from '../utils/roleRoutes'
import Logo from '../components/shared/Logo'
import Req from '../components/shared/Req'
import { heroBg } from '../assets'

export default function LoginPage() {
  const [email, setEmail] = useState(() =>
    localStorage.getItem('raf_remember') === '1' ? (localStorage.getItem('raf_remember_email') || '') : ''
  )
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(() => localStorage.getItem('raf_remember') === '1')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const justVerified = params.get('verified') === '1'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
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
      navigate(getHomeForRole(result.user?.role), { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
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
          <p className="auth-card__subtitle">Sign in to access your donor, volunteer, or barangay portal.</p>

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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                autoComplete="username"
              />
            </label>

            <label>
              <Req required>Password</Req>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
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
              <Link to="/contact" className="auth-link-btn">Forgot password?</Link>
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
              Donors: <Link to="/donate">Donate</Link> · Volunteers: <Link to="/volunteer">Apply</Link>
            </span>
          </p>

          <Link to="/" className="auth-back-link">Back to website</Link>
        </div>
      </div>
    </div>
  )
}
