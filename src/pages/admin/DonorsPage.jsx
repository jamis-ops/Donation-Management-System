import { useState } from 'react'
import { Eye, Pencil, Trash2, UserPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { donorsApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { useFilters } from '../../hooks/useFilters'
import { DONOR_TYPES } from '../../constants/options'
import Req from '../../components/shared/Req'
import NameFields from '../../components/shared/NameFields'
import PageHeader from '../../components/admin/shared/PageHeader'
import DataTable from '../../components/admin/shared/DataTable'
import ApiState from '../../components/admin/shared/ApiState'
import FilterBar from '../../components/admin/shared/FilterBar'
import ModalHeader from '../../components/admin/shared/ModalHeader'
import { emptyNameParts, formatFullName, parseFullName } from '../../utils/personName'

const emptyForm = {
  donorType: 'Individual',
  organization: '',
  nameParts: emptyNameParts(),
  email: '',
  phone: '',
  country: '',
  address: '',
  notes: '',
  createAccount: false,
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

export default function DonorsPage() {
  const { data: donors, loading, error, reload } = useApiList(() => donorsApi.list())
  const filters = useFilters(donors, filterConfig)
  const [mode, setMode] = useState(null)
  const [active, setActive] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const isCompany = form.donorType === 'Company'

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
    setForm({
      donorType: row.donorType === 'Company' ? 'Company' : 'Individual',
      organization: row.organization || '',
      nameParts,
      email: row.email || '',
      phone: row.phone || '',
      country: row.country || '',
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
      alert('Company / Organization Name is required.')
      return
    }
    setSaving(true)
    try {
      const contactPerson = formatFullName(form.nameParts)
      const payload = {
        donorType: form.donorType,
        organization: isCompany ? form.organization : '',
        lastName: form.nameParts.lastName,
        firstName: form.nameParts.firstName,
        middleInitial: form.nameParts.middleInitial,
        contactPerson,
        fullName: isCompany ? (form.organization || contactPerson) : contactPerson,
        email: form.email,
        phone: form.phone,
        country: form.country,
        address: form.address,
        notes: form.notes,
        createAccount: form.createAccount,
        acceptedPolicies: form.acceptedPolicies,
      }
      let res
      if (mode === 'edit' && active) {
        res = await donorsApi.update(active.dbId, payload)
      } else {
        res = await donorsApi.create(payload)
      }
      if (res?.accountCreated) {
        alert(accountResultMessage(res))
      }
      setMode(null)
      setForm(emptyForm)
      reload()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const createAccountForExisting = async () => {
    if (!active) return
    if (!confirm(`Create a portal account for ${active.name} and email the credentials?`)) return
    setSaving(true)
    try {
      const res = await donorsApi.update(active.dbId, {
        createAccount: true,
        email: active.email,
        acceptedPolicies: true,
      })
      alert(accountResultMessage(res))
      setMode(null)
      reload()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    if (!confirm(`Permanently delete donor "${row.name}" and their portal login (if any)? Donation history will be kept but unlinked.`)) return
    try {
      await donorsApi.remove(row.dbId)
      if (mode === 'view' && active?.dbId === row.dbId) setMode(null)
      reload()
    } catch (err) {
      alert(err.message)
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
        <DataTable columns={columns} data={filters.filtered} onRowClick={openView} initialVisible={5} />
      </ApiState>

      {mode === 'view' && active && (
        <div className="admin-modal-overlay" onClick={() => setMode(null)}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title="Donor Details" onClose={() => setMode(null)} />
            <dl className="detail-list">
              <dt>Donor ID</dt><dd>{active.id}</dd>
              <dt>Donor Type</dt><dd>{active.donorType || 'Individual'}</dd>
              <dt>Company / Organization</dt><dd>{active.organization || '—'}</dd>
              <dt>Contact Person</dt><dd>{active.contactPerson || active.fullName || '—'}</dd>
              <dt>Email</dt><dd>{active.email || '—'}</dd>
              <dt>Contact Number</dt><dd>{active.phone || '—'}</dd>
              <dt>Country</dt><dd>{active.country || '—'}</dd>
              <dt>Address</dt><dd>{active.address || '—'}</dd>
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

              {isCompany && (
                <label>
                  <Req required>Company / Organization Name</Req>
                  <input
                    required
                    value={form.organization}
                    onChange={(e) => setForm({ ...form, organization: e.target.value })}
                    placeholder="Acme Foundation Inc."
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
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="donor@email.com"
                />
              </label>
              <div className="form-row">
                <label>
                  Contact Number
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+63 9xx xxx xxxx" />
                </label>
                <label>
                  Country
                  <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="Philippines" />
                </label>
              </div>
              <label>
                Address
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street, City, Province" />
              </label>
              <label>
                Notes
                <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </label>

              {mode === 'create' && (
                <div className="policy-box">
                  <label className="need-check">
                    <input
                      type="checkbox"
                      checked={form.createAccount}
                      onChange={(e) => setForm({ ...form, createAccount: e.target.checked, acceptedPolicies: e.target.checked ? form.acceptedPolicies : false })}
                    />
                    Create portal account and email login credentials
                  </label>
                  {form.createAccount && (
                    <label className="need-check">
                      <input
                        type="checkbox"
                        required
                        checked={form.acceptedPolicies}
                        onChange={(e) => setForm({ ...form, acceptedPolicies: e.target.checked })}
                      />
                      Donor accepts the{' '}
                      <Link to="/privacy" target="_blank" rel="noreferrer">Data Privacy Policy</Link>
                      {' '}and{' '}
                      <Link to="/terms" target="_blank" rel="noreferrer">Terms &amp; Conditions</Link>
                      <span className="req"> *</span>
                    </label>
                  )}
                </div>
              )}

              <div className="admin-modal__actions">
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Donor'}
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
