import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import Logo from '../../components/shared/Logo'
import Req from '../../components/shared/Req'
import { adminBg } from '../../assets'
import { useLoading } from '../../context/LoadingContext'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const { showLoading, hideLoading } = useLoading()
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, isAuthenticated, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/admin'

  if (authLoading) return null

  if (isAuthenticated) {
    return <Navigate to={from} replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    showLoading('Please wait…')
    try {
      const result = await login(email, password)
      const role = result?.user?.role
      if (role !== 'Admin' && role !== 'SuperAdmin') {
        setError('This login is for Super Admin and Admin accounts only. Use the main login for other roles.')
        return
      }
      if (result.user?.mustChangePassword) {
        navigate('/change-password', { replace: true })
        return
      }
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      hideLoading()
      setLoading(false)
    }
  }

  return (
    <div className="admin-login">
      <div className="admin-login__visual">
        <img src={adminBg} alt="" className="admin-login__visual-image" />
        <div className="admin-login__visual-overlay" />
      </div>

      <div className="admin-login__form-wrap">
        <div className="admin-login__card">
          <div className="admin-login__brand">
            <Logo className="admin-login__logo" />
            <h1>Admin Login</h1>
            <p>Rise Above Foundation Management System</p>
          </div>

          <form onSubmit={handleSubmit} className="admin-login__form">
            {error && <div className="admin-login__error">{error}</div>}

            <label>
              <Req required>Email</Req>
              <input
                type="email"
                required
                maxLength={100}
                value={email}
                onChange={(e) => setEmail(e.target.value.replace(/\s/g, ''))}
                onKeyDown={(e) => { if (e.key === ' ') e.preventDefault() }}
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
                  autoComplete="current-password"
                  placeholder="Enter password"
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem', marginTop: '-0.35rem' }}>
              <Link to="/forgot-password" style={{ fontSize: '0.85rem', color: '#AF101A', textDecoration: 'none', fontWeight: 600 }}>
                Forgot password?
              </Link>
            </div>

            <button type="submit" className="btn btn--primary btn--lg admin-login__submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <Link to="/" className="admin-login__back">Back to public site</Link>
        </div>
      </div>
    </div>
  )
}
