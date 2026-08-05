import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import Logo from '../components/shared/Logo'
import Req from '../components/shared/Req'
import PolicyLinks from '../components/shared/PolicyLinks'
import { heroBg } from '../assets'
import { REPRESENTATIVE_POSITIONS } from '../constants/options'
import { MUNICIPALITIES, barangaysForMunicipality } from '../constants/locations'
import PhoneInput from '../components/shared/PhoneInput'
import { phoneError } from '../utils/validation'

const emptyForm = {
  barangay: '',
  municipality: '',
  representativeLastName: '',
  representativeFirstName: '',
  representativeMiddleInitial: '',
  representativePosition: '',
  contactNumber: '',
  email: '',
  notes: '',
  acceptTerms: false,
}

export default function AcceptInvitePage() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [invalid, setInvalid] = useState(false)
  const [invalidMessage, setInvalidMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  useEffect(() => {
    let active = true
    async function validateToken() {
      try {
        const res = await fetch(`/api/beneficiaries.php?action=validate_token&token=${encodeURIComponent(token || '')}`)
        const data = await res.json().catch(() => null)
        if (!active) return
        if (!data?.valid) {
          setInvalid(true)
          setInvalidMessage(data?.error || 'This invitation link is invalid or has expired.')
          return
        }
        setForm((prev) => ({
          ...prev,
          barangay: data.barangayName || '',
          municipality: data.municipality || '',
          email: data.email || '',
          representativeFirstName: data.representativeFirstName || '',
          representativeLastName: data.representativeLastName || '',
          representativeMiddleInitial: data.representativeMiddleInitial || '',
          representativePosition: data.representativePosition || '',
          contactNumber: data.representativePhone || '',
          notes: data.notes || '',
        }))
      } catch {
        if (!active) return
        setInvalid(true)
        setInvalidMessage('Could not validate this invitation. Please try again later.')
      } finally {
        if (active) setLoading(false)
      }
    }
    validateToken()
    return () => { active = false }
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const phoneMsg = phoneError(form.contactNumber, { required: true })
    if (phoneMsg) {
      setError(phoneMsg)
      return
    }
    if (!form.acceptTerms) {
      setError('Please agree to the Data Privacy Policy and Terms & Conditions.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/beneficiaries.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply_invite',
          token,
          barangay: form.barangay,
          municipality: form.municipality,
          representativeLastName: form.representativeLastName,
          representativeFirstName: form.representativeFirstName,
          representativeMiddleInitial: form.representativeMiddleInitial,
          representativePosition: form.representativePosition,
          contactNumber: form.contactNumber,
          email: form.email,
          notes: form.notes,
          acceptTerms: true,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || data?.error) {
        throw new Error(data?.error || 'Failed to submit application')
      }
      setSubmitted(true)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const barangayOptions = barangaysForMunicipality(form.municipality)

  return (
    <div className="auth-page">
      <div className="auth-page__visual">
        <img src={heroBg} alt="" className="auth-page__visual-image" />
        <div className="auth-page__visual-overlay">
          <p>Partner with Rise Above Foundation Cebu</p>
        </div>
      </div>

      <div className="auth-page__form-wrap">
        <div className="auth-card auth-card--wide">
          <Logo className="auth-card__logo" />

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem 0' }}>
              <p style={{ color: 'var(--color-text-muted)' }}>Validating invitation…</p>
            </div>
          ) : invalid ? (
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ color: 'var(--color-danger)', fontSize: '1.45rem', marginBottom: '0.5rem' }}>Invitation unavailable</h1>
              <p className="auth-card__subtitle" style={{ marginBottom: '1.75rem' }}>{invalidMessage}</p>
              <Link to="/contact" className="btn btn--primary btn--lg">Contact Us</Link>
            </div>
          ) : submitted ? (
            <div className="invite-success">
              <div className="invite-success__icon" aria-hidden="true">
                <CheckCircle2 size={36} />
              </div>
              <h1>Application submitted</h1>
              <p className="auth-card__subtitle">
                Thank you. Your partnership application for <strong>{form.barangay || 'your barangay'}</strong> has been sent for admin review.
                Once approved, Rise Above Foundation Cebu will email login credentials to <strong>{form.email}</strong>.
              </p>
              <Link to="/" className="btn btn--primary btn--lg">Return to homepage</Link>
            </div>
          ) : (
            <>
              <h1>Accept partnership invitation</h1>
              <p className="auth-card__subtitle">
                Complete this form to apply as an official beneficiary partner of Rise Above Foundation Cebu.
                No password is needed yet — credentials are emailed after admin approval.
              </p>

              {error && <div className="auth-card__error" role="alert">{error}</div>}

              <form onSubmit={handleSubmit} className="auth-form invite-form">
                <p className="invite-form__section">Barangay details</p>
                <div className="auth-form__row auth-form__row--split">
                  <label>
                    <Req required>Municipality / City</Req>
                    <select
                      required
                      value={form.municipality}
                      onChange={(e) => setForm((prev) => ({ ...prev, municipality: e.target.value, barangay: '' }))}
                    >
                      <option value="">Select municipality…</option>
                      {MUNICIPALITIES.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                      {form.municipality && !MUNICIPALITIES.includes(form.municipality) && (
                        <option value={form.municipality}>{form.municipality}</option>
                      )}
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
                      <option value="">{form.municipality ? 'Select barangay…' : 'Select municipality first…'}</option>
                      {barangayOptions.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                      {form.barangay && form.municipality && !barangayOptions.includes(form.barangay) && (
                        <option value={form.barangay}>{form.barangay}</option>
                      )}
                    </select>
                  </label>
                </div>

                <p className="invite-form__section">Representative details</p>
                <div className="invite-form__name-grid">
                  <label>
                    <Req required>First Name</Req>
                    <input required value={form.representativeFirstName} onChange={(e) => set('representativeFirstName', e.target.value)} />
                  </label>
                  <label>
                    <Req required>Last Name</Req>
                    <input required value={form.representativeLastName} onChange={(e) => set('representativeLastName', e.target.value)} />
                  </label>
                  <label>
                    MI
                    <input maxLength={2} value={form.representativeMiddleInitial} onChange={(e) => set('representativeMiddleInitial', e.target.value)} />
                  </label>
                </div>

                <div className="auth-form__row auth-form__row--split">
                  <label>
                    <Req required>Position / Role</Req>
                    <select required value={form.representativePosition} onChange={(e) => set('representativePosition', e.target.value)}>
                      <option value="">Select position…</option>
                      {REPRESENTATIVE_POSITIONS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                      {form.representativePosition && !REPRESENTATIVE_POSITIONS.includes(form.representativePosition) && (
                        <option value={form.representativePosition}>{form.representativePosition}</option>
                      )}
                    </select>
                  </label>
                  <label>
                    <Req required>Contact Number</Req>
                    <PhoneInput
                      required
                      value={form.contactNumber}
                      onChange={(contactNumber) => set('contactNumber', contactNumber)}
                      showError={Boolean(error)}
                    />
                  </label>
                </div>

                <label>
                  <Req required>Email Address</Req>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    placeholder="representative@email.com"
                  />
                </label>

                <label>
                  Notes <span className="req-optional">(optional)</span>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => set('notes', e.target.value)}
                    placeholder="Any additional information for the review team…"
                  />
                </label>

                <label className="invite-form__consent">
                  <input
                    type="checkbox"
                    checked={form.acceptTerms}
                    onChange={(e) => set('acceptTerms', e.target.checked)}
                    required
                  />
                  <span>
                    I agree to the <PolicyLinks />.
                  </span>
                </label>

                <button type="submit" className="btn btn--primary btn--lg auth-form__submit" disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit application'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
