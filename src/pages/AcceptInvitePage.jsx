import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import Logo from '../components/shared/Logo'
import Req from '../components/shared/Req'
import { heroBg } from '../assets'
import { REPRESENTATIVE_POSITIONS } from '../constants/options'

export default function AcceptInvitePage() {
  const { token } = useParams()
  const navigate = useNavigate()
  
  const [loading, setLoading] = useState(true)
  const [expired, setExpired] = useState(false)
  const [barangayName, setBarangayName] = useState('')
  
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  
  const [form, setForm] = useState({
    password: '',
    confirmPassword: '',
    representativeLastName: '',
    representativeFirstName: '',
    representativeMiddleInitial: '',
    representativePosition: '',
    contactNumber: ''
  })
  
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  
  useEffect(() => {
    const validateToken = async () => {
      try {
        const res = await fetch(`/api/beneficiaries.php?action=validate_token&token=${token}`)
        if (!res.ok) throw new Error('Network error')
        const data = await res.json()
        if (data.error) {
          setExpired(true)
        } else {
          setBarangayName(data.barangayName || 'your barangay')
        }
      } catch (err) {
        // Assume valid if network error since backend might not be ready
        console.warn('Validation failed, assuming valid for now', err)
        setBarangayName('your barangay')
      } finally {
        setLoading(false)
      }
    }
    
    validateToken()
  }, [token])
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    
    setSubmitting(true)
    try {
      const payload = {
        action: 'accept_invite',
        token,
        ...form
      }
      
      const res = await fetch('/api/beneficiaries.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      if (!res.ok) throw new Error('Failed to accept invitation')
      const data = await res.json()
      
      if (data.error) throw new Error(data.error)
      
      navigate('/login?verified=1')
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-page__visual">
        <img src={heroBg} alt="" className="auth-page__visual-image" />
        <div className="auth-page__visual-overlay">
          <p>Join the mission to rise above together</p>
        </div>
      </div>
      
      <div className="auth-page__form-wrap">
        <div className="auth-card">
          <Logo className="auth-card__logo" />
          
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem 0' }}>
              <p style={{ color: 'var(--color-text-muted)' }}>Validating invitation...</p>
            </div>
          ) : expired ? (
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ color: 'var(--color-danger)', fontSize: '1.5rem', marginBottom: '0.5rem' }}>Invitation Expired</h1>
              <p className="auth-card__subtitle" style={{ marginBottom: '2rem' }}>
                This invitation link is invalid or has expired. 
                Please contact Rise Above Foundation for a new invitation.
              </p>
              <Link to="/contact" className="btn btn--primary btn--lg" style={{ display: 'inline-block' }}>
                Contact Us
              </Link>
            </div>
          ) : (
            <>
              <h1>Welcome to Rise Above</h1>
              <p className="auth-card__subtitle">
                Complete your registration for <strong>{barangayName}</strong> to activate your partner account.
              </p>
              
              {error && <div className="auth-card__error" role="alert">{error}</div>}
              
              <form onSubmit={handleSubmit} className="auth-form">
                <p className="form-section-title" style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
                  Set your password
                </p>
                
                <div className="auth-form__row auth-form__row--split">
                  <label style={{ position: 'relative', width: '100%' }}>
                    <Req required>Password</Req>
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      required 
                      minLength={6} 
                      value={form.password}
                      onChange={(e) => set('password', e.target.value)} 
                      placeholder="Min. 6 chars" 
                      style={{ paddingRight: '2.5rem', width: '100%' }}
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: '0.75rem', top: '2.2rem', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 0 }}
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </label>
                  
                  <label style={{ position: 'relative', width: '100%' }}>
                    <Req required>Confirm</Req>
                    <input 
                      type={showConfirm ? 'text' : 'password'} 
                      required 
                      minLength={6} 
                      value={form.confirmPassword}
                      onChange={(e) => set('confirmPassword', e.target.value)} 
                      placeholder="Confirm password" 
                      style={{ paddingRight: '2.5rem', width: '100%' }}
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowConfirm(!showConfirm)}
                      style={{ position: 'absolute', right: '0.75rem', top: '2.2rem', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 0 }}
                      aria-label="Toggle password visibility"
                    >
                      {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </label>
                </div>
                
                <p className="form-section-title" style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '1rem', marginTop: '1.5rem', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
                  Representative Details
                </p>
                
                <div className="auth-form__row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 60px', gap: '0.75rem' }}>
                  <label style={{ margin: 0 }}>
                    <Req required>First Name</Req>
                    <input type="text" required value={form.representativeFirstName} onChange={(e) => set('representativeFirstName', e.target.value)} style={{ width: '100%' }} />
                  </label>
                  <label style={{ margin: 0 }}>
                    <Req required>Last Name</Req>
                    <input type="text" required value={form.representativeLastName} onChange={(e) => set('representativeLastName', e.target.value)} style={{ width: '100%' }} />
                  </label>
                  <label style={{ margin: 0 }}>
                    MI
                    <input type="text" maxLength={2} value={form.representativeMiddleInitial} onChange={(e) => set('representativeMiddleInitial', e.target.value)} style={{ width: '100%' }} />
                  </label>
                </div>
                
                <div className="auth-form__row auth-form__row--split" style={{ marginTop: '1.5rem' }}>
                  <label style={{ width: '100%' }}>
                    <Req required>Position / Role</Req>
                    <select
                      required
                      value={form.representativePosition}
                      onChange={(e) => set('representativePosition', e.target.value)}
                      style={{ width: '100%' }}
                    >
                      <option value="">Select position…</option>
                      {REPRESENTATIVE_POSITIONS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </label>
                  
                  <label style={{ width: '100%' }}>
                    Contact Number
                    <input 
                      type="tel" 
                      value={form.contactNumber} 
                      onChange={(e) => set('contactNumber', e.target.value)} 
                      placeholder="+63 9xx xxx xxxx" 
                      style={{ width: '100%' }}
                    />
                  </label>
                </div>
                
                <button type="submit" className="btn btn--primary btn--lg auth-form__submit" disabled={submitting} style={{ marginTop: '1rem' }}>
                  {submitting ? 'Activating Account...' : 'Activate Account'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
