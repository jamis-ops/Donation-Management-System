import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  Eye, Trash2, UserPlus, Building2, User, MapPin, 
  Mail, Phone, Globe, Coins, Heart, Calendar, ShieldAlert, 
  CheckCircle2, FileText, ExternalLink, Sparkles
} from 'lucide-react'
import { donorsApi, donationsApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { useFilters } from '../../hooks/useFilters'
import { DONOR_TYPES } from '../../constants/options'
import { COUNTRIES, getRegionsForCountry } from '../../constants/locations'
import Req from '../../components/shared/Req'
import NameFields from '../../components/shared/NameFields'
import PageHeader from '../components/shared/PageHeader'
import DataTable from '../components/shared/DataTable'
import ApiState from '../components/shared/ApiState'
import FilterBar from '../components/shared/FilterBar'
import ModalHeader from '../components/shared/ModalHeader'
import { useBulkSelection } from '../../hooks/useBulkSelection'
import { emptyNameParts, formatFullName, parseFullName } from '../../utils/personName'
import { notify } from '../../utils/toast'
import { confirmAction, showSuccessModal } from '../../utils/confirm'
import { emailError, phoneError } from '../../utils/validation'
import PhoneInput from '../../components/shared/PhoneInput'
import { useLoading } from '../../context/LoadingContext'

const emptyForm = {
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
  notes: '',
  createAccount: false,
  acceptedTerms: true,
  acceptedPrivacy: true,
  acceptedPolicies: true,
}

const filterConfig = {
  searchKeys: ['id', 'name', 'organization', 'contactPerson', 'email', 'country', 'address', 'donorType'],
  filters: [{ key: 'donorType', label: 'Donor Type' }],
}

function accountResultMessage(res) {
  if (!res?.accountCreated) return 'Donor saved.'
  if (res.credentialsSent) {
    return 'Donor saved. Login credentials were emailed to the donor via NodeMailer.'
  }
  const bits = ['Donor account was created, but the credential email was NOT delivered.']
  if (res.mailError) bits.push(`Reason: ${res.mailError}`)
  if (res.temporaryPassword) {
    bits.push(`Temporary password (share securely): ${res.temporaryPassword}`)
  }
  bits.push('Ensure `npm run mail` is running and mail-service/.env has a valid Gmail App Password. See mail-service/.env.example.')
  return bits.join('\n\n')
}

function toastAccountResult(res) {
  if (!res?.accountCreated) return
  if (res.credentialsSent) {
    notify.success('Donor saved. Login credentials were emailed to the donor.')
    return
  }
  notify.warning(accountResultMessage(res).replace(/\n\n/g, '. '))
}

export default function DonorsPage() {
  const { data: donors, loading, error, reload } = useApiList(() => donorsApi.list())
  const filters = useFilters(donors, filterConfig)
  const bulk = useBulkSelection(
    filters.filtered,
    (id) => donorsApi.remove(id),
    reload,
    'donors',
  )
  const [mode, setMode] = useState(null)
  const { showLoading, hideLoading } = useLoading()
  const [active, setActive] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const { data: allDonations } = useApiList(() => donationsApi.list())

  const isCompany = form.donorType === 'Company'

  const availableRegions = useMemo(() => {
    return getRegionsForCountry(form.country)
  }, [form.country])

  const donorDonations = useMemo(() => {
    if (!active?.email && !active?.name && !active?.fullName) return []
    const email = (active.email || '').toLowerCase().trim()
    const name = (active.fullName || active.name || active.organization || '').toLowerCase().trim()
    return (allDonations || []).filter((d) => {
      if (email && (d.donorEmail || '').toLowerCase().trim() === email) return true
      if (name && (d.donor || d.donorName || '').toLowerCase().trim() === name) return true
      return false
    })
  }, [allDonations, active])

  const openCreate = () => {
    setActive(null)
    setForm(emptyForm)
    setMode('create')
  }

  const openView = (row) => {
    setActive(row)
    setMode('view')
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (isCompany && !form.organization.trim()) {
      notify.warning('Company / Organization Name is required.')
      return
    }
    const emailMsg = emailError(form.email)
    if (emailMsg) {
      notify.warning(emailMsg)
      return
    }
    const phoneMsg = phoneError(form.phone, { required: true, allowInternational: true })
    if (phoneMsg) {
      notify.warning(phoneMsg)
      return
    }
    setSaving(true)
    showLoading('Saving…')
    try {
      const contactPerson = formatFullName(form.nameParts)
      const selectedRegion = form.stateProvince === 'Other' ? form.customRegion.trim() : form.stateProvince.trim()
      const composedAddress = [form.streetAddress.trim(), selectedRegion].filter(Boolean).join(', ')

      const payload = {
        donorType: form.donorType,
        organization: isCompany ? form.organization.trim() : '',
        lastName: form.nameParts.lastName,
        firstName: form.nameParts.firstName,
        middleInitial: form.nameParts.middleInitial,
        contactPerson,
        fullName: isCompany ? (form.organization.trim() || contactPerson) : contactPerson,
        email: form.email.trim(),
        phone: form.phone.trim(),
        country: form.country || 'Philippines',
        address: composedAddress || form.streetAddress.trim() || '',
        notes: form.notes,
        createAccount: form.createAccount,
        acceptedTerms: true,
        acceptedPrivacy: true,
        acceptedPolicies: true,
      }
      const res = await donorsApi.create(payload)
      if (res?.accountCreated) {
        toastAccountResult(res)
        showSuccessModal('Credentials successfully sent.')
      } else {
        notify.success('Donor saved.')
        showSuccessModal('Successfully added.')
      }
      setMode(null)
      setForm(emptyForm)
      reload()
    } catch (err) {
      notify.error(err.message)
    } finally {
      hideLoading()
      setSaving(false)
    }
  }

  const createAccountForExisting = async () => {
    if (!active) return
    const ok = await confirmAction({
      title: 'Create Donor Portal Account',
      message: `Create a portal account for ${active.name} (${active.email}) and email their temporary password?`,
      confirmText: 'Create & Email Credentials',
      type: 'primary',
    })
    if (!ok) return

    setSaving(true)
    showLoading('Saving…')
    try {
      const res = await donorsApi.update(active.dbId, {
        createAccount: true,
        email: active.email,
        acceptedPolicies: true,
      })
      toastAccountResult(res)
      showSuccessModal('Credentials successfully sent.')
      setMode(null)
      reload()
    } catch (err) {
      notify.error(err.message)
    } finally {
      hideLoading()
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    const ok = await confirmAction({
      title: 'Delete Donor',
      message: `Permanently delete donor "${row.name}" and their portal login (if any)? Donation history will be kept but unlinked.`,
      confirmText: 'Delete Donor',
      type: 'danger',
    })
    if (!ok) return

    showLoading('Deleting donor…')
    try {
      await donorsApi.remove(row.dbId)
      notify.success('Donor deleted.')
      showSuccessModal('Successfully deleted.')
      if (mode === 'view' && active?.dbId === row.dbId) setMode(null)
      reload()
    } catch (err) {
      notify.error(err.message)
    } finally {
      hideLoading()
    }
  }

  const columns = [
    { key: 'id', label: 'Donor ID' },
    { key: 'donorType', label: 'Type', render: (row) => row.donorType || 'Individual' },
    { key: 'name', label: 'Name / Company' },
    { key: 'email', label: 'Email' },
    { key: 'country', label: 'Country', render: (row) => row.country || '—' },
    { key: 'address', label: 'Address', render: (row) => row.address || '—' },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions">
          <button type="button" className="icon-btn" title="View" aria-label="View" onClick={(e) => { e.stopPropagation(); openView(row) }}>
            <Eye size={15} />
          </button>
          <button type="button" className="icon-btn icon-btn--danger" title="Delete" aria-label="Delete" onClick={(e) => { e.stopPropagation(); handleDelete(row) }}>
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Donor Management"
        description="Manage individual and organization donors. Create portal accounts and email credentials when needed."
        actions={<button type="button" className="btn btn--primary" onClick={openCreate}>+ Add Donor</button>}
      />
      <FilterBar
        controller={filters}
        searchPlaceholder="Search by ID, company, email, country, or address..."
        exportConfig={{ filename: 'donor-report', title: 'Donor Report', columns, rows: filters.filtered }}
      />
      <ApiState loading={loading} error={error} onRetry={reload}>
        <DataTable
          columns={columns}
          data={filters.filtered}
          onRowClick={openView}
          pageSize={10}
          resetKey={`${filters.search}|${JSON.stringify(filters.values)}`}
          selectable
          selectedIds={bulk.selectedIds}
          onSelectionChange={bulk.setSelectedIds}
          onBulkDelete={bulk.handleBulkDelete}
          deleting={bulk.deleting}
          bulkDeleteLabel="Delete Selected"
        />
      </ApiState>

      {mode === 'view' && active && (
        <div className="admin-modal-overlay" onClick={() => setMode(null)}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title="Donor Profile" onClose={() => setMode(null)} />
            
            <div className="donor-modal-content" style={{ padding: '0.25rem 0' }}>
              {/* Profile Hero Header */}
              <div className="donor-profile-hero">
                <div className="donor-profile-avatar">
                  {active.donorType === 'Company' ? (
                    <Building2 size={30} />
                  ) : (
                    (active.fullName || active.name || 'D').charAt(0).toUpperCase()
                  )}
                </div>
                <div className="donor-profile-main">
                  <h3 className="donor-profile-name">
                    {active.donorType === 'Company'
                      ? (active.organization || active.name || 'Company Donor')
                      : (active.fullName || active.name || 'Individual Donor')}
                  </h3>
                  <div className="donor-profile-pills">
                    <span className="donor-pill donor-pill--id">
                      {active.id}
                    </span>
                    <span className="donor-pill donor-pill--type">
                      {active.donorType || 'Individual'}
                    </span>
                    {active.hasAccount ? (
                      <span className="donor-pill donor-pill--active" title="Portal account active">
                        <CheckCircle2 size={13} /> Portal Account Active
                      </span>
                    ) : (
                      <span className="donor-pill donor-pill--inactive" title="No portal account provisioned">
                        <ShieldAlert size={13} /> No Portal Login
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats Row */}
              <div className="donor-stats-row">
                <Link
                  to={`/admin/donations?tab=monetary&q=${encodeURIComponent(active.name || active.email || '')}`}
                  className="donor-stat-card donor-stat-card--funds donor-stat-card--clickable"
                  title="View monetary donations from this donor"
                >
                  <div className="donor-stat-card__icon">
                    <Coins size={22} />
                  </div>
                  <div className="donor-stat-card__content">
                    <div className="donor-stat-card__value">
                      {active.totalDonated || '₱0.00'}
                    </div>
                    <div className="donor-stat-card__label">Total Contributed</div>
                  </div>
                </Link>

                <Link
                  to={`/admin/donations?q=${encodeURIComponent(active.name || active.email || '')}`}
                  className="donor-stat-card donor-stat-card--count donor-stat-card--clickable"
                  title="View all donations from this donor"
                >
                  <div className="donor-stat-card__icon">
                    <Heart size={22} />
                  </div>
                  <div className="donor-stat-card__content">
                    <div className="donor-stat-card__value">
                      {active.donations || 0}
                    </div>
                    <div className="donor-stat-card__label">Total Donations</div>
                  </div>
                </Link>

                <div className="donor-stat-card donor-stat-card--date">
                  <div className="donor-stat-card__icon">
                    <Calendar size={22} />
                  </div>
                  <div className="donor-stat-card__content">
                    <div className="donor-stat-card__value" style={{ fontSize: '1rem' }}>
                      {active.lastDonation || '—'}
                    </div>
                    <div className="donor-stat-card__label">Latest Contribution</div>
                  </div>
                </div>
              </div>

              {/* 2-Column Info Grid */}
              <div className="donor-info-grid">
                {/* Contact Information */}
                <div className="donor-info-panel">
                  <div className="donor-info-panel__header">
                    <Mail size={16} /> Contact Information
                  </div>
                  <div className="donor-field-list">
                    <div className="donor-field-item">
                      <span className="donor-field-label">Email Address</span>
                      <span className="donor-field-value">
                        {active.email ? (
                          <a href={`mailto:${active.email}`}>{active.email}</a>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No email provided</span>
                        )}
                      </span>
                    </div>

                    <div className="donor-field-item">
                      <span className="donor-field-label">Contact Number</span>
                      <span className="donor-field-value">
                        {active.phone ? (
                          <a href={`tel:${active.phone}`}>{active.phone}</a>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No phone number</span>
                        )}
                      </span>
                    </div>

                    {active.donorType === 'Company' && (
                      <div className="donor-field-item">
                        <span className="donor-field-label">Authorized Representative</span>
                        <span className="donor-field-value">
                          {active.contactPerson || active.fullName || '—'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Location Details */}
                <div className="donor-info-panel">
                  <div className="donor-info-panel__header">
                    <MapPin size={16} /> Geographic Location
                  </div>
                  <div className="donor-field-list">
                    <div className="donor-field-item">
                      <span className="donor-field-label">Country</span>
                      <span className="donor-field-value">
                        <Globe size={14} style={{ color: '#64748b' }} />
                        {active.country || 'Philippines'}
                      </span>
                    </div>

                    <div className="donor-field-item">
                      <span className="donor-field-label">Complete Address</span>
                      <span className="donor-field-value">
                        {active.address || '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Remarks / Profile Notes */}
              {active.notes && (
                <div className="donor-info-panel">
                  <div className="donor-info-panel__header">
                    <FileText size={16} /> Profile Notes & Remarks
                  </div>
                  <div className="donor-notes-box">
                    {active.notes}
                  </div>
                </div>
              )}

              {/* Portal Account Notice / Prompt */}
              {!active.hasAccount && active.email && (
                <div className="donor-account-prompt">
                  <div className="donor-account-prompt__content">
                    <span className="donor-account-prompt__icon">
                      <ShieldAlert size={18} />
                    </span>
                    <div>
                      <strong>Donor Portal Access:</strong> This donor does not have an active login account yet. You can provision access to email their login credentials.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn--sm btn--primary donor-account-prompt__btn"
                    disabled={saving}
                    onClick={createAccountForExisting}
                  >
                    <UserPlus size={14} /> Provision Access
                  </button>
                </div>
              )}

              {/* Contribution History */}
              {donorDonations?.length > 0 && (
                <div className="donor-info-panel">
                  <div className="donor-info-panel__header">
                    <Heart size={16} /> Recent Contribution History ({donorDonations.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {donorDonations.slice(0, 4).map((d) => (
                      <div
                        key={d.dbId || d.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.65rem 0.85rem',
                          background: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#AF101A' }}>
                            {d.trackingCode}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {d.type} • {d.category || 'General'} • {d.date}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#047857' }}>
                            {d.type === 'Monetary' ? d.amount : (d.itemsDescription || d.amount || 'In-Kind')}
                          </div>
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b' }}>
                            {d.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="admin-modal__actions admin-modal__actions--split" style={{ marginTop: '1.25rem' }}>
              <button 
                type="button" 
                className="btn btn--danger" 
                onClick={() => handleDelete(active)}
              >
                <Trash2 size={15} /> Delete Donor
              </button>
              <button 
                type="button" 
                className="btn btn--ghost" 
                onClick={() => setMode(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === 'create' && (
        <div className="admin-modal-overlay" onClick={() => setMode(null)}>
          <div className="admin-modal admin-modal--xl" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title="Add Donor"
              subtitle="Register a new donor profile and optionally provision donor portal credentials."
              onClose={() => setMode(null)}
            />
            <form onSubmit={handleSave}>
              {/* Top Selector Card: Classification */}
              <div
                style={{
                  marginBottom: '1.25rem',
                  padding: '0.85rem 1.15rem',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>Donor Classification</span>
                  <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                    Select whether this donor profile is an individual person or an organization.
                  </p>
                </div>
                <select
                  required
                  value={form.donorType}
                  onChange={(e) => setForm({
                    ...form,
                    donorType: e.target.value,
                    organization: e.target.value === 'Individual' ? '' : form.organization,
                  })}
                  style={{ minWidth: '220px', margin: 0 }}
                >
                  {DONOR_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* 2-Column Balanced Form Grid */}
              <div className="admin-form-grid-2col">
                {/* Left Card: Identity & Primary Contact */}
                <div className="admin-form-card">
                  <div className="admin-form-card__header">
                    <h4 className="admin-form-card__title">
                      {isCompany ? (
                        <><Building2 size={15} aria-hidden /> Company & Representative</>
                      ) : (
                        <><User size={15} aria-hidden /> Donor Contact Details</>
                      )}
                    </h4>
                  </div>

                  <div className="admin-form-card__body">
                    {isCompany ? (
                      <>
                        <label>
                          <Req required>Company / Organization Name</Req>
                          <input
                            required
                            value={form.organization}
                            onChange={(e) => setForm({ ...form, organization: e.target.value })}
                            placeholder="e.g. Acme Foundation Inc. / Danish Rotary Club"
                          />
                        </label>

                        <div>
                          <p style={{ margin: '0 0 0.35rem', fontSize: '0.8125rem', fontWeight: 600, color: '#334155' }}>
                            Authorized Representative
                          </p>
                          <NameFields
                            value={form.nameParts}
                            onChange={(nameParts) => setForm({ ...form, nameParts })}
                          />
                        </div>

                        <div className="form-row">
                          <label>
                            <Req required>Email Address</Req>
                            <input
                              type="email"
                              required
                              value={form.email}
                              onChange={(e) => setForm({ ...form, email: e.target.value })}
                              placeholder="contact@company.com"
                            />
                          </label>
                          <label>
                            <Req required>Contact Number</Req>
                            <PhoneInput
                              allowInternational
                              required
                              value={form.phone}
                              onChange={(phone) => setForm({ ...form, phone })}
                            />
                          </label>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <NameFields
                            value={form.nameParts}
                            onChange={(nameParts) => setForm({ ...form, nameParts })}
                          />
                        </div>

                        <label>
                          <Req required>Email Address</Req>
                          <input
                            type="email"
                            required
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            placeholder="donor@email.com"
                          />
                        </label>

                        <label>
                          <Req required>Contact Number</Req>
                          <PhoneInput
                            allowInternational
                            required
                            value={form.phone}
                            onChange={(phone) => setForm({ ...form, phone })}
                          />
                        </label>
                      </>
                    )}
                  </div>
                </div>

                {/* Right Card: Location & Remarks */}
                <div className="admin-form-card">
                  <div className="admin-form-card__header">
                    <h4 className="admin-form-card__title">
                      <MapPin size={15} aria-hidden /> Location & Remarks
                    </h4>
                  </div>

                  <div className="admin-form-card__body">
                    <div className="form-row">
                      <label>
                        <span>Country</span>
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
                        <span>{form.country === 'Philippines' ? 'Province / Region' : 'State / Province'}</span>
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
                        <span>Specify State / Province / Region</span>
                        <input
                          value={form.customRegion}
                          onChange={(e) => setForm({ ...form, customRegion: e.target.value })}
                          placeholder="Enter state/province name"
                        />
                      </label>
                    )}

                    <label>
                      <span>Complete Address</span>
                      <input
                        value={form.streetAddress}
                        onChange={(e) => setForm({ ...form, streetAddress: e.target.value })}
                        placeholder="Street, Barangay, City, Postal Code"
                      />
                    </label>

                    <label>
                      <span>Profile Notes & Remarks</span>
                      <textarea
                        rows={2}
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        placeholder="Additional remarks or background notes about the donor"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Bottom Portal Account Checkbox */}
              <div className="policy-box" style={{ marginTop: '1.25rem', marginBottom: '0.25rem' }}>
                <label className="need-check" style={{ margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={form.createAccount}
                    onChange={(e) => setForm({
                      ...form,
                      createAccount: e.target.checked,
                      acceptedTerms: true,
                      acceptedPrivacy: true,
                      acceptedPolicies: true,
                    })}
                  />
                  <span>Create donor portal account and email login credentials automatically</span>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="admin-modal__actions" style={{ justifyContent: 'flex-start' }}>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={saving}
                >
                  {saving ? 'Saving…' : form.createAccount ? 'Create & Save Donor' : 'Save Donor'}
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setMode(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
