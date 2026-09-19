import { useState, useMemo } from 'react'
import { 
  Building2, User, MapPin, CreditCard, Copy, Check, QrCode, 
  Landmark, Wallet, Globe, ShieldCheck, Info, FileText
} from 'lucide-react'
import { submitPublicDonation } from '../../api/resources'
import { DONOR_TYPES } from '../../constants/options'
import { COUNTRIES, getRegionsForCountry } from '../../constants/locations'
import Req from '../../components/shared/Req'
import NameFields from '../../components/shared/NameFields'
import PolicyLinks from '../../components/shared/PolicyLinks'
import { emptyNameParts, formatFullName } from '../../utils/personName'
import { emailError, phoneError, fileSizeError, MAX_UPLOAD_BYTES } from '../../utils/validation'
import PhoneInput from '../../components/shared/PhoneInput'
import NeedsPicker from '../../components/shared/NeedsPicker'
import { notifyBadgesChanged } from '../../utils/badgeSync'
import { useLoading } from '../../context/LoadingContext'
import gcashQrImg from '../../assets/images/gcash-qr.png'

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

const PAYMENT_METHODS = [
  { id: 'paypal', label: 'Paypal', dbValue: 'PayPal' },
  { id: 'bank-transfer', label: 'Bank Transfer', dbValue: 'Bank Transfer' },
  { id: 'gcash', label: 'Gcash Philippines', dbValue: 'GCash' },
  { id: 'crypto', label: 'Cryptocurrency', dbValue: 'Cryptocurrency' },
  { id: 'check', label: 'Check Donation', dbValue: 'Check Donation' },
  { id: 'usa', label: 'USA', dbValue: 'USA Donation' },
  { id: 'canada', label: 'CANADA', dbValue: 'Canada Donation' },
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
  country: 'Philippines',
  stateProvince: '',
  customRegion: '',
  streetAddress: '',
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
  const { showLoading, hideLoading } = useLoading()
  const [trackingCode, setTrackingCode] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [copiedKey, setCopiedKey] = useState('')

  const isCompany = form.donorType === 'Company'

  const availableRegions = useMemo(() => {
    return getRegionsForCountry(form.country)
  }, [form.country])

  const handleCopy = (text, key) => {
    if (!text) return
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {})
    }
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(''), 2000)
  }

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
    const phoneMsg = phoneError(form.phone, { required: true, allowInternational: true })
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
    showLoading('Processing…')
    try {
      const fullName = formatFullName(form.nameParts)
      const selectedRegion = form.stateProvince === 'Other' ? form.customRegion.trim() : form.stateProvince.trim()
      const composedAddress = [form.streetAddress.trim(), selectedRegion].filter(Boolean).join(', ')

      const fd = new FormData()
      fd.append('public', '1')
      fd.append('donorType', form.donorType)
      if (isCompany) fd.append('organization', form.organization.trim())
      fd.append('lastName', form.nameParts.lastName || '')
      fd.append('firstName', form.nameParts.firstName || '')
      fd.append('middleInitial', form.nameParts.middleInitial || '')
      fd.append('donorName', isCompany ? (form.organization.trim() || fullName) : fullName)
      fd.append('contactPerson', fullName)
      fd.append('email', form.email.trim())
      fd.append('phone', form.phone.trim())
      if (form.country) fd.append('country', form.country)
      if (composedAddress || form.streetAddress) fd.append('address', composedAddress || form.streetAddress.trim())
      fd.append('acceptedPolicies', '1')
      fd.append('type', form.type === 'in-kind' ? 'In-Kind' : 'Monetary')
      if (form.type === 'monetary') {
        fd.append('amount', String(form.amount))
        const matchedMethod = PAYMENT_METHODS.find((m) => m.id === form.paymentMethod)
        fd.append('paymentMethod', matchedMethod ? matchedMethod.dbValue : form.paymentMethod)
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
      notifyBadgesChanged()
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit donation')
    } finally {
      hideLoading()
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

          <div className="card">
            <h2>Donation Details</h2>
            {submitError && <div className="error-banner">{submitError}</div>}
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
              <form onSubmit={handleSubmit}>
                <fieldset className="form-group" style={{ border: 'none', padding: 0, margin: '0 0 1.25rem' }}>
                  <legend className="form-label" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
                    <Req required>Donation Type</Req>
                  </legend>
                  <div className="form-row" style={{ display: 'flex', gap: '1.5rem' }}>
                    {donationTypes.map((dt) => (
                      <label key={dt.id} className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="donationType"
                          value={dt.id}
                          checked={form.type === dt.id}
                          onChange={() => setForm({ ...form, type: dt.id })}
                        />
                        <span>{dt.label}</span>
                      </label>
                    ))}
                  </div>
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

                {isCompany ? (
                  <>
                    {/* Company / Organization Details */}
                    <div style={{ marginTop: '1rem', marginBottom: '1.25rem' }}>
                      <p className="form-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Building2 size={15} /> Company / Organization Information
                      </p>
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

                      <div className="form-row">
                        <label>
                          Country
                          <select
                            value={form.country}
                            onChange={(e) => {
                              const nextCountry = e.target.value
                              setForm({
                                ...form,
                                country: nextCountry,
                                stateProvince: '',
                                customRegion: '',
                              })
                            }}
                          >
                            {COUNTRIES.map((c) => (
                              <option key={c.code} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                        </label>

                        <label>
                          {form.country === 'Philippines' ? 'Province / Region' : 'State / Province / Region'}
                          {availableRegions.length > 0 ? (
                            <select
                              value={form.stateProvince}
                              onChange={(e) => setForm({ ...form, stateProvince: e.target.value })}
                            >
                              <option value="">
                                {form.country === 'Philippines' ? '-- Select Province / Region --' : '-- Select State / Province --'}
                              </option>
                              {availableRegions.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                              <option value="Other">Other / Custom Region</option>
                            </select>
                          ) : (
                            <input
                              value={form.stateProvince}
                              onChange={(e) => setForm({ ...form, stateProvince: e.target.value })}
                              placeholder="State / Province / Region"
                            />
                          )}
                        </label>
                      </div>

                      {form.stateProvince === 'Other' && (
                        <label>
                          Specify State / Province / Region
                          <input
                            value={form.customRegion}
                            onChange={(e) => setForm({ ...form, customRegion: e.target.value })}
                            placeholder="Enter state/province name"
                          />
                        </label>
                      )}

                      <label>
                        Company / Organization Address
                        <input
                          type="text"
                          placeholder="Building, Street, Barangay, City, Postal Code"
                          value={form.streetAddress}
                          onChange={(e) => setForm({ ...form, streetAddress: e.target.value })}
                        />
                      </label>
                    </div>

                    {/* Authorized Representative / Contact Person */}
                    <div style={{ marginTop: '1rem', marginBottom: '1.25rem' }}>
                      <p className="form-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <User size={15} /> Authorized Representative / Contact Person
                      </p>
                      <NameFields
                        value={form.nameParts}
                        onChange={(nameParts) => setForm({ ...form, nameParts })}
                      />

                      <div className="form-row">
                        <label>
                          <Req required>Email</Req>
                          <input
                            type="email"
                            required
                            placeholder="contact@company.com"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                          />
                        </label>

                        <label>
                          <Req required>Contact Number</Req>
                          <PhoneInput
                            allowInternational
                            required
                            value={form.phone}
                            onChange={(phone) => setForm({ ...form, phone })}
                            showError={Boolean(submitError)}
                          />
                        </label>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Individual Donor */}
                    <div style={{ marginTop: '1rem', marginBottom: '1.25rem' }}>
                      <p className="form-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <User size={15} /> Donor Name &amp; Contact
                      </p>
                      <NameFields
                        value={form.nameParts}
                        onChange={(nameParts) => setForm({ ...form, nameParts })}
                      />

                      <div className="form-row">
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

                        <label>
                          <Req required>Contact Number</Req>
                          <PhoneInput
                            allowInternational
                            required
                            value={form.phone}
                            onChange={(phone) => setForm({ ...form, phone })}
                            showError={Boolean(submitError)}
                          />
                        </label>
                      </div>
                    </div>

                    {/* Individual Address & Location */}
                    <div style={{ marginTop: '1rem', marginBottom: '1.25rem' }}>
                      <p className="form-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <MapPin size={15} /> Address &amp; Location Details
                      </p>
                      <div className="form-row">
                        <label>
                          Country
                          <select
                            value={form.country}
                            onChange={(e) => {
                              const nextCountry = e.target.value
                              setForm({
                                ...form,
                                country: nextCountry,
                                stateProvince: '',
                                customRegion: '',
                              })
                            }}
                          >
                            {COUNTRIES.map((c) => (
                              <option key={c.code} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                        </label>

                        <label>
                          {form.country === 'Philippines' ? 'Province / Region' : 'State / Province / Region'}
                          {availableRegions.length > 0 ? (
                            <select
                              value={form.stateProvince}
                              onChange={(e) => setForm({ ...form, stateProvince: e.target.value })}
                            >
                              <option value="">
                                {form.country === 'Philippines' ? '-- Select Province / Region --' : '-- Select State / Province --'}
                              </option>
                              {availableRegions.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                              <option value="Other">Other / Custom Region</option>
                            </select>
                          ) : (
                            <input
                              value={form.stateProvince}
                              onChange={(e) => setForm({ ...form, stateProvince: e.target.value })}
                              placeholder="State / Province / Region"
                            />
                          )}
                        </label>
                      </div>

                      {form.stateProvince === 'Other' && (
                        <label>
                          Specify State / Province / Region
                          <input
                            value={form.customRegion}
                            onChange={(e) => setForm({ ...form, customRegion: e.target.value })}
                            placeholder="Enter state/province name"
                          />
                        </label>
                      )}

                      <label>
                        Address
                        <input
                          type="text"
                          placeholder="Street, Barangay, City, Postal Code"
                          value={form.streetAddress}
                          onChange={(e) => setForm({ ...form, streetAddress: e.target.value })}
                        />
                      </label>
                    </div>
                  </>
                )}

                {form.type === 'monetary' ? (
                  <>
                    {/* Payment Method Selector & Information */}
                    <div className="payment-methods-container">
                      <div className="payment-methods-title">
                        Please Choose your Preferred Payment Method :
                      </div>

                      {/* Payment Method Tabs */}
                      <div className="payment-methods-tabs" role="tablist">
                        {PAYMENT_METHODS.map((method) => {
                          const isActive = form.paymentMethod === method.id
                          return (
                            <button
                              key={method.id}
                              type="button"
                              role="tab"
                              aria-selected={isActive}
                              className={`payment-method-tab ${isActive ? 'payment-method-tab--active' : ''}`}
                              onClick={() => setForm({ ...form, paymentMethod: method.id })}
                            >
                              {method.label}
                            </button>
                          )
                        })}
                      </div>

                      {/* Payment Instructions & Details */}
                      {form.paymentMethod === 'bank-transfer' && (
                        <div className="payment-info-box">
                          <div className="payment-info-box__header">
                            <div className="payment-info-box__title">
                              <Landmark size={18} style={{ color: '#AF101A' }} />
                              Bank of The Philippine Islands (BPI)
                            </div>
                          </div>

                          <ol className="payment-step-list">
                            <li>Open your banking app, online banking, or visit any BPI branch.</li>
                            <li>Transfer or deposit your donation using the account details below.</li>
                            <li>Take a screenshot or photo of your transfer confirmation or deposit slip.</li>
                            <li>Enter your donation amount below and upload the proof file.</li>
                          </ol>

                          <div className="payment-bank-details">
                            <div className="payment-detail-item">
                              <span className="payment-detail-label">Bank</span>
                              <div className="payment-detail-value-wrap">
                                <span className="payment-detail-value">Bank of The Philippine Islands</span>
                              </div>
                            </div>

                            <div className="payment-detail-item">
                              <span className="payment-detail-label">Account Name</span>
                              <div className="payment-detail-value-wrap">
                                <span className="payment-detail-value">Rise Above Foundation Cebu, Inc.</span>
                                <button
                                  type="button"
                                  className={`copy-button ${copiedKey === 'bank-name' ? 'copy-button--copied' : ''}`}
                                  onClick={() => handleCopy('Rise Above Foundation Cebu, Inc.', 'bank-name')}
                                >
                                  {copiedKey === 'bank-name' ? <Check size={12} /> : <Copy size={12} />}
                                  {copiedKey === 'bank-name' ? 'Copied' : 'Copy'}
                                </button>
                              </div>
                            </div>

                            <div className="payment-detail-item">
                              <span className="payment-detail-label">Account Number</span>
                              <div className="payment-detail-value-wrap">
                                <span className="payment-detail-value" style={{ fontFamily: 'monospace', letterSpacing: '0.04em' }}>9131005064</span>
                                <button
                                  type="button"
                                  className={`copy-button ${copiedKey === 'bank-acc' ? 'copy-button--copied' : ''}`}
                                  onClick={() => handleCopy('9131005064', 'bank-acc')}
                                >
                                  {copiedKey === 'bank-acc' ? <Check size={12} /> : <Copy size={12} />}
                                  {copiedKey === 'bank-acc' ? 'Copied' : 'Copy'}
                                </button>
                              </div>
                            </div>

                            <div className="payment-detail-item">
                              <span className="payment-detail-label">SWIFT Code</span>
                              <div className="payment-detail-value-wrap">
                                <span className="payment-detail-value" style={{ fontFamily: 'monospace' }}>BOPIPHMM</span>
                                <button
                                  type="button"
                                  className={`copy-button ${copiedKey === 'bank-swift' ? 'copy-button--copied' : ''}`}
                                  onClick={() => handleCopy('BOPIPHMM', 'bank-swift')}
                                >
                                  {copiedKey === 'bank-swift' ? <Check size={12} /> : <Copy size={12} />}
                                  {copiedKey === 'bank-swift' ? 'Copied' : 'Copy'}
                                </button>
                              </div>
                            </div>

                            <div className="payment-detail-item payment-bank-details--full">
                              <span className="payment-detail-label">Bank Address</span>
                              <div className="payment-detail-value-wrap">
                                <span className="payment-detail-value" style={{ fontSize: '0.86rem', fontWeight: 500 }}>
                                  <strong>BPI Cebu North Reclamation</strong> — BPI Building, Juan Luna Ave. corner J. De Veyra St., North Reclamation Area, Cebu City 6000
                                </span>
                                <button
                                  type="button"
                                  className={`copy-button ${copiedKey === 'bank-addr' ? 'copy-button--copied' : ''}`}
                                  onClick={() => handleCopy('BPI Cebu North Reclamation, BPI Building, Juan Luna Ave. corner J. De Veyra St., North Reclamation Area, Cebu City 6000', 'bank-addr')}
                                >
                                  {copiedKey === 'bank-addr' ? <Check size={12} /> : <Copy size={12} />}
                                  {copiedKey === 'bank-addr' ? 'Copied' : 'Copy'}
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="payment-note-banner">
                            <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                            <span>We accept transfers from BPI Online, InstaPay, PESONet, or local &amp; international bank wire.</span>
                          </div>
                        </div>
                      )}

                      {form.paymentMethod === 'gcash' && (
                        <div className="payment-info-box">
                          <div className="payment-info-box__header">
                            <div className="payment-info-box__title">
                              <QrCode size={18} style={{ color: '#007DFE' }} />
                              GCash Philippines (Scan to Pay)
                            </div>
                          </div>

                          <ol className="payment-step-list">
                            <li>1. Open your GCash App</li>
                            <li>2. Choose <strong>Pay QR</strong> (or Scan QR)</li>
                            <li>3. Select <strong>Scan QR</strong> using the code below</li>
                            <li>4. Scan the code and input the desired amount to donate</li>
                            <li>5. Click <strong>Next</strong> and Select <strong>Pay</strong></li>
                            <li>6. Take a screenshot of the completed transaction receipt</li>
                          </ol>

                          <div className="payment-qr-card">
                            <div className="payment-qr-card__title">Rise Above Foundation Cebu Inc</div>
                            <img
                              src={gcashQrImg}
                              alt="GCash QR Code - Rise Above Foundation Cebu Inc"
                              className="payment-qr-card__img"
                            />
                            <div className="payment-qr-card__footer">Scan to Pay</div>
                          </div>

                          <div className="payment-note-banner">
                            <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                            <span>After sending via GCash, please upload your transaction screenshot below as proof of donation.</span>
                          </div>
                        </div>
                      )}

                      {form.paymentMethod === 'paypal' && (
                        <div className="payment-info-box">
                          <div className="payment-info-box__header">
                            <div className="payment-info-box__title">
                              <Globe size={18} style={{ color: '#003087' }} />
                              PayPal International Donation
                            </div>
                          </div>

                          <ol className="payment-step-list">
                            <li>Log in to your PayPal account.</li>
                            <li>Send your donation to our official recipient address below.</li>
                            <li>Save or screenshot your PayPal confirmation receipt.</li>
                            <li>Enter the amount in PHP and attach your proof below.</li>
                          </ol>

                          <div className="payment-bank-details">
                            <div className="payment-detail-item">
                              <span className="payment-detail-label">Beneficiary</span>
                              <div className="payment-detail-value-wrap">
                                <span className="payment-detail-value">Rise Above Foundation Cebu, Inc.</span>
                              </div>
                            </div>

                            <div className="payment-detail-item">
                              <span className="payment-detail-label">PayPal Email</span>
                              <div className="payment-detail-value-wrap">
                                <span className="payment-detail-value">info@riseabove-cebu.org</span>
                                <button
                                  type="button"
                                  className={`copy-button ${copiedKey === 'paypal-email' ? 'copy-button--copied' : ''}`}
                                  onClick={() => handleCopy('info@riseabove-cebu.org', 'paypal-email')}
                                >
                                  {copiedKey === 'paypal-email' ? <Check size={12} /> : <Copy size={12} />}
                                  {copiedKey === 'paypal-email' ? 'Copied' : 'Copy'}
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="payment-note-banner">
                            <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                            <span>PayPal donations from all countries and currencies are converted and supported.</span>
                          </div>
                        </div>
                      )}

                      {form.paymentMethod === 'crypto' && (
                        <div className="payment-info-box">
                          <div className="payment-info-box__header">
                            <div className="payment-info-box__title">
                              <Wallet size={18} style={{ color: '#f59e0b' }} />
                              Cryptocurrency Donation
                            </div>
                          </div>

                          <ol className="payment-step-list">
                            <li>We accept donations in <strong>Bitcoin (BTC)</strong>, <strong>Ethereum (ETH)</strong>, and <strong>USDT</strong>.</li>
                            <li>Send your donation to the official foundation wallet or email us for transfer confirmation.</li>
                            <li>Copy your transaction ID (TxHash) or take a screenshot of the completed transfer.</li>
                            <li>Enter the estimated PHP value and upload the screenshot proof below.</li>
                          </ol>

                          <div className="payment-bank-details">
                            <div className="payment-detail-item payment-bank-details--full">
                              <span className="payment-detail-label">Crypto Support Contact</span>
                              <div className="payment-detail-value-wrap">
                                <span className="payment-detail-value">info@riseabove-cebu.org</span>
                                <button
                                  type="button"
                                  className={`copy-button ${copiedKey === 'crypto-email' ? 'copy-button--copied' : ''}`}
                                  onClick={() => handleCopy('info@riseabove-cebu.org', 'crypto-email')}
                                >
                                  {copiedKey === 'crypto-email' ? <Check size={12} /> : <Copy size={12} />}
                                  {copiedKey === 'crypto-email' ? 'Copied' : 'Copy'}
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="payment-note-banner">
                            <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                            <span>Please double-check the network and address before confirming your cryptocurrency transaction.</span>
                          </div>
                        </div>
                      )}

                      {form.paymentMethod === 'check' && (
                        <div className="payment-info-box">
                          <div className="payment-info-box__header">
                            <div className="payment-info-box__title">
                              <FileText size={18} style={{ color: '#0f766e' }} />
                              Check Donation
                            </div>
                          </div>

                          <ol className="payment-step-list">
                            <li>Make checks payable to: <strong>Rise Above Foundation Cebu, Inc.</strong></li>
                            <li>Deposit the check at any BPI branch to account <code>9131005064</code> or mail to our Cebu office.</li>
                            <li>Take a clear photo or scan of the deposited check / deposit machine receipt.</li>
                            <li>Upload the photo as proof below for verification and official receipting.</li>
                          </ol>

                          <div className="payment-bank-details">
                            <div className="payment-detail-item">
                              <span className="payment-detail-label">Payee Name</span>
                              <div className="payment-detail-value-wrap">
                                <span className="payment-detail-value">Rise Above Foundation Cebu, Inc.</span>
                                <button
                                  type="button"
                                  className={`copy-button ${copiedKey === 'check-payee' ? 'copy-button--copied' : ''}`}
                                  onClick={() => handleCopy('Rise Above Foundation Cebu, Inc.', 'check-payee')}
                                >
                                  {copiedKey === 'check-payee' ? <Check size={12} /> : <Copy size={12} />}
                                  {copiedKey === 'check-payee' ? 'Copied' : 'Copy'}
                                </button>
                              </div>
                            </div>

                            <div className="payment-detail-item">
                              <span className="payment-detail-label">Mailing Address</span>
                              <div className="payment-detail-value-wrap">
                                <span className="payment-detail-value" style={{ fontSize: '0.85rem' }}>
                                  BPI Building, Juan Luna Ave. cor. J. De Veyra St., NRA, Cebu City 6000
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {form.paymentMethod === 'usa' && (
                        <div className="payment-info-box">
                          <div className="payment-info-box__header">
                            <div className="payment-info-box__title">
                              <ShieldCheck size={18} style={{ color: '#0284c7' }} />
                              United States (501(c)(3) Tax-Deductible)
                            </div>
                          </div>

                          <ol className="payment-step-list">
                            <li>Donors from the United States can give through our US 501(c)(3) partner organization.</li>
                            <li>Transfer funds via US wire, check, or partner online channel.</li>
                            <li>Save your US donation confirmation receipt.</li>
                            <li>Upload the receipt proof below to receive your tracking code and Philippine foundation certificate.</li>
                          </ol>

                          <div className="payment-bank-details">
                            <div className="payment-detail-item payment-bank-details--full">
                              <span className="payment-detail-label">US Inquiries &amp; Partner Details</span>
                              <div className="payment-detail-value-wrap">
                                <span className="payment-detail-value">info@riseabove-cebu.org</span>
                                <button
                                  type="button"
                                  className={`copy-button ${copiedKey === 'usa-email' ? 'copy-button--copied' : ''}`}
                                  onClick={() => handleCopy('info@riseabove-cebu.org', 'usa-email')}
                                >
                                  {copiedKey === 'usa-email' ? <Check size={12} /> : <Copy size={12} />}
                                  {copiedKey === 'usa-email' ? 'Copied' : 'Copy'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {form.paymentMethod === 'canada' && (
                        <div className="payment-info-box">
                          <div className="payment-info-box__header">
                            <div className="payment-info-box__title">
                              <ShieldCheck size={18} style={{ color: '#dc2626' }} />
                              Canada (Tax-Deductible Charitable Giving)
                            </div>
                          </div>

                          <ol className="payment-step-list">
                            <li>Canadian donors can give via our Canadian partner charity (e.g. Developing World Connections).</li>
                            <li>Complete your transfer or check through the Canadian registered partner.</li>
                            <li>Save the Canadian contribution receipt.</li>
                            <li>Upload your receipt below for tracking, inventory, and official acknowledgment.</li>
                          </ol>

                          <div className="payment-bank-details">
                            <div className="payment-detail-item payment-bank-details--full">
                              <span className="payment-detail-label">Canada Partner Inquiries</span>
                              <div className="payment-detail-value-wrap">
                                <span className="payment-detail-value">info@riseabove-cebu.org</span>
                                <button
                                  type="button"
                                  className={`copy-button ${copiedKey === 'canada-email' ? 'copy-button--copied' : ''}`}
                                  onClick={() => handleCopy('info@riseabove-cebu.org', 'canada-email')}
                                >
                                  {copiedKey === 'canada-email' ? <Check size={12} /> : <Copy size={12} />}
                                  {copiedKey === 'canada-email' ? 'Copied' : 'Copy'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <label>
                      <Req required>Donation Amount (PHP)</Req>
                      <input
                        type="number"
                        min="1"
                        required
                        placeholder="500"
                        value={form.amount}
                        onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      />
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
                  <span className="field-hint">
                    {form.type === 'monetary'
                      ? 'Upload bank transfer receipt, deposit slip, GCash screenshot, or check photo — JPG, PNG, or PDF'
                      : 'Receipt, packing list, or item photos — JPG, PNG, or PDF'}
                  </span>
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
        </div>
      </section>
    </div>
  )
}

