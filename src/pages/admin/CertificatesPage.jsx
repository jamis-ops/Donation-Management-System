import { useState } from 'react'
import { Award, Download, Eye, Pencil, Printer, Trash2 } from 'lucide-react'
import { certificatesApi, volunteersApi, donorsApi, donationsApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { useFilters } from '../../hooks/useFilters'
import PageHeader from '../../components/admin/shared/PageHeader'
import DataTable from '../../components/admin/shared/DataTable'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import FilterBar from '../../components/admin/shared/FilterBar'
import CertificateView from '../../components/shared/CertificateView'
import { printCertificate } from '../../components/shared/printCertificate'
import ModalHeader from '../../components/admin/shared/ModalHeader'
import { notify } from '../../utils/toast'

const CERT_TYPES = [
  'Certificate of Donation',
  'Certificate of Volunteer Service',
  'Certificate of Participation',
  'Certificate of Appreciation',
]

const STATUS_OPTIONS = ['Requested', 'Pending', 'Generated', 'Released']

const filterConfig = {
  searchKeys: ['id', 'recipient', 'reference', 'type'],
  filters: [
    { key: 'status', label: 'Status' },
    { key: 'type', label: 'Type' },
    { key: 'recipientType', label: 'Recipient', allLabel: 'All Recipients' },
  ],
  dateKey: 'date',
}

const emptyForm = {
  type: 'Certificate of Donation',
  recipientType: 'Donor',
  recipientKey: '',
  recipient: '',
  reference: '',
  details: '',
  signatoryName: 'Maria Dela Cruz',
  signatoryTitle: 'Executive Director',
  certDate: new Date().toISOString().slice(0, 10),
  status: 'Generated',
}

export default function CertificatesPage() {
  const { data, loading, error, reload } = useApiList(() => certificatesApi.list())
  const { data: volunteers } = useApiList(() => volunteersApi.list())
  const { data: donors } = useApiList(() => donorsApi.list())
  const { data: donations } = useApiList(() => donationsApi.list())

  const [showForm, setShowForm] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [preview, setPreview] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const filters = useFilters(data, filterConfig)

  const openCreate = () => {
    setEditRow(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (row) => {
    setEditRow(row)
    setForm({
      type: row.type,
      recipientType: row.recipientType || 'Donor',
      recipientKey: '',
      recipient: row.recipient,
      reference: row.reference || '',
      details: row.details || '',
      signatoryName: row.signatoryName || 'Maria Dela Cruz',
      signatoryTitle: row.signatoryTitle || 'Executive Director',
      certDate: row.certDate || new Date().toISOString().slice(0, 10),
      status: row.status,
    })
    setShowForm(true)
  }

  // Auto-populate recipient info once a name is picked.
  const handleRecipientPick = (key) => {
    if (!key) {
      setForm({ ...form, recipientKey: '', recipient: '', reference: '', details: '' })
      return
    }

    if (form.recipientType === 'Volunteer') {
      const vol = volunteers.find((v) => String(v.dbId) === key)
      if (!vol) return
      setForm({
        ...form,
        recipientKey: key,
        recipient: vol.name,
        reference: vol.id,
        type: CERT_TYPES.includes(form.type) && form.type.includes('Volunteer') ? form.type : 'Certificate of Volunteer Service',
        details: `In recognition of ${vol.hours} hours of dedicated volunteer service rendered to Rise Above Foundation programs, touching countless lives in our communities.`,
      })
    } else {
      const donor = donors.find((d) => String(d.dbId) === key)
      if (!donor) return
      const latest = donations.find((dn) => dn.donor === donor.name)
      setForm({
        ...form,
        recipientKey: key,
        recipient: donor.name,
        reference: latest?.trackingCode || '',
        type: form.type.includes('Volunteer') ? 'Certificate of Donation' : form.type,
        details: latest
          ? `In grateful appreciation of the generous donation of ${latest.amount} (${latest.trackingCode}) made on ${latest.date}, supporting relief efforts for communities in need.`
          : `In grateful appreciation of generous contributions totaling ${donor.totalDonated}, supporting relief efforts for communities in need.`,
      })
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.recipient.trim()) {
      notify.warning('Please select or enter a recipient.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        type: form.type,
        recipientType: form.recipientType,
        recipient: form.recipient.trim(),
        reference: form.reference || null,
        details: form.details,
        signatoryName: form.signatoryName,
        signatoryTitle: form.signatoryTitle,
        certDate: form.certDate,
        status: form.status,
      }
      if (editRow) {
        await certificatesApi.update(editRow.dbId, payload)
        notify.success('Certificate updated.')
      } else {
        await certificatesApi.create(payload)
        notify.success('Certificate created.')
      }
      setShowForm(false)
      reload()
    } catch (err) {
      notify.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete certificate ${row.id} for ${row.recipient}?`)) return
    try {
      await certificatesApi.remove(row.dbId)
      notify.success('Certificate deleted.')
      reload()
    } catch (err) {
      notify.error(err.message)
    }
  }

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'type', label: 'Type' },
    { key: 'recipient', label: 'Recipient' },
    { key: 'recipientType', label: 'For' },
    { key: 'reference', label: 'Reference' },
    { key: 'date', label: 'Date' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions">
          <button type="button" className="btn btn--sm btn--outline" title="Preview" onClick={(e) => { e.stopPropagation(); setPreview(row) }}>
            <Eye size={14} />
          </button>
          <button type="button" className="btn btn--sm btn--outline" title="Download / Print" onClick={(e) => { e.stopPropagation(); printCertificate(row) }}>
            <Download size={14} />
          </button>
          <button type="button" className="btn btn--sm btn--outline" title="Edit" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>
            <Pencil size={14} />
          </button>
          <button type="button" className="btn btn--sm btn--ghost" title="Delete" onClick={(e) => { e.stopPropagation(); handleDelete(row) }}>
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ]

  const requestedCount = data.filter((c) => c.status === 'Requested').length

  return (
    <>
      <PageHeader
        title="Certificate Management"
        description="Create, edit, preview, and release certificates. Select a recipient and the details fill in automatically."
        actions={<button type="button" className="btn btn--primary" onClick={openCreate}><Award size={15} /> New Certificate</button>}
      />

      <div className="admin-stats-grid admin-stats-grid--compact">
        <div className="admin-stat-card"><span className="admin-stat-card__value">{data.length}</span><span className="admin-stat-card__label">Total Certificates</span></div>
        <div className="admin-stat-card"><span className="admin-stat-card__value">{data.filter((c) => c.status === 'Generated').length}</span><span className="admin-stat-card__label">Generated</span></div>
        <div className="admin-stat-card"><span className="admin-stat-card__value">{requestedCount}</span><span className="admin-stat-card__label">Pending Requests</span></div>
      </div>

      <FilterBar controller={filters} searchPlaceholder="Search by ID, recipient, or reference..." />

      <ApiState loading={loading} error={error} onRetry={reload}>
        <DataTable
          columns={columns}
          data={filters.filtered}
          onRowClick={setPreview}
          pageSize={10}
          resetKey={`${filters.search}|${JSON.stringify(filters.values)}`}
        />
      </ApiState>

      {showForm && (
        <div className="admin-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title={editRow ? `Edit Certificate ${editRow.id}` : 'New Certificate'}
              onClose={() => setShowForm(false)}
            />
            <form onSubmit={handleSave}>
              <div className="form-row">
                <label>Recipient Type
                  <select
                    value={form.recipientType}
                    onChange={(e) => setForm({ ...form, recipientType: e.target.value, recipientKey: '', recipient: '', reference: '', details: '' })}
                  >
                    <option value="Donor">Donor</option>
                    <option value="Volunteer">Volunteer</option>
                  </select>
                </label>
                <label>Select {form.recipientType}
                  <select value={form.recipientKey} onChange={(e) => handleRecipientPick(e.target.value)}>
                    <option value="">Choose a {form.recipientType.toLowerCase()}...</option>
                    {(form.recipientType === 'Volunteer' ? volunteers : donors).map((p) => (
                      <option key={p.dbId} value={p.dbId}>
                        {p.name}{form.recipientType === 'Volunteer' ? ` — ${p.hours} hrs` : ` — ${p.totalDonated}`}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="form-row">
                <label>Recipient Name
                  <input required value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} placeholder="Auto-filled after selecting, or type manually" />
                </label>
                <label>Reference Code
                  <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="e.g. DON-XXXX or VOL-XXX" />
                </label>
              </div>

              <div className="form-row">
                <label>Certificate Type
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    {CERT_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </label>
                <label>Date Issued
                  <input type="date" value={form.certDate} onChange={(e) => setForm({ ...form, certDate: e.target.value })} />
                </label>
              </div>

              <label>Certificate Text
                <textarea rows={3} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} placeholder="Auto-generated when you pick a recipient — edit freely." />
              </label>

              <div className="form-row">
                <label>Signatory Name
                  <input value={form.signatoryName} onChange={(e) => setForm({ ...form, signatoryName: e.target.value })} />
                </label>
                <label>Signatory Title
                  <input value={form.signatoryTitle} onChange={(e) => setForm({ ...form, signatoryTitle: e.target.value })} />
                </label>
              </div>

              <label>Status
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>

              <div className="admin-modal__actions">
                <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving...' : editRow ? 'Save Changes' : 'Create Certificate'}</button>
                <button
                  type="button"
                  className="btn btn--outline"
                  onClick={() => setPreview({ ...form, id: editRow?.id || 'CERT-PREVIEW', date: form.certDate })}
                >
                  <Eye size={14} /> Preview
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {preview && (
        <div className="admin-modal-overlay" onClick={() => setPreview(null)}>
          <div className="admin-modal admin-modal--cert" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title={preview.type} onClose={() => setPreview(null)} />
            <div className="cert-preview-toolbar">
              <div className="cert-preview-toolbar__actions">
                <button type="button" className="btn btn--sm btn--outline" onClick={() => printCertificate(preview)}>
                  <Printer size={14} /> Print
                </button>
                <button type="button" className="btn btn--sm btn--primary" onClick={() => printCertificate(preview)}>
                  <Download size={14} /> Download PDF
                </button>
              </div>
            </div>
            <CertificateView cert={preview} />
          </div>
        </div>
      )}
    </>
  )
}
