import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Logo from '../../components/shared/Logo'
import { adminBg } from '../../assets'

export default function LoginPage() {
  const [email, setEmail] = useState('admin@riseabovefoundation.org')
  const [password, setPassword] = useState('')
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
    try {
      const result = await login(email, password)
      if (result?.user?.role !== 'Admin') {
        setError('This login is for Admin accounts only. Use the main login for other roles.')
        return
      }
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
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
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Enter password"
              />
            </label>

            <button type="submit" className="btn btn--primary btn--lg admin-login__submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="admin-login__demo">
            <p><strong>Demo credentials</strong></p>
            <p>Email: <code>admin@riseabovefoundation.org</code></p>
            <p>Password: <code>admin123</code></p>
          </div>

          <Link to="/" className="admin-login__back">Back to public site</Link>
        </div>
      </div>
    </div>
  )
}
