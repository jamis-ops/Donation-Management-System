import { useState } from 'react'
import { Upload, FileCheck, Image, Calendar, MapPin, AlertTriangle, CheckCircle2, Clock3, Download, FileText } from 'lucide-react'
import { distributionsApi, getDistributionProofs, uploadDistributionProof } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import ApiState from '../../components/admin/shared/ApiState'
import StatusBadge from '../../components/admin/shared/StatusBadge'

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
  // Fallback when no linked request
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

export default function BeneficiaryProofsPage() {
  const { data: events, loading: distLoading, error: distError, reload: reloadDist } = useApiList(() =>
    distributionsApi.listForProof()
  )
  const { data: proofs, loading: proofLoading, error: proofError, reload: reloadProofs } = useApiList(() =>
    getDistributionProofs()
  )
  const [form, setForm] = useState({ distributionId: '', notes: '', file: null })
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')

  const selected = events.find((d) => String(d.dbId) === String(form.distributionId))
  const selectedRequest = selected?.request || null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.distributionId) {
      setMessage('Please select the relief request you want to submit proof for.')
      return
    }
    if (!form.file) {
      setMessage('Please upload a photo or document.')
      return
    }
    setUploading(true)
    setMessage('')
    try {
      const fd = new FormData()
      // Still attach to the matched distribution behind the scenes
      fd.append('distributionId', String(form.distributionId))
      fd.append('notes', form.notes)
      fd.append('proof', form.file)
      await uploadDistributionProof(fd)
      setForm({ distributionId: '', notes: '', file: null })
      setMessage('Proof submitted successfully. Status is now Pending until an administrator reviews it.')
      reloadProofs()
      reloadDist()
    } catch (err) {
      setMessage(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="proof-upload-page">
      <div className="proof-upload-card">
        <div className="proof-upload-card__header">
          <FileCheck size={22} />
          <div>
            <h2>Submit Distribution Proof</h2>
            <p>
              Select the relief request you submitted, then upload photos or documents showing the goods were received.
              An administrator will Approve or Reject your submission.
            </p>
          </div>
        </div>

        <ApiState loading={distLoading} error={distError} onRetry={reloadDist}>
          <form onSubmit={handleSubmit} className="proof-upload-form">
            <label>
              Your Relief Request <span className="proof-required">*</span>
              <select
                required
                value={form.distributionId}
                onChange={(e) => setForm({ ...form, distributionId: e.target.value })}
              >
                <option value="">Select the request you made…</option>
                {events.map((d) => (
                  <option key={d.dbId} value={d.dbId}>
                    {requestOptionLabel(d)}
                  </option>
                ))}
              </select>
              {events.length === 0 && (
                <span className="proof-field-hint">
                  No requests are ready for proof yet. Proof opens after your request has been allocated and a delivery is assigned to your barangay. If a previous proof was rejected, you can resubmit once the delivery is awaiting proof again.
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
                {selected.itemsSummary && (
                  <span className="proof-event-summary__items">{selected.itemsSummary}</span>
                )}
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {selectedRequest?.status && <StatusBadge status={selectedRequest.status} />}
                  <StatusBadge status={selected.proofStatus || selected.status} />
                </div>
              </div>
            )}

            <label className="proof-file-label">
              <Image size={18} />
              Photo or Document (JPG, PNG, PDF — max 5MB)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
              />
              {form.file && <span className="proof-file-name">{form.file.name}</span>}
            </label>

            <label>
              Notes (optional)
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Brief description: e.g. relief goods received at barangay hall…"
              />
            </label>

            {message && (
              <p className={`proof-message${message.includes('success') || message.includes('Pending') ? ' proof-message--success' : ' proof-message--error'}`}>
                {message}
              </p>
            )}

            <button type="submit" className="btn btn--primary" disabled={uploading || events.length === 0}>
              <Upload size={16} />
              {uploading ? 'Uploading...' : 'Submit Proof'}
            </button>
          </form>
        </ApiState>
      </div>

      <div className="proof-history">
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
                    <span>
                      {p.request?.date ? `Requested ${p.request.date}` : null}
                      {p.request?.date && (p.distributionLocation || p.distributionDate) ? ' · ' : ''}
                      {p.distributionLocation || ''}
                      {p.distributionDate && p.distributionDate !== '—' ? ` · ${p.distributionDate}` : ''}
                    </span>
                    <span className="proof-list__date">Submitted {p.submittedAt}</span>
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
