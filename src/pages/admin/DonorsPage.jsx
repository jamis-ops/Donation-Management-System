import { useMemo, useState } from 'react'
import { Eye, Pencil, Trash2, UserPlus, Building2, User, MapPin } from 'lucide-react'
import { donorsApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { useFilters } from '../../hooks/useFilters'
import { DONOR_TYPES } from '../../constants/options'
import { COUNTRIES, getRegionsForCountry } from '../../constants/locations'
import Req from '../../components/shared/Req'
import NameFields from '../../components/shared/NameFields'
import PolicyConsentBox from '../../components/shared/PolicyConsentBox'
import PageHeader from '../../components/admin/shared/PageHeader'
import DataTable from '../../components/admin/shared/DataTable'
import ApiState from '../../components/admin/shared/ApiState'
import FilterBar from '../../components/admin/shared/FilterBar'
import ModalHeader from '../../components/admin/shared/ModalHeader'
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
  acceptedTerms: false,
  acceptedPrivacy: false,
  acceptedPolicies: false,
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

  const isCompany = form.donorType === 'Company'

  const availableRegions = useMemo(() => {
    return getRegionsForCountry(form.country)
  }, [form.country])

  const openCreate = () => {
    setActive(null)
    setForm(emptyForm)
    setMode('create')
  }

  const openView = (row) => {
    setActive(row)
    setMode('view')
  }

  const openEdit = (row) => {
    setActive(row)
    const hasParts = Boolean(row.lastName || row.firstName)
    const nameParts = hasParts
      ? {
          lastName: row.lastName || '',
          firstName: row.firstName || '',
          middleInitial: row.middleInitial || '',
        }
      : parseFullName(row.contactPerson || row.fullName || '')

    const country = row.country || 'Philippines'
    const regions = getRegionsForCountry(country)

    // Check if row.address matches any known region
    let streetAddress = (row.address || '').trim()
    let stateProvince = ''
    let customRegion = ''

    if (streetAddress && regions.length > 0) {
      for (const reg of regions) {
        if (streetAddress.toLowerCase().endsWith(reg.toLowerCase())) {
          stateProvince = reg
          streetAddress = streetAddress.slice(0, streetAddress.length - reg.length).replace(/,\s*$/, '').trim()
          break
        }
      }
    }

    setForm({
      donorType: row.donorType === 'Company' ? 'Company' : 'Individual',
      organization: row.organization || '',
      nameParts,
      email: row.email || '',
      phone: row.phone || '',
      country,
      stateProvince,
      customRegion,
      streetAddress,
      address: row.address || '',
      notes: row.notes || '',
      createAccount: false,
      acceptedPolicies: false,
    })
    setMode('edit')
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
    const phoneMsg = phoneError(form.phone, { required: true })
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
        acceptedTerms: form.acceptedTerms,
        acceptedPrivacy: form.acceptedPrivacy,
        acceptedPolicies: form.createAccount ? (form.acceptedTerms && form.acceptedPrivacy) : true,
      }
      let res
      if (mode === 'edit' && active) {
        res = await donorsApi.update(active.dbId, payload)
      } else {
        res = await donorsApi.create(payload)
      }
      if (res?.accountCreated) {
        toastAccountResult(res)
        showSuccessModal('Credentials successfully sent.')
      } else {
        notify.success(mode === 'edit' ? 'Donor updated.' : 'Donor saved.')
        showSuccessModal(mode === 'edit' ? 'Successfully updated.' : 'Successfully added.')
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
          <button type="button" className="icon-btn" title="Edit" aria-label="Edit" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>
            <Pencil size={15} />
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
            <ModalHeader title="Donor Details" onClose={() => setMode(null)} />
            <dl className="detail-list">
              <dt>Donor ID</dt><dd>{active.id}</dd>
              <dt>Donor Type</dt><dd>{active.donorType || 'Individual'}</dd>
              {active.donorType === 'Company' ? (
                <>
                  <dt>Company / Organization</dt><dd>{active.organization || '—'}</dd>
                  <dt>Country</dt><dd>{active.country || '—'}</dd>
                  <dt>Company Address</dt><dd>{active.address || '—'}</dd>
                  <dt>Authorized Representative</dt><dd>{active.contactPerson || active.fullName || '—'}</dd>
                </>
              ) : (
                <>
                  <dt>Donor Name</dt><dd>{active.fullName || active.contactPerson || '—'}</dd>
                  <dt>Country</dt><dd>{active.country || '—'}</dd>
                  <dt>Address</dt><dd>{active.address || '—'}</dd>
                </>
              )}
              <dt>Email</dt><dd>{active.email || '—'}</dd>
              <dt>Contact Number</dt><dd>{active.phone || '—'}</dd>
              <dt>Notes</dt><dd>{active.notes || '—'}</dd>
              <dt>Portal Account</dt><dd>{active.hasAccount ? 'Yes' : 'No'}</dd>
              <dt>Total Donated</dt><dd>{active.totalDonated}</dd>
              <dt>Donations</dt><dd>{active.donations}</dd>
              <dt>Last Donation</dt><dd>{active.lastDonation || '—'}</dd>
            </dl>
            <div className="admin-modal__actions">
              {!active.hasAccount && active.email && (
                <button type="button" className="btn btn--primary" disabled={saving} onClick={createAccountForExisting}>
                  <UserPlus size={15} /> Create Account &amp; Email Credentials
                </button>
              )}
              <button type="button" className="btn btn--outline" onClick={() => openEdit(active)}>Edit</button>
              <button type="button" className="btn btn--ghost" onClick={() => setMode(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {(mode === 'create' || mode === 'edit') && (
        <div className="admin-modal-overlay" onClick={() => setMode(null)}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title={mode === 'edit' ? 'Edit Donor' : 'Add Donor'} onClose={() => setMode(null)} />
            <form onSubmit={handleSave}>
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
                  {/* Company / Organization Details Section */}
                  <div style={{ marginTop: '1rem', marginBottom: '1.25rem' }}>
                    <p className="form-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Building2 size={15} /> Company / Organization Information
                    </p>

                    <label>
                      <Req required>Company / Organization Name</Req>
                      <input
                        required
                        value={form.organization}
                        onChange={(e) => setForm({ ...form, organization: e.target.value })}
                        placeholder="e.g. Acme Foundation Inc. / Danish Rotary Club"
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
                        value={form.streetAddress}
                        onChange={(e) => setForm({ ...form, streetAddress: e.target.value })}
                        placeholder="Building, Street, Barangay, City, Postal Code"
                      />
                    </label>
                  </div>

                  {/* Authorized Representative / Contact Person Section */}
                  <div style={{ marginTop: '1rem', marginBottom: '0.75rem' }}>
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
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          placeholder="contact@company.com"
                        />
                      </label>
                      <label>
                        <Req required>Contact Number</Req>
                        <PhoneInput
                          required
                          value={form.phone}
                          onChange={(phone) => setForm({ ...form, phone })}
                        />
                      </label>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Individual Donor Name & Contact */}
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
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          placeholder="donor@email.com"
                        />
                      </label>
                      <label>
                        <Req required>Contact Number</Req>
                        <PhoneInput
                          required
                          value={form.phone}
                          onChange={(phone) => setForm({ ...form, phone })}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Individual Address & Location Details */}
                  <div style={{ marginTop: '1rem', marginBottom: '0.75rem' }}>
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
                        value={form.streetAddress}
                        onChange={(e) => setForm({ ...form, streetAddress: e.target.value })}
                        placeholder="Street, Barangay, City, Postal Code"
                      />
                    </label>
                  </div>
                </>
              )}

              <label style={{ marginTop: '0.75rem' }}>
                Notes
                <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional remarks or notes about the donor" />
              </label>

              {mode === 'create' && (
                <div className="policy-box" style={{ marginTop: '1rem' }}>
                  <label className="need-check">
                    <input
                      type="checkbox"
                      checked={form.createAccount}
                      onChange={(e) => setForm({
                        ...form,
                        createAccount: e.target.checked,
                        acceptedTerms: e.target.checked ? form.acceptedTerms : false,
                        acceptedPrivacy: e.target.checked ? form.acceptedPrivacy : false,
                        acceptedPolicies: e.target.checked ? (form.acceptedTerms && form.acceptedPrivacy) : false,
                      })}
                    />
                    <span>Create portal account and email login credentials</span>
                  </label>
                  {form.createAccount && (
                    <PolicyConsentBox
                      acceptedTerms={form.acceptedTerms}
                      onTermsChange={(acceptedTerms) => setForm({ ...form, acceptedTerms, acceptedPolicies: acceptedTerms && form.acceptedPrivacy })}
                      acceptedPrivacy={form.acceptedPrivacy}
                      onPrivacyChange={(acceptedPrivacy) => setForm({ ...form, acceptedPrivacy, acceptedPolicies: form.acceptedTerms && acceptedPrivacy })}
                      entityLabel="Donor"
                    />
                  )}
                </div>
              )}

              <div className="admin-modal__actions" style={{ marginTop: '1.25rem' }}>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={saving || (form.createAccount && (!form.acceptedTerms || !form.acceptedPrivacy))}
                  title={form.createAccount && (!form.acceptedTerms || !form.acceptedPrivacy) ? 'Please accept both agreements to create credentials' : ''}
                >
                  {saving ? 'Saving...' : form.createAccount ? 'Create & Save Donor' : 'Save Donor'}
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
