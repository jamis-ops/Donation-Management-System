import { useState } from 'react'
import { Upload, FileCheck, Image } from 'lucide-react'
import { distributionsApi, getDistributionProofs, uploadDistributionProof } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import ApiState from '../../components/admin/shared/ApiState'
import StatusBadge from '../../components/admin/shared/StatusBadge'

export default function BeneficiaryProofsPage() {
  const { data: distributions, loading: distLoading, error: distError, reload: reloadDist } = useApiList(() => distributionsApi.list())
  const { data: proofs, loading: proofLoading, error: proofError, reload: reloadProofs } = useApiList(() => getDistributionProofs())
  const [form, setForm] = useState({ distributionId: '', notes: '', file: null })
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')

  const eligible = distributions.filter((d) =>
    ['Delivered', 'Awaiting Proof', 'In Transit'].includes(d.status)
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.distributionId || !form.file) {
      setMessage('Please select a distribution and upload a file.')
      return
    }
    setUploading(true)
    setMessage('')
    try {
      const fd = new FormData()
      fd.append('distributionId', form.distributionId)
      fd.append('notes', form.notes)
      fd.append('proof', form.file)
      await uploadDistributionProof(fd)
      setForm({ distributionId: '', notes: '', file: null })
      setMessage('Proof submitted successfully. The organization has been notified.')
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
            <p>Upload photos or documents confirming your barangay received the relief goods. The organization will be notified immediately.</p>
          </div>
        </div>

        <ApiState loading={distLoading} error={distError} onRetry={reloadDist}>
          <form onSubmit={handleSubmit} className="proof-upload-form">
            <label>
              Distribution Event
              <select
                required
                value={form.distributionId}
                onChange={(e) => setForm({ ...form, distributionId: e.target.value })}
              >
                <option value="">Select distribution</option>
                {eligible.map((d) => (
                  <option key={d.dbId} value={d.dbId}>
                    {d.id} — {d.location} ({d.date}) — {d.status}
                  </option>
                ))}
              </select>
            </label>

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
                placeholder="Brief description: e.g. relief goods received at barangay hall, 50 family packs distributed..."
              />
            </label>

            {message && (
              <p className={`proof-message${message.includes('success') ? ' proof-message--success' : ' proof-message--error'}`}>
                {message}
              </p>
            )}

            <button type="submit" className="btn btn--primary" disabled={uploading}>
              <Upload size={16} />
              {uploading ? 'Uploading...' : 'Submit Proof'}
            </button>
          </form>
        </ApiState>
      </div>

      <div className="proof-history">
        <h3>Submitted Proofs</h3>
        <ApiState loading={proofLoading} error={proofError} onRetry={reloadProofs}>
          {proofs.length === 0 ? (
            <p className="proof-empty">No proofs submitted yet.</p>
          ) : (
            <ul className="proof-list">
              {proofs.map((p) => (
                <li key={p.id} className="proof-list__item">
                  <div>
                    <strong>{p.distributionCode}</strong>
                    <span>{p.fileName}</span>
                    <span className="proof-list__date">{p.submittedAt}</span>
                  </div>
                  <div className="proof-list__actions">
                    <StatusBadge status={p.status} />
                    <a href={p.fileUrl} target="_blank" rel="noreferrer" className="btn btn--sm btn--outline">View File</a>
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
