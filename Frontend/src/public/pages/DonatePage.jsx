import { useState, useMemo, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { 
  Building2, User, MapPin, CreditCard, Copy, Check, QrCode, 
  Landmark, Wallet, Globe, ShieldCheck, Info, FileText,
  Edit3, HeartHandshake, AlertCircle, RefreshCw, CheckCircle2,
  Package, LogIn
} from 'lucide-react'
import { submitPublicDonation, getDonorProfile, paymentMethodsApi } from '../../api/resources'
import { useAuth } from '../../context/AuthContext'
import { DONOR_TYPES } from '../../constants/options'
import { COUNTRIES, getRegionsForCountry } from '../../constants/locations'
import Req from '../../components/shared/Req'
import NameFields from '../../components/shared/NameFields'
import PolicyLinks from '../../components/shared/PolicyLinks'
import { emptyNameParts, formatFullName, parseFullName } from '../../utils/personName'
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

function getMethodIcon(code, category) {
  const c = String(code || '').toLowerCase()
  const cat = String(category || '').toLowerCase()
  if (c.includes('bank') || cat.includes('bank')) return Landmark
  if (c.includes('gcash') || c.includes('maya') || cat.includes('wallet')) return QrCode
  if (c.includes('paypal') || cat.includes('online')) return Globe
  if (c.includes('crypto')) return Wallet
  if (c.includes('check')) return FileText
  return CreditCard
}

function parseInstructions(val) {
  if (!val) return []
  if (Array.isArray(val)) {
    return val.map((line) => String(line).trim()).filter(Boolean)
  }
  if (typeof val === 'string') {
    return val
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  }
  return []
}

function parseExtraDetails(val) {
  if (!val) return []
  if (Array.isArray(val)) {
    return val.map((item, idx) => {
      if (typeof item === 'object' && item !== null) {
        const label = item.label || item.key || `Detail ${idx + 1}`
        const value = item.value ?? item.val ?? ''
        const isCode = String(label).toLowerCase().includes('swift') || String(label).toLowerCase().includes('iban') || String(label).toLowerCase().includes('code')
        const fullWidth = String(value).length > 35 || String(label).toLowerCase().includes('address')
        return { label: String(label), value: String(value), isCode, fullWidth }
      }
      const line = String(item).trim()
      const colonIdx = line.indexOf(':')
      if (colonIdx > 0 && colonIdx < 35) {
        const label = line.slice(0, colonIdx).trim()
        const value = line.slice(colonIdx + 1).trim()
        const isCode = label.toLowerCase().includes('swift') || label.toLowerCase().includes('iban') || label.toLowerCase().includes('code')
        const fullWidth = value.length > 35 || label.toLowerCase().includes('address')
        return { label, value, isCode, fullWidth }
      }
      return { label: 'Details', value: line, isCode: false, fullWidth: line.length > 35 }
    })
  }
  if (typeof val === 'object' && val !== null) {
    return Object.entries(val).map(([k, v]) => {
      const label = k.replace(/_/g, ' ')
      const value = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '')
      const isCode = k.toLowerCase().includes('swift') || k.toLowerCase().includes('iban') || k.toLowerCase().includes('code')
      const fullWidth = value.length > 35 || k.toLowerCase().includes('address')
      return { label, value, isCode, fullWidth }
    })
  }
  if (typeof val === 'string') {
    return val
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const colonIdx = line.indexOf(':')
        if (colonIdx > 0 && colonIdx < 35) {
          const label = line.slice(0, colonIdx).trim()
          const value = line.slice(colonIdx + 1).trim()
          const isCode = label.toLowerCase().includes('swift') || label.toLowerCase().includes('iban') || label.toLowerCase().includes('code')
          const fullWidth = value.length > 35 || label.toLowerCase().includes('address')
          return { label, value, isCode, fullWidth }
        }
        return { label: 'Details', value: line, isCode: false, fullWidth: line.length > 35 }
      })
  }
  return []
}

const FALLBACK_PAYMENT_METHODS = [
  {
    id: 1,
    code: 'gcash',
    name: 'GCash Philippines',
    category: 'E-Wallet',
    instructions: '1. Open your GCash App\n2. Choose Pay QR (or Scan QR)\n3. Select Scan QR using the code below\n4. Scan the code and input the desired amount to donate\n5. Click Next and Select Pay\n6. Take a screenshot of the completed transaction receipt',
    accountName: 'Rise Above Foundation Cebu Inc',
    accountNumber: '',
    notes: 'After sending via GCash, please upload your transaction screenshot below as proof of donation.',
    qrUrl: gcashQrImg,
  },
  {
    id: 2,
    code: 'bank-transfer',
    name: 'Bank Transfer (BPI)',
    category: 'Bank Transfer',
    instructions: '1. Open your banking app, online banking, or visit any BPI branch.\n2. Transfer or deposit your donation using the account details below.\n3. Take a screenshot or photo of your transfer confirmation or deposit slip.\n4. Enter your donation amount below and upload the proof file.',
    bankName: 'Bank of The Philippine Islands',
    accountName: 'Rise Above Foundation Cebu, Inc.',
    accountNumber: '9131005064',
    notes: 'We accept transfers from BPI Online, InstaPay, PESONet, or local & international bank wire.',
    extraDetails: 'SWIFT Code: BOPIPHMM\nBank Address: BPI Cebu North Reclamation, BPI Building, Juan Luna Ave. corner J. De Veyra St., North Reclamation Area, Cebu City 6000',
  },
  {
    id: 3,
    code: 'maya',
    name: 'Maya',
    category: 'E-Wallet',
    instructions: '1. Open your Maya app\n2. Tap Scan to Pay\n3. Scan our official Maya QR code or enter account details\n4. Confirm amount and complete the transaction\n5. Save transaction receipt and upload below',
    accountName: 'Rise Above Foundation Cebu Inc',
    notes: 'Maya transfers are promptly verified once transaction proof is uploaded.',
  },
  {
    id: 4,
    code: 'paypal',
    name: 'PayPal',
    category: 'Online Payment',
    instructions: '1. Log in to your PayPal account.\n2. Send your donation to our official recipient address below.\n3. Save or screenshot your PayPal confirmation receipt.\n4. Enter the amount in PHP and attach your proof below.',
    accountName: 'Rise Above Foundation Cebu, Inc.',
    accountNumber: 'info@riseabove-cebu.org',
    notes: 'PayPal donations from all countries and currencies are converted and supported.',
  },
  {
    id: 5,
    code: 'check',
    name: 'Check Donation',
    category: 'Check',
    instructions: '1. Make checks payable to: Rise Above Foundation Cebu, Inc.\n2. Deposit the check at any BPI branch to account 9131005064 or mail to our Cebu office.\n3. Take a clear photo or scan of the deposited check / deposit machine receipt.\n4. Upload the photo as proof below for verification and official receipting.',
    accountName: 'Rise Above Foundation Cebu, Inc.',
    accountNumber: '9131005064',
    extraDetails: 'Mailing Address: BPI Building, Juan Luna Ave. corner J. De Veyra St., North Reclamation Area, Cebu City 6000',
  },
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
  paymentMethod: 'gcash',
  paymentReference: '',
  proof: null,
  message: '',
  acceptedPolicies: false,
}

export default function DonatePage() {
  const { user, isAuthenticated } = useAuth()
  const isLoggedInDonor = Boolean(isAuthenticated && user?.role === 'Donor')

  const [submitted, setSubmitted] = useState(false)
  const { showLoading, hideLoading } = useLoading()
  const [trackingCode, setTrackingCode] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [copiedKey, setCopiedKey] = useState('')
  const [paymentMethods, setPaymentMethods] = useState(FALLBACK_PAYMENT_METHODS)
  const [methodsLoading, setMethodsLoading] = useState(true)

  const [donorProfile, setDonorProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')

  const loadProfile = useCallback(async () => {
    if (!isLoggedInDonor) return
    setProfileLoading(true)
    setProfileError('')
    try {
      const res = await getDonorProfile()
      if (res?.data) {
        const p = res.data
        setDonorProfile(p)
        const nameParts = (p.firstName || p.lastName)
          ? { firstName: p.firstName || '', lastName: p.lastName || '', middleInitial: p.middleInitial || '' }
          : parseFullName(p.fullName || user?.name || '')

        setForm((prev) => ({
          ...prev,
          donorType: p.donorType || 'Individual',
          organization: p.organization || '',
          nameParts,
          email: p.email || user?.email || '',
          phone: p.phone || user?.phone || '',
          country: p.country || 'Philippines',
          streetAddress: p.address || '',
          address: p.address || '',
          acceptedPolicies: true,
        }))
      }
    } catch (err) {
      setProfileError(err.message || 'Failed to load your donor profile. Please retry.')
    } finally {
      setProfileLoading(false)
    }
  }, [isLoggedInDonor, user?.name, user?.email, user?.phone])

  useEffect(() => {
    if (isLoggedInDonor) {
      loadProfile()
    }
  }, [isLoggedInDonor, loadProfile])

  useEffect(() => {
    let active = true
    const loadPaymentMethods = async () => {
      try {
        const res = await paymentMethodsApi.listPublic()
        if (active && Array.isArray(res?.data) && res.data.length > 0) {
          setPaymentMethods(res.data)
          setForm((prev) => {
            const exists = res.data.some(
              (m) => (m.code || String(m.id)) === prev.paymentMethod || m.name === prev.paymentMethod
            )
            return {
              ...prev,
              paymentMethod: exists ? prev.paymentMethod : (res.data[0].code || String(res.data[0].id)),
            }
          })
        }
      } catch (err) {
        console.warn('Could not load dynamic payment methods from CMS, falling back:', err)
      } finally {
        if (active) setMethodsLoading(false)
      }
    }
    loadPaymentMethods()
    return () => {
      active = false
    }
  }, [])

  const selectedMethod = useMemo(() => {
    if (!paymentMethods.length) return null
    return (
      paymentMethods.find((m) => (m.code || String(m.id)) === form.paymentMethod || m.name === form.paymentMethod) ||
      paymentMethods[0]
    )
  }, [paymentMethods, form.paymentMethod])

  const resetForm = () => {
    if (isLoggedInDonor && donorProfile) {
      const nameParts = (donorProfile.firstName || donorProfile.lastName)
        ? { firstName: donorProfile.firstName || '', lastName: donorProfile.lastName || '', middleInitial: donorProfile.middleInitial || '' }
        : parseFullName(donorProfile.fullName || user?.name || '')
      setForm({
        ...emptyForm,
        donorType: donorProfile.donorType || 'Individual',
        organization: donorProfile.organization || '',
        nameParts,
        email: donorProfile.email || user?.email || '',
        phone: donorProfile.phone || user?.phone || '',
        country: donorProfile.country || 'Philippines',
        streetAddress: donorProfile.address || '',
        address: donorProfile.address || '',
        acceptedPolicies: true,
      })
    } else {
      setForm(emptyForm)
    }
  }

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

    if (isLoggedInDonor && profileError) {
      setSubmitError('Unable to proceed: could not load your donor profile. Please click Retry.')
      return
    }

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
    if (form.type === 'monetary') {
      if (!(Number(form.amount) > 0)) {
        setSubmitError('Monetary amount must be greater than 0.')
        return
      }
      if (selectedMethod?.requiresReference && !form.paymentReference?.trim()) {
        setSubmitError(`Payment reference number is required for ${selectedMethod.name}.`)
        return
      }
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
      if (form.address || composedAddress || form.streetAddress) {
        fd.append('address', form.address || composedAddress || form.streetAddress.trim())
      }
      fd.append('acceptedPolicies', '1')
      fd.append('type', form.type === 'in-kind' ? 'In-Kind' : 'Monetary')
      if (form.type === 'monetary') {
        fd.append('amount', String(form.amount))
        fd.append('paymentMethod', selectedMethod ? selectedMethod.name : form.paymentMethod)
        if (form.paymentReference?.trim()) {
          fd.append('paymentReference', form.paymentReference.trim())
        }
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
      resetForm()
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

          <div className="form-card donation-details-card">
            <div className="donation-details-header">
              <div className="donation-details-header__eyebrow">
                <HeartHandshake size={13} />
                <span>Donation Process · Step 1</span>
              </div>
              <h2 className="donation-details-header__title">Donation Details</h2>
              <p className="donation-details-header__subtitle">
                {isLoggedInDonor
                  ? 'Your verified donor profile is securely linked. Choose your donation type to continue.'
                  : 'Complete your donor details and select how you wish to make an impact today.'}
              </p>
            </div>

            {submitError && <div className="error-banner" style={{ marginBottom: '1.5rem' }}>{submitError}</div>}
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
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1.5rem' }}>
                  <button
                    type="button"
                    className="btn btn--outline"
                    onClick={() => {
                      resetForm()
                      setSubmitted(false)
                    }}
                  >
                    Submit Another Donation
                  </button>
                  {isLoggedInDonor && (
                    <Link to="/donor/donations" className="btn btn--primary">
                      View in My Donations &rarr;
                    </Link>
                  )}
                </div>

                {!isLoggedInDonor && (
                  <div style={{
                    marginTop: '2rem',
                    padding: '1.25rem 1.5rem',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    textAlign: 'center',
                  }}>
                    <h4 style={{ margin: '0 0 0.35rem', fontSize: '1rem', color: '#1e293b', fontWeight: 700 }}>
                      Want faster donations next time?
                    </h4>
                    <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#64748b' }}>
                      Create a Donor Account to save your details for one-click future donations and monitor your contribution history.
                    </p>
                    <Link to="/contact" className="btn btn--primary btn--sm">
                      Create a Donor Account
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {isLoggedInDonor ? (
                  <div style={{ marginBottom: '1.5rem' }}>
                    {profileLoading ? (
                      <div style={{
                        padding: '1.25rem',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        background: '#f8fafc',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        color: '#64748b',
                        fontSize: '0.9rem',
                      }}>
                        <div className="spinner" style={{ width: 18, height: 18 }} />
                        <span>Loading your verified donor profile…</span>
                      </div>
                    ) : profileError ? (
                      <div className="error-banner" style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.75rem',
                        padding: '1rem 1.25rem',
                        borderRadius: '10px',
                        marginBottom: '1rem',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <AlertCircle size={18} />
                          <span>{profileError}</span>
                        </div>
                        <button type="button" className="btn btn--sm btn--outline" onClick={loadProfile}>
                          <RefreshCw size={14} /> Retry
                        </button>
                      </div>
                    ) : (
                      <div className="donor-profile-summary-card">
                        <div className="donor-profile-summary-card__header">
                          <div className="donor-profile-summary-card__badge">
                            <CheckCircle2 className="donor-profile-summary-card__badge-icon" />
                            <span>
                              {form.donorType === 'Company' ? 'VERIFIED COMPANY PROFILE' : 'VERIFIED DONOR PROFILE'}
                            </span>
                          </div>

                          <Link
                            to="/donor/settings"
                            className="donor-profile-summary-card__edit-btn"
                            title="Update your donor details in settings"
                          >
                            <Edit3 size={13} /> Edit Profile
                          </Link>
                        </div>

                        <div className="donor-profile-summary-card__identity">
                          <h3 className="donor-profile-summary-card__name">
                            {form.donorType === 'Company' ? (
                              <>
                                <Building2 size={20} style={{ color: 'var(--color-brand, #AF101A)', flexShrink: 0 }} />
                                <span>{form.organization || formatFullName(form.nameParts)}</span>
                                <span className="donor-profile-summary-card__company-badge">Organization</span>
                              </>
                            ) : (
                              <>
                                <User size={20} style={{ color: 'var(--color-brand, #AF101A)', flexShrink: 0 }} />
                                <span>{formatFullName(form.nameParts) || user?.name || 'Registered Donor'}</span>
                              </>
                            )}
                          </h3>
                        </div>

                        <div className="donor-profile-summary-card__grid">
                          {form.donorType === 'Company' && (
                            <div className="donor-profile-summary-card__field">
                              <span className="donor-profile-summary-card__label">Contact Person</span>
                              <span className="donor-profile-summary-card__value">{formatFullName(form.nameParts) || '—'}</span>
                            </div>
                          )}
                          <div className="donor-profile-summary-card__field">
                            <span className="donor-profile-summary-card__label">Email</span>
                            <span className="donor-profile-summary-card__value">{form.email || '—'}</span>
                          </div>
                          <div className="donor-profile-summary-card__field">
                            <span className="donor-profile-summary-card__label">Phone</span>
                            <span className="donor-profile-summary-card__value">{form.phone || '—'}</span>
                          </div>
                          <div className="donor-profile-summary-card__field">
                            <span className="donor-profile-summary-card__label">Address</span>
                            <span className="donor-profile-summary-card__value">
                              {[form.streetAddress || form.address, form.country].filter(Boolean).join(', ') || '—'}
                            </span>
                          </div>
                        </div>

                        <div className="donor-profile-summary-card__notice">
                          <ShieldCheck size={14} style={{ color: '#16a34a', flexShrink: 0 }} />
                          <span>This verified profile information is automatically used. Click Edit Profile to update in settings.</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{
                    marginBottom: '1.5rem',
                    padding: '0.85rem 1.15rem',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    fontSize: '0.875rem',
                  }}>
                    <span style={{ color: '#475569' }}>
                      Already have an account? Log in to use your saved verified profile.
                    </span>
                    <Link to="/login" className="btn btn--sm btn--outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <LogIn size={13} /> Log In
                    </Link>
                  </div>
                )}

                {/* Section Separator */}
                <div className="donation-section-divider">
                  <div className="donation-section-divider__line" />
                  <span className="donation-section-divider__text">Donation Type</span>
                  <div className="donation-section-divider__line" />
                </div>

                {/* Donation Type Selectable Cards */}
                <div className="donation-type-section">
                  <label className="donation-type-section__legend">
                    <Req required>Donation Type</Req>
                  </label>
                  <div className="donation-type-grid" role="radiogroup" aria-label="Donation Type">
                    {donationTypes.map((dt) => {
                      const isSelected = form.type === dt.id
                      const isMonetary = dt.id === 'monetary'
                      return (
                        <label
                          key={dt.id}
                          className={`donation-type-card ${isSelected ? 'donation-type-card--selected' : ''}`}
                        >
                          <input
                            type="radio"
                            name="donationType"
                            value={dt.id}
                            checked={isSelected}
                            onChange={() => setForm({ ...form, type: dt.id })}
                          />
                          <div className="donation-type-card__radio-circle" aria-hidden="true">
                            <div className="donation-type-card__radio-dot" />
                          </div>
                          <div className="donation-type-card__icon-wrap" aria-hidden="true">
                            {isMonetary ? <Wallet size={20} /> : <Package size={20} />}
                          </div>
                          <div className="donation-type-card__content">
                            <span className="donation-type-card__title">{dt.label}</span>
                            <span className="donation-type-card__desc">
                              {isMonetary
                                ? 'Monetary support via Bank Transfer, GCash, PayPal, Crypto, or Check.'
                                : 'Material goods, food packs, medicine, clothing, or relief supplies.'}
                            </span>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {!isLoggedInDonor && (
                  <>
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
                  </>
                )}

                {form.type === 'monetary' ? (
                  <>
                    {/* Payment Method Selector & Dynamic Information */}
                    <div className="payment-methods-container">
                      <div className="payment-methods-title">
                        Please Choose your Preferred Payment Method :
                      </div>

                      {/* Payment Method Tabs */}
                      <div className="payment-methods-tabs" role="tablist">
                        {paymentMethods.map((method) => {
                          const methodKey = method.code || String(method.id)
                          const isActive = form.paymentMethod === methodKey || form.paymentMethod === method.name
                          const MethodTabIcon = getMethodIcon(method.code, method.category)
                          return (
                            <button
                              key={method.id || method.code}
                              type="button"
                              role="tab"
                              aria-selected={isActive}
                              className={`payment-method-tab ${isActive ? 'payment-method-tab--active' : ''}`}
                              onClick={() => setForm({ ...form, paymentMethod: methodKey })}
                            >
                              <MethodTabIcon size={15} style={{ marginRight: '0.35rem', verticalAlign: 'text-bottom' }} />
                              {method.name}
                            </button>
                          )
                        })}
                      </div>

                      {/* Dynamic Payment Instructions & Account Details */}
                      {selectedMethod && (() => {
                        const MethodHeaderIcon = getMethodIcon(selectedMethod.code, selectedMethod.category)
                        const steps = parseInstructions(selectedMethod.instructions)
                        const extraFields = parseExtraDetails(selectedMethod.extraDetails)
                        const qrSrc = selectedMethod.qrUrl || (selectedMethod.code === 'gcash' ? gcashQrImg : '')

                        return (
                          <div className="payment-info-box">
                            <div className="payment-info-box__header">
                              <div className="payment-info-box__title">
                                <MethodHeaderIcon size={18} style={{ color: '#AF101A' }} />
                                {selectedMethod.name}
                              </div>
                              {selectedMethod.category && (
                                <span
                                  className="payment-category-badge"
                                  style={{
                                    fontSize: '0.78rem',
                                    padding: '0.2rem 0.6rem',
                                    background: '#fef2f2',
                                    border: '1px solid #fecaca',
                                    borderRadius: '4px',
                                    color: '#991b1b',
                                    fontWeight: 600,
                                  }}
                                >
                                  {selectedMethod.category}
                                </span>
                              )}
                            </div>

                            {/* Step-by-Step Instructions */}
                            {steps.length > 0 && (
                              <ol className="payment-step-list">
                                {steps.map((step, idx) => (
                                  <li key={idx}>{step}</li>
                                ))}
                              </ol>
                            )}

                            {/* Account & Details Box */}
                            {(selectedMethod.bankName || selectedMethod.accountName || selectedMethod.accountNumber || extraFields.length > 0) && (
                              <div className="payment-bank-details">
                                {selectedMethod.bankName && (
                                  <div className="payment-detail-item">
                                    <span className="payment-detail-label">Bank</span>
                                    <div className="payment-detail-value-wrap">
                                      <span className="payment-detail-value">{selectedMethod.bankName}</span>
                                      <button
                                        type="button"
                                        className={`copy-button ${copiedKey === 'bank-name' ? 'copy-button--copied' : ''}`}
                                        onClick={() => handleCopy(selectedMethod.bankName, 'bank-name')}
                                      >
                                        {copiedKey === 'bank-name' ? <Check size={12} /> : <Copy size={12} />}
                                        {copiedKey === 'bank-name' ? 'Copied' : 'Copy'}
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {selectedMethod.accountName && (
                                  <div className="payment-detail-item">
                                    <span className="payment-detail-label">Account / Beneficiary</span>
                                    <div className="payment-detail-value-wrap">
                                      <span className="payment-detail-value">{selectedMethod.accountName}</span>
                                      <button
                                        type="button"
                                        className={`copy-button ${copiedKey === 'acc-name' ? 'copy-button--copied' : ''}`}
                                        onClick={() => handleCopy(selectedMethod.accountName, 'acc-name')}
                                      >
                                        {copiedKey === 'acc-name' ? <Check size={12} /> : <Copy size={12} />}
                                        {copiedKey === 'acc-name' ? 'Copied' : 'Copy'}
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {selectedMethod.accountNumber && (
                                  <div className="payment-detail-item">
                                    <span className="payment-detail-label">Account / Mobile / Email</span>
                                    <div className="payment-detail-value-wrap">
                                      <span className="payment-detail-value" style={{ fontFamily: 'monospace', letterSpacing: '0.04em' }}>
                                        {selectedMethod.accountNumber}
                                      </span>
                                      <button
                                        type="button"
                                        className={`copy-button ${copiedKey === 'acc-num' ? 'copy-button--copied' : ''}`}
                                        onClick={() => handleCopy(selectedMethod.accountNumber, 'acc-num')}
                                      >
                                        {copiedKey === 'acc-num' ? <Check size={12} /> : <Copy size={12} />}
                                        {copiedKey === 'acc-num' ? 'Copied' : 'Copy'}
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {extraFields.map((field, fIdx) => (
                                  <div
                                    key={fIdx}
                                    className={`payment-detail-item ${field.fullWidth ? 'payment-bank-details--full' : ''}`}
                                  >
                                    <span className="payment-detail-label">{field.label}</span>
                                    <div className="payment-detail-value-wrap">
                                      <span
                                        className="payment-detail-value"
                                        style={field.isCode ? { fontFamily: 'monospace' } : { fontSize: '0.86rem' }}
                                      >
                                        {field.value}
                                      </span>
                                      <button
                                        type="button"
                                        className={`copy-button ${copiedKey === `extra-${fIdx}` ? 'copy-button--copied' : ''}`}
                                        onClick={() => handleCopy(field.value, `extra-${fIdx}`)}
                                      >
                                        {copiedKey === `extra-${fIdx}` ? <Check size={12} /> : <Copy size={12} />}
                                        {copiedKey === `extra-${fIdx}` ? 'Copied' : 'Copy'}
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* QR Code Card if available */}
                            {qrSrc && (
                              <div className="payment-qr-card">
                                <div className="payment-qr-card__title">{selectedMethod.accountName || selectedMethod.name}</div>
                                <img
                                  src={qrSrc}
                                  alt={`${selectedMethod.name} QR Code`}
                                  className="payment-qr-card__img"
                                />
                                <div className="payment-qr-card__footer">Scan to Pay via {selectedMethod.name}</div>
                              </div>
                            )}

                            {/* Informational Notes */}
                            {selectedMethod.notes && (
                              <div className="payment-note-banner">
                                <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                                <span>{selectedMethod.notes}</span>
                              </div>
                            )}
                          </div>
                        )
                      })()}
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

                    <label>
                      <span>
                        Payment Reference / Transaction No.{' '}
                        {selectedMethod?.requiresReference ? (
                          <Req required />
                        ) : (
                          <span style={{ fontWeight: 'normal', color: '#64748b' }}>(Optional)</span>
                        )}
                      </span>
                      <input
                        type="text"
                        placeholder="e.g. GCash Ref No., Bank Ref / Trace No., or Check No."
                        value={form.paymentReference}
                        onChange={(e) => setForm({ ...form, paymentReference: e.target.value })}
                        required={Boolean(selectedMethod?.requiresReference)}
                      />
                      <span className="field-hint" style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                        Provide the reference or transaction number from your transfer confirmation to help verify your donation faster.
                      </span>
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

