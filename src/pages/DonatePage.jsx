import { useState } from 'react'
import { Link } from 'react-router-dom'
import { submitPublicDonation } from '../api/resources'
import { DONOR_TYPES } from '../constants/options'
import Req from '../components/shared/Req'

const donationTypes = [
  { id: 'monetary', label: 'Monetary Donation' },
  { id: 'in-kind', label: 'In-Kind Donation' },
]

const lifecycle = [
  'Donation Submission',
  'Tracking Code Generated',
  'Donation Verification',
  'Inventory Recording',
  'Repacking (if needed)',
  'Resource Allocation',
  'Distribution Planning',
  'Distribution to Beneficiaries',
  'Certificate / Official Receipt',
]

const emptyForm = {
  type: 'monetary',
  donorType: 'Individual',
  organization: '',
  donorName: '',
  email: '',
  phone: '',
  country: '',
  address: '',
  amount: '',
  items: '',
  paymentMethod: 'bank-transfer',
  proof: null,
  message: '',
  acceptedPolicies: false,
}

export default function DonatePage() {
  const [submitted, setSubmitted] = useState(false)
  const [trackingCode, setTrackingCode] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const isCompany = form.donorType === 'Company'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError('')

    if (isCompany && !form.organization.trim()) {
      setSubmitError('Company / Organization Name is required.')
      return
    }
    if (!form.acceptedPolicies) {
      setSubmitError('Please accept the Data Privacy Policy and Terms & Conditions.')
      return
    }

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('public', '1')
      fd.append('donorType', form.donorType)
      if (isCompany) fd.append('organization', form.organization)
      fd.append('donorName', form.donorName)
      fd.append('contactPerson', form.donorName)
      fd.append('email', form.email)
      if (form.phone) fd.append('phone', form.phone)
      if (form.country) fd.append('country', form.country)
      if (form.address) fd.append('address', form.address)
      fd.append('acceptedPolicies', '1')
      fd.append('type', form.type === 'in-kind' ? 'In-Kind' : 'Monetary')
      if (form.type === 'monetary') {
        fd.append('amount', String(form.amount))
        fd.append('paymentMethod', form.paymentMethod)
      } else {
        fd.append('items', form.items)
      }
      if (form.message) fd.append('message', form.message)
      if (form.proof) fd.append('proof', form.proof)
      const res = await submitPublicDonation(fd)
      setTrackingCode(res.data.trackingCode)
      setSubmitted(true)
      setForm(emptyForm)
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit donation')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page">
      <section className="page-hero">
        <div className="container">
          <h1>Make a Donation</h1>
          <p>Your generosity powers relief, education, and community development across Cebu.</p>
        </div>
      </section>

      <section className="section">
        <div className="container container--narrow">
          {/* Lifecycle stepper */}
          <div className="donation-lifecycle">
            <h2>How Your Donation Gets There</h2>
            <ol className="lifecycle-steps">
              {lifecycle.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className="info-panel__note">
              Email notifications are sent at every major stage.
            </p>
          </div>

          {submitted ? (
            <div className="form-success">
              <h2>Thank You for Your Donation!</h2>
              <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
                Use your tracking code below to monitor verification and distribution progress.
              </p>
              <p className="tracking-code">
                Tracking code: <code>{trackingCode}</code>
              </p>
              <p style={{ marginTop: '0.75rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                Status: <strong style={{ color: 'var(--color-brand)' }}>Pending Verification</strong>
              </p>
              <button
                type="button"
                className="btn btn--outline"
                style={{ marginTop: '1.5rem' }}
                onClick={() => setSubmitted(false)}
              >
                Submit Another Donation
              </button>
            </div>
          ) : (
            <form className="form-card" onSubmit={handleSubmit}>
              <h2>Donation Form</h2>

              <fieldset className="radio-group">
                <legend><Req required>Donation Type</Req></legend>
                {donationTypes.map((dt) => (
                  <label key={dt.id} className="radio-label">
                    <input
                      type="radio"
                      name="donationType"
                      value={dt.id}
                      checked={form.type === dt.id}
                      onChange={() => setForm({ ...form, type: dt.id })}
                    />
                    {dt.label}
                  </label>
                ))}
              </fieldset>

              <label>
                <Req required>Donor Type</Req>
                <select
                  required
                  value={form.donorType}
                  onChange={(e) => setForm({
                    ...form,
                    donorType: e.target.value,
                    organization: e.target.value === 'Individual' ? '' : form.organization,
                  })}
                >
                  {DONOR_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>

              {isCompany && (
                <label>
                  <Req required>Company / Organization Name</Req>
                  <input
                    type="text"
                    required
                    placeholder="Acme Foundation Inc."
                    value={form.organization}
                    onChange={(e) => setForm({ ...form, organization: e.target.value })}
                  />
                </label>
              )}

              <div className="form-row">
                <label>
                  <Req required>{isCompany ? 'Contact Person' : 'Full Name'}</Req>
                  <input
                    type="text"
                    required
                    placeholder="Juan dela Cruz"
                    value={form.donorName}
                    onChange={(e) => setForm({ ...form, donorName: e.target.value })}
                  />
                </label>
                <label>
                  <Req required>Email</Req>
                  <input
                    type="email"
                    required
                    placeholder="you@email.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Contact Number
                  <input
                    type="text"
                    placeholder="+63 9xx xxx xxxx"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </label>
                <label>
                  Country
                  <input
                    type="text"
                    placeholder="Philippines"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                  />
                </label>
              </div>

              <label>
                Address
                <input
                  type="text"
                  placeholder="Street, City, Province"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </label>

              {form.type === 'monetary' ? (
                <>
                  <label>
                    <Req required>Amount (PHP)</Req>
                    <input
                      type="number"
                      min="1"
                      required
                      placeholder="500"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    />
                  </label>
                  <label>
                    Payment Method
                    <select
                      value={form.paymentMethod}
                      onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                    >
                      <option value="bank-transfer">Bank Transfer</option>
                      <option value="gcash">GCash</option>
                      <option value="paymaya">Maya</option>
                      <option value="cash">Cash (in person)</option>
                    </select>
                  </label>
                </>
              ) : (
                <label>
                  <Req required>Items Description</Req>
                  <textarea
                    rows={4}
                    required
                    placeholder="List items, quantities, and condition (e.g., 10 canned goods, good condition)..."
                    value={form.items}
                    onChange={(e) => setForm({ ...form, items: e.target.value })}
                  />
                </label>
              )}

              <label>
                Upload Proof of Donation
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setForm({ ...form, proof: e.target.files?.[0] ?? null })}
                />
                <span className="field-hint">Receipt, screenshot, or photo — JPG, PNG, or PDF</span>
              </label>

              <label>
                Message (optional)
                <textarea
                  rows={3}
                  placeholder="Leave a note for the foundation..."
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                />
              </label>

              <label className="auth-policy-check" style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <input
                  type="checkbox"
                  required
                  checked={form.acceptedPolicies}
                  onChange={(e) => setForm({ ...form, acceptedPolicies: e.target.checked })}
                />
                <span>
                  I accept the{' '}
                  <Link to="/privacy" target="_blank" rel="noreferrer">Data Privacy Policy</Link>
                  {' '}and{' '}
                  <Link to="/terms" target="_blank" rel="noreferrer">Terms &amp; Conditions</Link>
                  <Req required />
                </span>
              </label>

              <button type="submit" className="btn btn--primary btn--lg" style={{ width: '100%' }} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Donation'}
              </button>
              {submitError && <p style={{ color: '#c0392b', marginTop: '1rem' }}>{submitError}</p>}
            </form>
          )}
        </div>
      </section>
    </div>
  )
}
