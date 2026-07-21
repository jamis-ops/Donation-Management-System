import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getHomeForRole } from '../utils/roleRoutes'
import Logo from '../components/shared/Logo'
import Req from '../components/shared/Req'
import { heroBg } from '../assets'

const demoAccounts = [
  { role: 'Admin', email: 'admin@riseabovefoundation.org', password: 'admin123' },
  { role: 'Donor', email: 'donor@riseabovefoundation.org', password: 'demo123' },
  { role: 'Volunteer', email: 'volunteer@riseabovefoundation.org', password: 'demo123' },
  { role: 'Beneficiary', email: 'beneficiary@riseabovefoundation.org', password: 'demo123' },
  { role: 'Staff', email: 'staff@riseabovefoundation.org', password: 'demo123' },
]

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
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
      const result = await login(email, password)
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
          <p className="auth-card__subtitle">Sign in to access your donor, volunteer, or beneficiary portal.</p>

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
              <button type="button" className="auth-link-btn">Forgot password?</button>
            </div>

            <button type="submit" className="btn btn--primary btn--lg auth-form__submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Log In'}
            </button>
          </form>

          <p className="auth-alt">
            New here? <Link to="/register">Create an account</Link>
          </p>

          <div className="auth-demo">
            <h3>Demo accounts</h3>
            <ul>
              {demoAccounts.map((acc) => (
                <li key={acc.email}>
                  <button
                    type="button"
                    className="auth-demo__btn"
                    onClick={() => {
                      setEmail(acc.email)
                      setPassword(acc.password)
                    }}
                  >
                    <strong>{acc.role}</strong>
                    <span>{acc.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <Link to="/" className="auth-back-link">Back to website</Link>
        </div>
      </div>
    </div>
  )
}
