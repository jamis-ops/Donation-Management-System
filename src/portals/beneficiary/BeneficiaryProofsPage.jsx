import { useState } from 'react'
import { Upload, FileCheck, Image, Calendar, MapPin, AlertTriangle, CheckCircle2, Clock3, Download } from 'lucide-react'
import { distributionsApi, getDistributionProofs, uploadDistributionProof } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import ApiState from '../../components/admin/shared/ApiState'
import StatusBadge from '../../components/admin/shared/StatusBadge'

function eventLabel(d) {
  if (d.eventName) return `${d.eventName} (${d.status})`
  const parts = [d.id, d.location, d.date].filter(Boolean)
  if (d.program) parts.push(d.program)
  return `${parts.join(' · ')} — ${d.status}`
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.distributionId) {
      setMessage('Please select a distribution event before submitting proof.')
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
            <p>Select your distribution event and upload photos or documents. An administrator will Approve or Reject your submission.</p>
          </div>
        </div>

        <ApiState loading={distLoading} error={distError} onRetry={reloadDist}>
          <form onSubmit={handleSubmit} className="proof-upload-form">
            <label>
              Distribution Event <span className="proof-required">*</span>
              <select
                required
                value={form.distributionId}
                onChange={(e) => setForm({ ...form, distributionId: e.target.value })}
              >
                <option value="">Select distribution event…</option>
                {events.map((d) => (
                  <option key={d.dbId} value={d.dbId}>
                    {eventLabel(d)}
                  </option>
                ))}
              </select>
              {events.length === 0 && (
                <span className="proof-field-hint">
                  No distribution events are available right now. If a previous proof was rejected, resubmit after the admin updates the event — or ask them to assign a distribution to your barangay.
                </span>
              )}
            </label>

            {selected && (
              <div className="proof-event-summary">
                <strong>{selected.eventName || selected.id}</strong>
                <span className="proof-event-summary__row"><MapPin size={14} /> {selected.location}</span>
                <span className="proof-event-summary__row">
                  <Calendar size={14} /> {selected.date}
                  {selected.scheduleTime ? ` at ${selected.scheduleTime}` : ''}
                </span>
                {selected.itemsSummary && <span className="proof-event-summary__items">{selected.itemsSummary}</span>}
                <StatusBadge status={selected.status} />
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
                    <strong>{p.eventName || p.distributionCode}</strong>
                    <span>
                      {p.distributionLocation}
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
