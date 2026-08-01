import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Upload, FileCheck, Image, Calendar, MapPin, AlertTriangle, CheckCircle2,
  Clock3, Download, FileText, Camera, ClipboardSignature, Package,
} from 'lucide-react'
import { distributionsApi, getDistributionProofs, uploadDistributionProof } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { useHashScroll, useQueryFocus } from '../../hooks/useDeepLinkFocus'
import ApiState from '../../components/admin/shared/ApiState'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import { notify } from '../../utils/toast'

const PROOF_SLOTS = [
  {
    key: 'received_goods',
    label: 'Photos of received donations',
    hint: 'Show the goods after they arrived at your barangay.',
    icon: Package,
    accept: 'image/jpeg,image/png,image/webp,image/gif',
  },
  {
    key: 'distribution',
    label: 'Distribution / turnover photos',
    hint: 'Photos during handover or community distribution.',
    icon: Camera,
    accept: 'image/jpeg,image/png,image/webp,image/gif',
  },
  {
    key: 'acknowledgment',
    label: 'Signed acknowledgment',
    hint: 'Signed form or acknowledgment document (photo or PDF).',
    icon: ClipboardSignature,
    accept: 'image/jpeg,image/png,image/webp,image/gif,application/pdf',
  },
]

function requestOptionLabel(d) {
  const req = d.request
  if (req?.type) {
    const bits = [req.type]
    if (req.date) bits.push(req.date)
    let label = bits.join(' — ')
    if (req.status) label += ` (${req.status})`
    if (d.location) label += ` · ${d.location}`
    return label
  }
  if (d.eventName) return `${d.eventName} (${d.status})`
  const parts = [d.id, d.location, d.date].filter(Boolean)
  return `${parts.join(' · ')} — ${d.status}`
}

function proofTitle(p) {
  if (p.request?.type) return p.request.type
  return p.eventName || p.distributionCode || 'Proof submission'
}

function statusIcon(status) {
  if (status === 'Approved') return <CheckCircle2 size={16} />
  if (status === 'Rejected') return <AlertTriangle size={16} />
  return <Clock3 size={16} />
}

const emptyFiles = () => ({
  received_goods: null,
  distribution: null,
  acknowledgment: null,
})

export default function BeneficiaryProofsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [deepLink, setDeepLink] = useState(() => ({
    distributionId: searchParams.get('distributionId') || '',
    focus: searchParams.get('focus') || '',
  }))
  const preselectId = deepLink.distributionId

  const { data: events, loading: distLoading, error: distError, reload: reloadDist } = useApiList(() =>
    distributionsApi.listForProof()
  )
  const { data: proofs, loading: proofLoading, error: proofError, reload: reloadProofs } = useApiList(() =>
    getDistributionProofs()
  )

  const [form, setForm] = useState({
    distributionId: preselectId,
    notes: '',
    files: emptyFiles(),
  })
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const distributionId = searchParams.get('distributionId') || ''
    const focus = searchParams.get('focus') || ''
    if (distributionId || focus) {
      setDeepLink({ distributionId, focus })
    }
  }, [searchParams])

  useEffect(() => {
    if (preselectId) {
      setForm((prev) => ({ ...prev, distributionId: preselectId }))
    }
  }, [preselectId])

  const selected = events.find((d) => String(d.dbId) === String(form.distributionId))
  const selectedRequest = selected?.request || null
  const selectedCount = Object.values(form.files).filter(Boolean).length
  const focusHistory = deepLink.focus === 'history'
  const contentReady = !distLoading && !proofLoading

  useHashScroll({ enabled: contentReady, deps: [form.distributionId, events.length] })
  useQueryFocus(
    contentReady && Boolean(preselectId || focusHistory),
    focusHistory ? 'proof-history' : 'proof-submit-form',
  )

  const setFile = (key, file) => {
    setForm((prev) => ({
      ...prev,
      files: { ...prev.files, [key]: file || null },
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.distributionId) {
      setMessage('Please select the distribution you want to submit proof for.')
      return
    }
    if (selectedCount === 0) {
      setMessage('Please upload at least one supporting file (photo or document).')
      return
    }
    setUploading(true)
    setMessage('')
    try {
      const fd = new FormData()
      fd.append('distributionId', String(form.distributionId))
      fd.append('notes', form.notes)
      PROOF_SLOTS.forEach((slot) => {
        const file = form.files[slot.key]
        if (file) fd.append(slot.key, file)
      })
      const res = await uploadDistributionProof(fd)
      const count = res?.count || selectedCount
      setForm({ distributionId: form.distributionId, notes: '', files: emptyFiles() })
      setMessage(`${count} proof file(s) submitted. Status is Pending until Admin/Staff review.`)
      notify.success('Proof submitted for review.')
      if (preselectId) {
        setSearchParams({}, { replace: true })
      }
      reloadProofs()
      reloadDist()
    } catch (err) {
      setMessage(err.message)
      notify.error(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="proof-upload-page">
      <div className="proof-upload-card" id="proof-submit-form">
        <div className="proof-upload-card__header">
          <FileCheck size={22} />
          <div>
            <h2>Submit Distribution Proof</h2>
            <p>
              After confirming receipt, upload supporting proof: photos of received donations,
              distribution photos, and a signed acknowledgment. Admin/Staff will Approve or Reject.
            </p>
          </div>
        </div>

        <ApiState loading={distLoading} error={distError} onRetry={reloadDist}>
          <form onSubmit={handleSubmit} className="proof-upload-form">
            <label>
              Distribution / Relief Request <span className="proof-required">*</span>
              <select
                required
                value={form.distributionId}
                onChange={(e) => setForm({ ...form, distributionId: e.target.value })}
              >
                <option value="">Select the distribution…</option>
                {events.map((d) => (
                  <option key={d.dbId} value={d.dbId}>
                    {requestOptionLabel(d)}
                  </option>
                ))}
              </select>
              {events.length === 0 && (
                <span className="proof-field-hint">
                  No distributions are ready for proof yet. Confirm Received on the Distributions page first,
                  or wait until a delivery is assigned to your barangay.
                </span>
              )}
            </label>

            {selected && (
              <div className="proof-event-summary">
                <strong>
                  {selectedRequest?.type || selected.eventName || selected.id}
                </strong>
                {selectedRequest?.notes && (
                  <span className="proof-event-summary__row">
                    <FileText size={14} /> {selectedRequest.notes}
                  </span>
                )}
                {selectedRequest?.date && (
                  <span className="proof-event-summary__row">
                    <Calendar size={14} /> Requested {selectedRequest.date}
                    {selectedRequest.status ? ` · ${selectedRequest.status}` : ''}
                  </span>
                )}
                <span className="proof-event-summary__row">
                  <MapPin size={14} /> Delivery: {selected.location || '—'}
                </span>
                <span className="proof-event-summary__row">
                  <Calendar size={14} /> {selected.date || 'Schedule TBD'}
                  {selected.scheduleTime ? ` at ${selected.scheduleTime}` : ''}
                </span>
                {(selected.itemsSummary || selected.items) && (
                  <span className="proof-event-summary__items">{selected.itemsSummary || selected.items}</span>
                )}
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {selected.receiptStatus && <StatusBadge status={selected.receiptStatus} />}
                  <StatusBadge status={selected.proofStatus || selected.status} />
                </div>
              </div>
            )}

            <div className="proof-slots">
              <h3 className="proof-slots__title">Supporting proof</h3>
              <p className="proof-slots__hint">Upload at least one file. JPG, PNG, WEBP, GIF, or PDF — max 5MB each.</p>
              {PROOF_SLOTS.map((slot) => {
                const Icon = slot.icon
                const file = form.files[slot.key]
                return (
                  <label key={slot.key} className={`proof-slot${file ? ' proof-slot--filled' : ''}`}>
                    <span className="proof-slot__head">
                      <Icon size={18} />
                      <span>
                        <strong>{slot.label}</strong>
                        <em>{slot.hint}</em>
                      </span>
                    </span>
                    <input
                      type="file"
                      accept={slot.accept}
                      onChange={(e) => setFile(slot.key, e.target.files?.[0] || null)}
                    />
                    {file ? (
                      <span className="proof-file-name">
                        <Image size={14} /> {file.name}
                      </span>
                    ) : (
                      <span className="proof-slot__choose">Choose file…</span>
                    )}
                  </label>
                )
              })}
            </div>

            <label>
              Remarks <span className="req-optional">(optional)</span>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Brief description: e.g. relief goods received at barangay hall on [date]…"
              />
            </label>

            {message && (
              <p className={`proof-message${/success|Pending|submitted/i.test(message) ? ' proof-message--success' : ' proof-message--error'}`}>
                {message}
              </p>
            )}

            <button type="submit" className="btn btn--primary" disabled={uploading || events.length === 0}>
              <Upload size={16} />
              {uploading ? 'Uploading…' : `Submit Proof${selectedCount ? ` (${selectedCount})` : ''}`}
            </button>
          </form>
        </ApiState>
      </div>

      <div className="proof-history" id="proof-history">
        <h3>Your Proof Submissions</h3>
        <ApiState loading={proofLoading} error={proofError} onRetry={reloadProofs}>
          {proofs.length === 0 ? (
            <p className="proof-empty">No proofs submitted yet.</p>
          ) : (
            <ul className="proof-list proof-list--rich">
              {proofs.map((p) => (
                <li key={p.id} className={`proof-list__item proof-list__item--${(p.status || 'Pending').toLowerCase()}`}>
                  <div className="proof-list__preview">
                    {p.isImage ? (
                      <a href={p.fileUrl} target="_blank" rel="noreferrer">
                        <img src={p.fileUrl} alt={p.fileName} />
                      </a>
                    ) : (
                      <div className="proof-list__doc"><FileCheck size={22} /></div>
                    )}
                  </div>
                  <div className="proof-list__info">
                    <strong>{proofTitle(p)}</strong>
                    {p.categoryLabel && (
                      <span className="proof-list__category">{p.categoryLabel}</span>
                    )}
                    <span>
                      {p.request?.date ? `Requested ${p.request.date}` : null}
                      {p.request?.date && (p.distributionLocation || p.distributionDate) ? ' · ' : ''}
                      {p.distributionLocation || ''}
                      {p.distributionDate && p.distributionDate !== '—' ? ` · ${p.distributionDate}` : ''}
                    </span>
                    <span className="proof-list__date">Submitted {p.submittedAt}</span>
                    {p.notes && <span className="proof-list__notes">{p.notes}</span>}
                    {p.status === 'Rejected' && p.reviewRemarks && (
                      <div className="proof-list__reject">
                        <AlertTriangle size={14} />
                        <div>
                          <strong>Rejected — please resubmit</strong>
                          <p>{p.reviewRemarks}</p>
                        </div>
                      </div>
                    )}
                    {p.status === 'Approved' && (
                      <span className="proof-list__ok">Approved{p.reviewedAt ? ` · ${p.reviewedAt}` : ''}</span>
                    )}
                  </div>
                  <div className="proof-list__actions">
                    <span className="proof-status-pill">
                      {statusIcon(p.status)}
                      <StatusBadge status={p.status} />
                    </span>
                    <a href={p.fileUrl} target="_blank" rel="noreferrer" className="btn btn--sm btn--outline">
                      <Download size={13} /> View
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ApiState>
      </div>
    </div>
  )
}
