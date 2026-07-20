import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { BARANGAY_TYPES, NEEDS } from '../constants/options'
import Logo from '../components/shared/Logo'
import { heroBg } from '../assets'

const ROLES = [
  { id: 'Donor', label: 'Donor', blurb: 'Give and track your donations.' },
  { id: 'Volunteer', label: 'Volunteer', blurb: 'Apply and join relief operations.' },
  { id: 'Beneficiary', label: 'Barangay', blurb: 'Receive and confirm donations.' },
]

const emptyForm = {
  name: '', email: '', password: '', phone: '',
  barangay: '', municipality: '', barangayType: '', address: '', affectedFamilies: '', needs: [],
}

export default function RegisterPage() {
  const [role, setRole] = useState('Donor')
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(null)
  const { register } = useAuth()

  const barangayTypes = BARANGAY_TYPES
  const needOptions = NEEDS

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const payload = {
        role,
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone,
      }
      if (role === 'Beneficiary') {
        Object.assign(payload, {
          barangay: form.barangay,
          municipality: form.municipality,
          barangayType: form.barangayType,
          address: form.address,
          affectedFamilies: Number(form.affectedFamilies) || 0,
          needs: form.needs,
        })
      }
      const result = await register(payload)
      setDone({ email: form.email, verifyUrl: result.verifyUrl || '' })
    } catch (err) {
      setError(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const isBarangay = role === 'Beneficiary'

  if (done) {
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
            <h1>Check your email</h1>
            <p className="auth-card__subtitle">
              We sent a <strong>Verify it&apos;s you</strong> email to <strong>{done.email}</strong>.
              Open it and click the button to activate your account, then sign in with the password you chose.
            </p>
            {done.verifyUrl && (
              <div className="auth-verify-cta">
                <p>Didn&apos;t get the email? Use this button to verify now:</p>
                <a href={done.verifyUrl} className="btn btn--primary btn--lg auth-form__submit">
                  Verify it&apos;s you
                </a>
              </div>
            )}
            <Link to="/login" className="auth-alt" style={{ display: 'block', marginTop: '1rem' }}>
              Already verified? Sign in
            </Link>
            <Link to="/" className="auth-back-link">Back to website</Link>
          </div>
        </div>
      </div>
    )
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
          <h1>Create an account</h1>
          <p className="auth-card__subtitle">Register as a donor, volunteer, or barangay beneficiary.</p>

          <div className="auth-role-tabs">
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`auth-role-tab${role === r.id ? ' auth-role-tab--active' : ''}`}
                onClick={() => { setRole(r.id); setError('') }}
              >
                <strong>{r.label}</strong>
                <span>{r.blurb}</span>
              </button>
            ))}
          </div>

          {error && <div className="auth-card__error" role="alert">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <label>
              {isBarangay ? 'Point of Contact Name' : 'Full Name'}
              <input required value={form.name} onChange={(e) => set('name', e.target.value)}
                placeholder={isBarangay ? 'Barangay representative' : 'Your full name'} autoComplete="name" />
            </label>

            <label>
              Email
              <input type="email" required value={form.email} onChange={(e) => set('email', e.target.value)}
                placeholder="you@email.com" autoComplete="username" />
            </label>

            <div className="auth-form__row auth-form__row--split">
              <label>
                Password
                <input type="password" required minLength={6} value={form.password}
                  onChange={(e) => set('password', e.target.value)} placeholder="Min. 6 characters" autoComplete="new-password" />
              </label>
              <label>
                Contact Number
                <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+63 9xx xxx xxxx" />
              </label>
            </div>

            {isBarangay && (
              <>
                <div className="auth-form__row auth-form__row--split">
                  <label>
                    Barangay Name
                    <input required value={form.barangay} onChange={(e) => set('barangay', e.target.value)} placeholder="Brgy. Talisay" />
                  </label>
                  <label>
                    Municipality / City
                    <input value={form.municipality} onChange={(e) => set('municipality', e.target.value)} placeholder="Talisay City" />
                  </label>
                </div>
                <div className="auth-form__row auth-form__row--split">
                  <label>
                    Barangay Type
                    <select value={form.barangayType} onChange={(e) => set('barangayType', e.target.value)}>
                      <option value="">Select type...</option>
                      {barangayTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </label>
                  <label>
                    Affected Families
                    <input type="number" min="0" value={form.affectedFamilies} onChange={(e) => set('affectedFamilies', e.target.value)} />
                  </label>
                </div>
                <label>
                  Complete Address
                  <input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Purok / Street, Barangay, City, Province" />
                </label>
                {needOptions.length > 0 && (
                  <fieldset className="needs-fieldset">
                    <legend>Needs (select all that apply)</legend>
                    <div className="needs-grid">
                      {needOptions.map((n) => (
                        <label key={n} className="need-check">
                          <input
                            type="checkbox"
                            checked={form.needs.includes(n)}
                            onChange={(e) => setForm((prev) => ({
                              ...prev,
                              needs: e.target.checked ? [...prev.needs, n] : prev.needs.filter((x) => x !== n),
                            }))}
                          />
                          {n}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}
              </>
            )}

            <button type="submit" className="btn btn--primary btn--lg auth-form__submit" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="auth-alt">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
          <Link to="/" className="auth-back-link">Back to website</Link>
        </div>
      </div>
    </div>
  )
}
