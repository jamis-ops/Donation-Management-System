import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { BARANGAY_TYPES, DONOR_TYPES, NEEDS, REPRESENTATIVE_POSITIONS } from '../constants/options'
import { MUNICIPALITIES, barangaysForMunicipality } from '../constants/locations'
import Req from '../components/shared/Req'
import Logo from '../components/shared/Logo'
import { heroBg } from '../assets'

const ROLES = [
  { id: 'Donor', label: 'Donor', blurb: 'Give and track your donations.' },
  { id: 'Volunteer', label: 'Volunteer', blurb: 'Apply and join relief operations.' },
  { id: 'Beneficiary', label: 'Barangay', blurb: 'Receive and confirm donations.' },
]

const emptyForm = {
  name: '', email: '', password: '', phone: '',
  donorType: 'Individual', organization: '', country: '', address: '',
  barangay: '', municipality: '', barangayType: '', affectedFamilies: '', needs: [],
  representativePosition: '',
  acceptedPolicies: false,
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
  const isCompany = form.donorType === 'Company'
  const isBarangay = role === 'Beneficiary'

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.acceptedPolicies) {
      setError('Please accept the Data Privacy Policy and Terms & Conditions.')
      return
    }
    if (role === 'Donor' && isCompany && !form.organization.trim()) {
      setError('Company / Organization Name is required.')
      return
    }
    setLoading(true)
    try {
      const payload = {
        role,
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone,
        acceptedPolicies: true,
      }
      if (role === 'Donor') {
        Object.assign(payload, {
          donorType: form.donorType,
          country: form.country,
          address: form.address,
        })
        if (isCompany) {
          payload.organization = form.organization
        }
      }
      if (role === 'Beneficiary') {
        Object.assign(payload, {
          barangay: form.barangay,
          municipality: form.municipality,
          barangayType: form.barangayType,
          address: form.address,
          affectedFamilies: Number(form.affectedFamilies) || 0,
          needs: form.needs,
          representativePosition: form.representativePosition,
        })
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
            {role === 'Donor' && (
              <label>
                <Req required>Donor Type</Req>
                <select
                  required
                  value={form.donorType}
                  onChange={(e) => setForm((prev) => ({
                    ...prev,
                    donorType: e.target.value,
                    organization: e.target.value === 'Individual' ? '' : prev.organization,
                  }))}
                >
                  {DONOR_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>
            )}

            {role === 'Donor' && isCompany && (
              <label>
                <Req required>Company / Organization Name</Req>
                <input
                  required
                  value={form.organization}
                  onChange={(e) => set('organization', e.target.value)}
                  placeholder="Acme Foundation Inc."
                />
              </label>
            )}

            <label>
              <Req required>
                {isBarangay
                  ? 'Representative Full Name'
                  : role === 'Donor' && isCompany
                    ? 'Contact Person'
                    : 'Full Name'}
              </Req>
              <input
                required
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder={isBarangay ? 'Barangay representative' : 'Your full name'}
                autoComplete="name"
              />
            </label>

            {isBarangay && (
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
            )}

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

            {role === 'Donor' && (
              <div className="auth-form__row auth-form__row--split">
                <label>
                  Country
                  <input value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="Philippines" />
                </label>
                <label>
                  Address
                  <input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Street, City" />
                </label>
              </div>
            )}

            {isBarangay && (
              <>
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
                      {barangayTypes.map((t) => <option key={t} value={t}>{t}</option>)}
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
