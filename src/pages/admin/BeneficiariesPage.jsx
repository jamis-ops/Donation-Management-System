import { useMemo, useState } from 'react'
import { Eye, Pencil, Trash2, FileImage, HandHelping } from 'lucide-react'
import { beneficiariesApi, assistanceRequestsApi, getDistributionProofs } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { NEEDS, BARANGAY_TYPES, REPRESENTATIVE_POSITIONS } from '../../constants/options'
import { MUNICIPALITIES, barangaysForMunicipality } from '../../constants/locations'
import Req from '../../components/shared/Req'
import { useFilters } from '../../hooks/useFilters'
import PageHeader from '../../components/admin/shared/PageHeader'
import DataTable from '../../components/admin/shared/DataTable'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import FilterBar from '../../components/admin/shared/FilterBar'
import AdminProofReview from '../../components/admin/shared/AdminProofReview'
import ModalHeader from '../../components/admin/shared/ModalHeader'

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
  barangay: '',
  barangayType: '',
  municipality: '',
  address: '',
  affectedFamilies: '',
  needs: [],
  representativeName: '',
  representativePosition: '',
  representativePhone: '',
  representativeEmail: '',
  notes: '',
  status: 'Pending Approval',
}

function formFromRow(row) {
  return {
    barangay: row.barangay || row.name || '',
    barangayType: row.barangayType || '',
    municipality: row.municipality || '',
    address: row.address || '',
    affectedFamilies: row.affectedFamilies ?? '',
    needs: Array.isArray(row.needs) ? row.needs : [],
    representativeName: row.representativeName || '',
    representativePosition: row.representativePosition || '',
    representativePhone: row.representativePhone || '',
    representativeEmail: row.representativeEmail || '',
    notes: row.notes || '',
    status: row.status || 'Pending Approval',
  }
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
  const [mode, setMode] = useState(null) // 'view' | 'create' | 'edit'
  const [active, setActive] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [viewSection, setViewSection] = useState('details') // details | proofs | assistance

  const totalFamilies = beneficiaries.reduce((s, b) => s + (b.affectedFamilies || 0), 0)
  const pendingProofs = proofs.filter((p) => p.status === 'Pending' || p.status === 'Pending Review').length

  const activeProofs = useMemo(() => {
    if (!active) return []
    return proofs.filter((p) => Number(p.beneficiaryId) === Number(active.dbId))
  }, [proofs, active])

  const activeRequests = useMemo(() => {
    if (!active) return []
    return assistanceRequests.filter((r) => Number(r.beneficiaryId) === Number(active.dbId))
  }, [assistanceRequests, active])

  const openCreate = () => {
    setActive(null)
    setForm(emptyForm)
    setMode('create')
  }

  const openView = (row) => {
    setActive(row)
    setViewSection('details')
    setMode('view')
  }

  const openEdit = (row) => {
    setActive(row)
    setForm(formFromRow(row))
    setMode('edit')
  }

  const handleDelete = async (row) => {
    if (!confirm(`Permanently delete barangay "${row.barangay || row.name}"? Related proofs and assistance history may be affected.`)) return
    try {
      await beneficiariesApi.remove(row.dbId)
      if (mode === 'view' && active?.dbId === row.dbId) setMode(null)
      reload()
      reloadReq()
      reloadProofs()
    } catch (err) {
      alert(err.message)
    }
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
        representativePosition: form.representativePosition,
        representativePhone: form.representativePhone,
        representativeEmail: form.representativeEmail,
        notes: form.notes,
        status: form.status,
      }
      if (mode === 'edit' && active) {
        await beneficiariesApi.update(active.dbId, payload)
      } else {
        await beneficiariesApi.create(payload)
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

  const barangayColumns = [
    { key: 'id', label: 'Code' },
    { key: 'barangay', label: 'Barangay' },
    { key: 'municipality', label: 'Municipality / City', render: (row) => row.municipality || '—' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
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

  const exportColumns = [
    ...barangayColumns.filter((c) => c.key !== 'actions'),
    { key: 'barangayType', label: 'Type' },
    { key: 'affectedFamilies', label: 'Affected Families' },
    { key: 'representativeName', label: 'Representative' },
    { key: 'representativePosition', label: 'Position' },
    { key: 'address', label: 'Address' },
  ]

  return (
    <>
      <PageHeader
        title="Barangay Beneficiary Management"
        description="Manage barangays, review proofs, and track assistance requests."
        actions={<button type="button" className="btn btn--primary" onClick={openCreate}>+ Register Barangay</button>}
      />

      <div className="admin-stats-grid admin-stats-grid--compact">
        <div className="admin-stat-card">
          <span className="admin-stat-card__value">{beneficiaries.length}</span>
          <span className="admin-stat-card__label">Barangays Registered</span>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-card__value">{totalFamilies.toLocaleString()}</span>
          <span className="admin-stat-card__label">Total Affected Families</span>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-card__value">{pendingProofs}</span>
          <span className="admin-stat-card__label">Proofs Pending Review</span>
        </div>
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
            exportConfig={{ filename: 'barangay-report', title: 'Barangay Report', columns: exportColumns, rows: barangayFilters.filtered }}
          />
          <ApiState loading={loading} error={error} onRetry={reload}>
            <DataTable columns={barangayColumns} data={barangayFilters.filtered} onRowClick={openView} />
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

      {mode === 'view' && active && (
        <div className="admin-modal-overlay" onClick={() => setMode(null)}>
          <div className="admin-modal admin-modal--wide beneficiary-view-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title={active.barangay || active.name}
              subtitle={[active.id, active.municipality].filter(Boolean).join(' · ')}
              onClose={() => setMode(null)}
            />

            <div className="beneficiary-view-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={viewSection === 'details'}
                className={`beneficiary-view-tab${viewSection === 'details' ? ' beneficiary-view-tab--active' : ''}`}
                onClick={() => setViewSection('details')}
              >
                Beneficiary Details
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewSection === 'proofs'}
                className={`beneficiary-view-tab${viewSection === 'proofs' ? ' beneficiary-view-tab--active' : ''}`}
                onClick={() => setViewSection('proofs')}
              >
                <FileImage size={14} /> Proofs
                <span className="beneficiary-view-tab__count">{activeProofs.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewSection === 'assistance'}
                className={`beneficiary-view-tab${viewSection === 'assistance' ? ' beneficiary-view-tab--active' : ''}`}
                onClick={() => setViewSection('assistance')}
              >
                <HandHelping size={14} /> Assistance
                <span className="beneficiary-view-tab__count">{activeRequests.length}</span>
              </button>
            </div>

            {viewSection === 'details' && (
              <div className="beneficiary-view-section">
                <h3 className="beneficiary-view-section__title">Location &amp; Status</h3>
                <dl className="detail-list">
                  <dt>Code</dt><dd>{active.id}</dd>
                  <dt>Barangay</dt><dd>{active.barangay || active.name || '—'}</dd>
                  <dt>Municipality / City</dt><dd>{active.municipality || '—'}</dd>
                  <dt>Barangay Type</dt><dd>{active.barangayType || '—'}</dd>
                  <dt>Complete Address</dt><dd>{active.address || '—'}</dd>
                  <dt>No. of Affected Families</dt><dd>{Number(active.affectedFamilies || 0).toLocaleString()}</dd>
                  <dt>Status</dt><dd><StatusBadge status={active.status} /></dd>
                </dl>

                <h3 className="beneficiary-view-section__title">Needs</h3>
                <div className="beneficiary-needs-chips">
                  {Array.isArray(active.needs) && active.needs.length > 0
                    ? active.needs.map((n) => <span key={n} className="beneficiary-need-chip">{n}</span>)
                    : <span className="beneficiary-view-empty">No needs listed</span>}
                </div>

                <h3 className="beneficiary-view-section__title">Representative Information</h3>
                <dl className="detail-list">
                  <dt>Full Name</dt><dd>{active.representativeName || '—'}</dd>
                  <dt>Position / Role</dt><dd>{active.representativePosition || '—'}</dd>
                  <dt>Contact Number</dt><dd>{active.representativePhone || '—'}</dd>
                  <dt>Email</dt><dd>{active.representativeEmail || '—'}</dd>
                </dl>

                <h3 className="beneficiary-view-section__title">Notes</h3>
                <p className="beneficiary-view-notes">{active.notes || '—'}</p>
              </div>
            )}

            {viewSection === 'proofs' && (
              <div className="beneficiary-view-section">
                <ApiState loading={proofLoading} error={proofError} onRetry={reloadProofs}>
                  {activeProofs.length === 0 ? (
                    <p className="beneficiary-view-empty">No distribution proofs submitted for this barangay yet.</p>
                  ) : (
                    <AdminProofReview
                      proofs={activeProofs}
                      onChanged={reloadProofs}
                      lockedBeneficiaryId={active.dbId}
                      lockedBarangay={active.barangay || active.name}
                      hideBarangayFilter
                    />
                  )}
                </ApiState>
              </div>
            )}

            {viewSection === 'assistance' && (
              <div className="beneficiary-view-section">
                {activeRequests.length === 0 ? (
                  <p className="beneficiary-view-empty">No assistance requests for this barangay yet.</p>
                ) : (
                  <div className="beneficiary-assist-list">
                    {activeRequests.map((req) => (
                      <article key={req.dbId || req.id} className="beneficiary-assist-card">
                        <div className="beneficiary-assist-card__top">
                          <strong>{req.id}</strong>
                          <StatusBadge status={req.status} />
                        </div>
                        <p className="beneficiary-assist-card__type">{req.type || '—'}</p>
                        <div className="beneficiary-assist-card__meta">
                          <span>Submitted: {req.date || '—'}</span>
                          <span>Priority: {req.priority || '—'}</span>
                        </div>
                        {req.notes ? <p className="beneficiary-assist-card__notes">{req.notes}</p> : null}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="admin-modal__actions">
              <button type="button" className="btn btn--outline" onClick={() => openEdit(active)}>Edit</button>
              <button type="button" className="btn btn--ghost" onClick={() => setMode(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {(mode === 'create' || mode === 'edit') && (
        <div className="admin-modal-overlay" onClick={() => setMode(null)}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title={mode === 'edit' ? 'Edit Barangay' : 'Register Barangay'} onClose={() => setMode(null)} />
            <form onSubmit={handleSave}>
              <div className="form-row">
                <label>
                  <Req required>Municipality / City</Req>
                  <select
                    required
                    value={form.municipality}
                    onChange={(e) => setForm({ ...form, municipality: e.target.value, barangay: '' })}
                  >
                    <option value="">Select municipality/city…</option>
                    {MUNICIPALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
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
                    onChange={(e) => setForm({ ...form, barangay: e.target.value })}
                  >
                    <option value="">{form.municipality ? 'Select barangay…' : 'Select municipality first…'}</option>
                    {barangaysForMunicipality(form.municipality).map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                    {form.barangay && form.municipality && !barangaysForMunicipality(form.municipality).includes(form.barangay) && (
                      <option value={form.barangay}>{form.barangay}</option>
                    )}
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label>
                  Barangay Type
                  <select value={form.barangayType} onChange={(e) => setForm({ ...form, barangayType: e.target.value })}>
                    <option value="">Select type...</option>
                    {barangayTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                    {form.barangayType && !barangayTypes.includes(form.barangayType) && (
                      <option value={form.barangayType}>{form.barangayType}</option>
                    )}
                  </select>
                </label>
                <label>
                  <Req required>Number of Affected Families</Req>
                  <input type="number" min="0" required value={form.affectedFamilies} onChange={(e) => setForm({ ...form, affectedFamilies: e.target.value })} />
                </label>
              </div>
              <label>
                <Req required>Complete Address</Req>
                <input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Purok / Street, Barangay, City, Province" />
              </label>
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
              <p className="form-section-title">Representative Information</p>
              <div className="form-row">
                <label>
                  <Req required>Representative Full Name</Req>
                  <input required value={form.representativeName} onChange={(e) => setForm({ ...form, representativeName: e.target.value })} placeholder="Representative full name" />
                </label>
                <label>
                  <Req required>Position / Role</Req>
                  <select required value={form.representativePosition} onChange={(e) => setForm({ ...form, representativePosition: e.target.value })}>
                    <option value="">Select position…</option>
                    {REPRESENTATIVE_POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                    {form.representativePosition && !REPRESENTATIVE_POSITIONS.includes(form.representativePosition) && (
                      <option value={form.representativePosition}>{form.representativePosition}</option>
                    )}
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label>
                  <Req required>Contact Number</Req>
                  <input required value={form.representativePhone} onChange={(e) => setForm({ ...form, representativePhone: e.target.value })} placeholder="+63 9xx xxx xxxx" />
                </label>
                <label>
                  <Req required>Email Address</Req>
                  <input type="email" required value={form.representativeEmail} onChange={(e) => setForm({ ...form, representativeEmail: e.target.value })} placeholder="poc@email.com" />
                </label>
              </div>
              <label>
                Status
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label>
                Notes
                <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </label>
              <div className="admin-modal__actions">
                <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                <button type="button" className="btn btn--ghost" onClick={() => setMode(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
