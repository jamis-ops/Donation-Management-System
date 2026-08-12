import { useState } from 'react'
import { submitPublicDonation } from '../api/resources'
import { DONOR_TYPES } from '../constants/options'
import Req from '../components/shared/Req'
import NameFields from '../components/shared/NameFields'
import PolicyLinks from '../components/shared/PolicyLinks'
import { emptyNameParts, formatFullName } from '../utils/personName'
import { emailError, phoneError, fileSizeError, MAX_UPLOAD_BYTES } from '../utils/validation'
import PhoneInput from '../components/shared/PhoneInput'
import NeedsPicker from '../components/shared/NeedsPicker'

const getExampleFor = (need) => {
  const n = String(need || '').toLowerCase()
  if (n.includes('food')) return 'Rice, canned goods, biscuits, etc.'
  if (n.includes('water')) return 'Bottled water, drinking water, etc.'
  if (n.includes('cloth')) return 'Shirts, pants, blankets, etc.'
  if (n.includes('medicine')) return 'First-aid supplies, basic medicines, etc.'
  if (n.includes('hygiene')) return 'Soap, toothpaste, alcohol, etc.'
  if (n.includes('education')) return 'Notebooks, pens, bags, etc.'
  if (n.includes('shelter')) return 'Tents, tarpaulins, mats, etc.'
  return `Details for ${need}...`
}

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
  nameParts: emptyNameParts(),
  email: '',
  phone: '',
  country: '',
  address: '',
  amount: '',
  items: '',
  selectedNeeds: [],
  needDescriptions: {},
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
    const emailMsg = emailError(form.email)
    if (emailMsg) {
      setSubmitError(emailMsg)
      return
    }
    const phoneMsg = phoneError(form.phone, { required: true })
    if (phoneMsg) {
      setSubmitError(phoneMsg)
      return
    }
    if (form.type === 'monetary' && !(Number(form.amount) > 0)) {
      setSubmitError('Monetary amount must be greater than 0.')
      return
    }
    if (form.type === 'in-kind') {
      if (!form.selectedNeeds || form.selectedNeeds.length === 0) {
        setSubmitError('Please select at least one Type of Need.')
        return
      }
      for (const need of form.selectedNeeds) {
        if (!form.needDescriptions[need] || !form.needDescriptions[need].trim()) {
          setSubmitError(`Please provide a description for ${need}.`)
          return
        }
      }
    }
    if (!form.proof) {
      setSubmitError('Proof of donation is required.')
      return
    }
    const sizeMsg = fileSizeError(form.proof, MAX_UPLOAD_BYTES.donation, 'Proof file')
    if (sizeMsg) {
      setSubmitError(sizeMsg)
      return
    }
    if (!form.acceptedPolicies) {
      setSubmitError('Please accept the Data Privacy Policy and Terms & Conditions.')
      return
    }

    setSubmitting(true)
    try {
      const fullName = formatFullName(form.nameParts)
      const fd = new FormData()
      fd.append('public', '1')
      fd.append('donorType', form.donorType)
      if (isCompany) fd.append('organization', form.organization)
      fd.append('lastName', form.nameParts.lastName || '')
      fd.append('firstName', form.nameParts.firstName || '')
      fd.append('middleInitial', form.nameParts.middleInitial || '')
      fd.append('donorName', fullName)
      fd.append('contactPerson', fullName)
      fd.append('email', form.email)
      fd.append('phone', form.phone)
      if (form.country) fd.append('country', form.country)
      if (form.address) fd.append('address', form.address)
      fd.append('acceptedPolicies', '1')
      fd.append('type', form.type === 'in-kind' ? 'In-Kind' : 'Monetary')
      if (form.type === 'monetary') {
        fd.append('amount', String(form.amount))
        fd.append('paymentMethod', form.paymentMethod)
      } else {
        const itemsStr = form.selectedNeeds
          .map((need) => `[${need}] ${form.needDescriptions[need]}`)
          .join('\n')
        fd.append('items', itemsStr)
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

              <p className="form-section-title">{isCompany ? 'Contact Person' : 'Donor Name'}</p>
              <NameFields
                value={form.nameParts}
                onChange={(nameParts) => setForm({ ...form, nameParts })}
              />

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

              <div className="form-row">
                <label>
                  <Req required>Contact Number</Req>
                  <PhoneInput
                    required
                    value={form.phone}
                    onChange={(phone) => setForm({ ...form, phone })}
                    showError={Boolean(submitError)}
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
                <div className="in-kind-items-section">
                  <NeedsPicker
                    label="Type of Needs"
                    value={form.selectedNeeds}
                    onChange={(needs) => setForm({ ...form, selectedNeeds: needs })}
                    showNote={false}
                    required
                  />

                  {form.selectedNeeds.length > 0 && (
                    <div className="items-descriptions" style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
                      <p className="form-section-title">Items</p>
                      {form.selectedNeeds.map((need) => (
                        <label key={need} style={{ marginBottom: '1rem' }}>
                          <Req required>{need}</Req>
                          <input
                            type="text"
                            required
                            placeholder={getExampleFor(need)}
                            value={form.needDescriptions[need] || ''}
                            onChange={(e) => setForm({
                              ...form,
                              needDescriptions: {
                                ...form.needDescriptions,
                                [need]: e.target.value,
                              },
                            })}
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <label>
                <Req required>Upload Proof of Donation</Req>
                <input
                  type="file"
                  required
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
                  <PolicyLinks />
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
