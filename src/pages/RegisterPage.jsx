import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { BARANGAY_TYPES, NEEDS, REPRESENTATIVE_POSITIONS } from '../constants/options'
import { MUNICIPALITIES, barangaysForMunicipality } from '../constants/locations'
import Req from '../components/shared/Req'
import NameFields from '../components/shared/NameFields'
import Logo from '../components/shared/Logo'
import { heroBg } from '../assets'
import { emptyNameParts, formatFullName } from '../utils/personName'

const emptyForm = {
  nameParts: emptyNameParts(),
  email: '', password: '', phone: '',
  barangay: '', municipality: '', barangayType: '', affectedFamilies: '', needs: [],
  representativePosition: '',
  address: '',
  acceptedPolicies: false,
}

export default function RegisterPage() {
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(null)
  const { register } = useAuth()

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.acceptedPolicies) {
      setError('Please accept the Data Privacy Policy and Terms & Conditions.')
      return
    }
    setLoading(true)
    try {
      const fullName = formatFullName(form.nameParts)
      const payload = {
        role: 'Beneficiary',
        lastName: form.nameParts.lastName,
        firstName: form.nameParts.firstName,
        middleInitial: form.nameParts.middleInitial,
        representativeLastName: form.nameParts.lastName,
        representativeFirstName: form.nameParts.firstName,
        representativeMiddleInitial: form.nameParts.middleInitial,
        name: fullName,
        email: form.email,
        password: form.password,
        phone: form.phone,
        acceptedPolicies: true,
        barangay: form.barangay,
        municipality: form.municipality,
        barangayType: form.barangayType,
        address: form.address,
        affectedFamilies: Number(form.affectedFamilies) || 0,
        needs: form.needs,
        representativePosition: form.representativePosition,
      }
      const result = await register(payload)
      setDone({
        email: form.email,
        emailSent: Boolean(result.emailSent),
        mailError: result.mailError || '',
        message: result.message || '',
      })
    } catch (err) {
      setError(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

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
            {done.emailSent ? (
              <p className="auth-card__subtitle">
                We sent a verification email to <strong>{done.email}</strong>.
                Open that message and click <strong>Verify it&apos;s you</strong> to activate your account.
                Then sign in with the <strong>same password</strong> you just created — no new password is needed.
                The link expires in 24 hours.
              </p>
            ) : (
              <p className="auth-card__subtitle">
                Your account was created for <strong>{done.email}</strong>, but the verification email
                could not be delivered{done.mailError ? `: ${done.mailError}` : '.'}
                {' '}Please contact support or try registering again later.
              </p>
            )}
            <Link to="/login" className="btn btn--primary btn--lg auth-form__submit" style={{ display: 'inline-block', textAlign: 'center' }}>
              Go to Sign In
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
          <h1>Create a barangay account</h1>
          <p className="auth-card__subtitle">
            Register as a Barangay / Beneficiary to request and confirm assistance.
          </p>
          <p className="auth-card__subtitle" style={{ marginTop: '-0.5rem' }}>
            Donors: please use the{' '}
            <Link to="/donate">Donate</Link> page.
            {' '}Volunteers: please use the{' '}
            <Link to="/volunteer">Volunteer</Link> page.
          </p>

          {error && <div className="auth-card__error" role="alert">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <p className="form-section-title">Representative Name</p>
            <NameFields
              value={form.nameParts}
              onChange={(nameParts) => setForm((prev) => ({ ...prev, nameParts }))}
            />

            <label>
              <Req required>Position / Role</Req>
              <select
                required
                value={form.representativePosition}
                onChange={(e) => set('representativePosition', e.target.value)}
              >
                <option value="">Select position…</option>
                {REPRESENTATIVE_POSITIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>

            <label>
              <Req required>Email</Req>
              <input type="email" required value={form.email} onChange={(e) => set('email', e.target.value)}
                placeholder="you@email.com" autoComplete="username" />
            </label>

            <div className="auth-form__row auth-form__row--split">
              <label>
                <Req required>Password</Req>
                <input type="password" required minLength={6} value={form.password}
                  onChange={(e) => set('password', e.target.value)} placeholder="Min. 6 characters" autoComplete="new-password" />
              </label>
              <label>
                Contact Number
                <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+63 9xx xxx xxxx" />
              </label>
            </div>

            <div className="auth-form__row auth-form__row--split">
              <label>
                <Req required>Municipality / City</Req>
                <select
                  required
                  value={form.municipality}
                  onChange={(e) => setForm((prev) => ({
                    ...prev,
                    municipality: e.target.value,
                    barangay: '',
                  }))}
                >
                  <option value="">Select municipality/city…</option>
                  {MUNICIPALITIES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label>
                <Req required>Barangay Name</Req>
                <select
                  required
                  value={form.barangay}
                  disabled={!form.municipality}
                  onChange={(e) => set('barangay', e.target.value)}
                >
                  <option value="">
                    {form.municipality ? 'Select barangay…' : 'Select municipality first…'}
                  </option>
                  {barangaysForMunicipality(form.municipality).map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="auth-form__row auth-form__row--split">
              <label>
                Barangay Type
                <select value={form.barangayType} onChange={(e) => set('barangayType', e.target.value)}>
                  <option value="">Select type...</option>
                  {BARANGAY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label>
                Number of Affected Families
                <input type="number" min="0" value={form.affectedFamilies} onChange={(e) => set('affectedFamilies', e.target.value)} />
              </label>
            </div>

            <label>
              Complete Address
              <input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Purok / Street, Barangay, City, Province" />
            </label>

            {NEEDS.length > 0 && (
              <fieldset className="needs-fieldset">
                <legend>Needs (select all that apply)</legend>
                <div className="needs-grid">
                  {NEEDS.map((n) => (
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

            <label className="auth-policy-check">
              <input
                type="checkbox"
                required
                checked={form.acceptedPolicies}
                onChange={(e) => set('acceptedPolicies', e.target.checked)}
              />
              <span>
                I accept the{' '}
                <Link to="/privacy" target="_blank" rel="noreferrer">Data Privacy Policy</Link>
                {' '}and{' '}
                <Link to="/terms" target="_blank" rel="noreferrer">Terms &amp; Conditions</Link>
                <Req required />
              </span>
            </label>

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
