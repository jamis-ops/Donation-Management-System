import { useState } from 'react'
import { beneficiariesApi, assistanceRequestsApi, getDistributionProofs } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { NEEDS, BARANGAY_TYPES } from '../../constants/options'
import { useFilters } from '../../hooks/useFilters'
import PageHeader from '../../components/admin/shared/PageHeader'
import DataTable from '../../components/admin/shared/DataTable'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import FilterBar from '../../components/admin/shared/FilterBar'
import AdminProofReview from '../../components/admin/shared/AdminProofReview'

const STATUS_OPTIONS = ['Pending Approval', 'Approved', 'Active', 'Suspended']
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High']

const barangayFilterConfig = {
  searchKeys: ['id', 'barangay', 'municipality', 'representativeName', 'address', 'representativeEmail'],
  filters: [
    { key: 'status', label: 'Status' },
    { key: 'barangayType', label: 'Type' },
  ],
}

const requestFilterConfig = {
  searchKeys: ['id', 'beneficiary', 'type'],
  filters: [
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Priority' },
  ],
  dateKey: 'date',
}

const proofFilterConfig = {
  searchKeys: ['distributionCode', 'eventName', 'barangay', 'fileName'],
  filters: [{ key: 'status', label: 'Status', options: ['Pending', 'Approved', 'Rejected'] }],
}

const emptyForm = {
  barangay: '', barangayType: '', municipality: '', address: '', affectedFamilies: '',
  needs: [], representativeName: '', representativePhone: '', representativeEmail: '', notes: '', status: 'Pending Approval',
}

export default function BeneficiariesPage() {
  const { data: beneficiaries, loading, error, reload } = useApiList(() => beneficiariesApi.list())
  const { data: assistanceRequests, loading: reqLoading, error: reqError, reload: reloadReq } = useApiList(() => assistanceRequestsApi.list())
  const { data: proofs, loading: proofLoading, error: proofError, reload: reloadProofs } = useApiList(() => getDistributionProofs())
  const barangayTypes = BARANGAY_TYPES
  const needOptions = NEEDS
  const barangayFilters = useFilters(beneficiaries, barangayFilterConfig)
  const requestFilters = useFilters(assistanceRequests, requestFilterConfig)
  const proofFilters = useFilters(proofs, proofFilterConfig)
  const [tab, setTab] = useState('barangays')
  const [showForm, setShowForm] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [proofRecord, setProofRecord] = useState(null)

  const openProofsFor = (row) => {
    setProofRecord(row)
    reloadProofs()
  }

  const openCreate = () => { setEditRow(null); setForm(emptyForm); setShowForm(true) }
  const openEdit = (row) => {
    setEditRow(row)
    setForm({
      barangay: row.barangay || row.name,
      barangayType: row.barangayType || '',
      municipality: row.municipality || '',
      address: row.address || '',
      affectedFamilies: row.affectedFamilies || '',
      needs: Array.isArray(row.needs) ? row.needs : [],
      representativeName: row.representativeName || '',
      representativePhone: row.representativePhone || '',
      representativeEmail: row.representativeEmail || '',
      notes: row.notes || '',
      status: row.status,
    })
    setShowForm(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        barangay: form.barangay,
        barangayType: form.barangayType,
        municipality: form.municipality,
        address: form.address,
        affectedFamilies: Number(form.affectedFamilies) || 0,
        needs: form.needs,
        representativeName: form.representativeName,
        representativePhone: form.representativePhone,
        representativeEmail: form.representativeEmail,
        notes: form.notes,
        status: form.status,
      }
      if (editRow) {
        await beneficiariesApi.update(editRow.dbId, payload)
      } else {
        await beneficiariesApi.create(payload)
      }
      setShowForm(false)
      reload()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const totalFamilies = beneficiaries.reduce((s, b) => s + (b.affectedFamilies || 0), 0)

  const barangayColumns = [
    { key: 'id', label: 'Code' },
    { key: 'barangay', label: 'Barangay' },
    { key: 'barangayType', label: 'Type', render: (row) => row.barangayType || '—' },
    { key: 'municipality', label: 'Municipality/City' },
    { key: 'affectedFamilies', label: 'Affected Families' },
    { key: 'representativeName', label: 'Representative' },
    {
      key: 'needs',
      label: 'Needs',
      render: (row) => (Array.isArray(row.needs) && row.needs.length ? row.needs.join(', ') : '—'),
    },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'proofsSubmitted',
      label: 'Proofs',
      render: (row) => {
        const forBen = proofs.filter((p) => Number(p.beneficiaryId) === Number(row.dbId))
        const pending = forBen.filter((p) => p.status === 'Pending' || p.status === 'Pending Review').length
        return (
          <button
            type="button"
            className={`proof-count-btn${pending > 0 ? ' proof-count-btn--pending' : ''}`}
            onClick={(e) => { e.stopPropagation(); openProofsFor(row) }}
            title="View proofs for this barangay"
          >
            {forBen.length}
            {pending > 0 ? <em>{pending} pending</em> : null}
          </button>
        )
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions">
          <button type="button" className="btn btn--sm btn--outline" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>Edit</button>
          <button type="button" className="btn btn--sm btn--outline" onClick={(e) => { e.stopPropagation(); openProofsFor(row) }}>Proofs</button>
        </div>
      ),
    },
  ]

  const requestColumns = [
    { key: 'id', label: 'Reference' },
    { key: 'beneficiary', label: 'Barangay' },
    { key: 'type', label: 'Assistance Type' },
    { key: 'date', label: 'Submitted' },
    {
      key: 'priority',
      label: 'Priority',
      render: (row) => (
        <select
          className="inline-select"
          value={row.priority}
          onChange={(e) => assistanceRequestsApi.update(row.dbId, { priority: e.target.value }).then(reloadReq)}
        >
          {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <select
          className="inline-select"
          value={row.status}
          onChange={(e) => assistanceRequestsApi.update(row.dbId, { status: e.target.value }).then(reloadReq)}
        >
          {['Pending Review', 'Under Review', 'Approved', 'Allocated', 'Rejected'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      ),
    },
  ]

  const proofColumns = [
    { key: 'barangay', label: 'Barangay' },
    { key: 'eventName', label: 'Distribution Event', render: (row) => row.eventName || row.distributionCode },
    { key: 'fileName', label: 'File' },
    { key: 'submittedAt', label: 'Submitted' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ]

  const pendingProofs = proofs.filter((p) => p.status === 'Pending' || p.status === 'Pending Review').length

  return (
    <>
      <PageHeader
        title="Barangay Beneficiary Management"
        description="Manage barangays, assistance requests, and review distribution proofs submitted by each barangay."
        actions={<button type="button" className="btn btn--primary" onClick={openCreate}>+ Register Barangay</button>}
      />

      <div className="admin-stats-grid admin-stats-grid--compact">
        <div className="admin-stat-card"><span className="admin-stat-card__value">{beneficiaries.length}</span><span className="admin-stat-card__label">Barangays Registered</span></div>
        <div className="admin-stat-card"><span className="admin-stat-card__value">{totalFamilies.toLocaleString()}</span><span className="admin-stat-card__label">Total Affected Families</span></div>
        <div className="admin-stat-card"><span className="admin-stat-card__value">{pendingProofs}</span><span className="admin-stat-card__label">Proofs Pending Review</span></div>
      </div>

      <div className="admin-tabs">
        <button type="button" className={`admin-tab${tab === 'barangays' ? ' admin-tab--active' : ''}`} onClick={() => setTab('barangays')}>Barangays</button>
        <button type="button" className={`admin-tab${tab === 'requests' ? ' admin-tab--active' : ''}`} onClick={() => setTab('requests')}>Assistance Requests</button>
        <button type="button" className={`admin-tab${tab === 'proofs' ? ' admin-tab--active' : ''}`} onClick={() => setTab('proofs')}>
          Proofs{pendingProofs > 0 ? ` (${pendingProofs})` : ''}
        </button>
      </div>

      {tab === 'barangays' && (
        <>
          <FilterBar
            controller={barangayFilters}
            searchPlaceholder="Search by code, barangay, city, or representative..."
            exportConfig={{ filename: 'barangay-report', title: 'Barangay Report', columns: barangayColumns, rows: barangayFilters.filtered }}
          />
          <ApiState loading={loading} error={error} onRetry={reload}>
            <DataTable columns={barangayColumns} data={barangayFilters.filtered} onRowClick={openEdit} />
          </ApiState>
        </>
      )}
      {tab === 'requests' && (
        <>
          <FilterBar controller={requestFilters} searchPlaceholder="Search by reference, barangay, or type..." />
          <ApiState loading={reqLoading} error={reqError} onRetry={reloadReq}>
            <DataTable columns={requestColumns} data={requestFilters.filtered} />
          </ApiState>
        </>
      )}
      {tab === 'proofs' && (
        <>
          <FilterBar
            controller={proofFilters}
            searchPlaceholder="Search by barangay, event, or file name..."
            exportConfig={{ filename: 'barangay-proofs', title: 'Barangay Proof Report', columns: proofColumns, rows: proofFilters.filtered }}
          />
          <ApiState loading={proofLoading} error={proofError} onRetry={reloadProofs}>
            <AdminProofReview proofs={proofFilters.filtered} onChanged={reloadProofs} />
          </ApiState>
        </>
      )}

      {showForm && (
        <div className="admin-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <h2>{editRow ? 'Edit Barangay' : 'Register Barangay'}</h2>
            <form onSubmit={handleSave}>
              <div className="form-row">
                <label>Barangay Name<input required value={form.barangay} onChange={(e) => setForm({ ...form, barangay: e.target.value })} placeholder="Brgy. Talisay" /></label>
                <label>Barangay Type
                  <select value={form.barangayType} onChange={(e) => setForm({ ...form, barangayType: e.target.value })}>
                    <option value="">Select type...</option>
                    {barangayTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                    {form.barangayType && !barangayTypes.includes(form.barangayType) && (
                      <option value={form.barangayType}>{form.barangayType}</option>
                    )}
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label>Municipality/City<input value={form.municipality} onChange={(e) => setForm({ ...form, municipality: e.target.value })} placeholder="Talisay City" /></label>
                <label>Affected Families<input type="number" min="0" required value={form.affectedFamilies} onChange={(e) => setForm({ ...form, affectedFamilies: e.target.value })} /></label>
              </div>
              <label>Complete Address<input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Purok / Street, Barangay, City, Province" /></label>
              <fieldset className="needs-fieldset">
                <legend>Type of Beneficiary — Needs (select all that apply)</legend>
                <div className="needs-grid">
                  {needOptions.map((n) => {
                    const checked = form.needs.includes(n)
                    return (
                      <label key={n} className="need-check">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => setForm((prev) => ({
                            ...prev,
                            needs: e.target.checked
                              ? [...prev.needs, n]
                              : prev.needs.filter((x) => x !== n),
                          }))}
                        />
                        {n}
                      </label>
                    )
                  })}
                </div>
              </fieldset>
              <div className="form-row">
                <label>Point of Contact (POC)<input required value={form.representativeName} onChange={(e) => setForm({ ...form, representativeName: e.target.value })} placeholder="Representative full name" /></label>
                <label>Contact Number<input required value={form.representativePhone} onChange={(e) => setForm({ ...form, representativePhone: e.target.value })} placeholder="+63 9xx xxx xxxx" /></label>
              </div>
              <label>Email Address<input type="email" required value={form.representativeEmail} onChange={(e) => setForm({ ...form, representativeEmail: e.target.value })} placeholder="poc@email.com" /></label>
              <label>Status
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label>Notes<textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
              <div className="admin-modal__actions">
                <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                <button type="button" className="btn btn--ghost" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {proofRecord && (
        <div className="admin-modal-overlay" onClick={() => setProofRecord(null)}>
          <div className="admin-modal admin-modal--xl proof-record-modal" onClick={(e) => e.stopPropagation()}>
            <div className="proof-record-modal__head">
              <div>
                <h2>Distribution Proofs</h2>
                <p>
                  {proofRecord.barangay || proofRecord.name}
                  {proofRecord.municipality ? ` · ${proofRecord.municipality}` : ''}
                </p>
              </div>
              <button type="button" className="btn btn--ghost" onClick={() => setProofRecord(null)}>Close</button>
            </div>
            <ApiState loading={proofLoading} error={proofError} onRetry={reloadProofs}>
              <AdminProofReview
                proofs={proofs}
                onChanged={reloadProofs}
                lockedBeneficiaryId={proofRecord.dbId}
                lockedBarangay={proofRecord.barangay || proofRecord.name}
                hideBarangayFilter
              />
            </ApiState>
          </div>
        </div>
      )}
    </>
  )
}
