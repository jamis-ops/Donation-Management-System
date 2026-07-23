import { useState } from 'react'
import { Award, Download, Eye, Printer, X } from 'lucide-react'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import CertificateView from '../../components/shared/CertificateView'
import { printCertificate } from '../../components/shared/printCertificate'
import { certificatesApi, donationsApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'

export default function DonorCertificatesPage() {
  const { data, loading, error, reload } = useApiList(() => certificatesApi.list())
  const { data: donations } = useApiList(() => donationsApi.list())
  const [preview, setPreview] = useState(null)
  const [showRequest, setShowRequest] = useState(false)
  const [form, setForm] = useState({ type: 'Certificate of Donation', reference: '' })
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const eligibleDonations = donations.filter((d) => d.status !== 'Pending Verification')

  const handleRequest = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await certificatesApi.create({ type: form.type, reference: form.reference || undefined })
      setShowRequest(false)
      setForm({ type: 'Certificate of Donation', reference: '' })
      setNotice('Your certificate request has been sent. You will be notified once it is ready.')
      reload()
    } catch (err) {
      alert(err.message)
    } finally {
      setBusy(false)
    }
  }

  const ready = (c) => c.status === 'Generated'

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      {notice && (
        <div className="portal-notice">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss"><X size={14} /></button>
        </div>
      )}

      <section className="portal-panel">
        <div className="portal-panel__header">
          <h2>Certificates</h2>
          <button type="button" className="btn btn--sm btn--primary" onClick={() => setShowRequest(true)}>
            + Request Certificate
          </button>
        </div>

        {data.length === 0 ? (
          <div className="cert-empty">
            <Award size={36} />
            <p>No certificates yet. Request one for a verified donation.</p>
          </div>
        ) : (
          <div className="cert-grid">
            {data.map((c) => (
              <div key={c.id} className="cert-card">
                <div className="cert-card__icon"><Award size={22} /></div>
                <div className="cert-card__body">
                  <strong>{c.type}</strong>
                  <span>{c.id}{c.reference ? ` · Ref: ${c.reference}` : ''}</span>
                  <span className="cert-card__date">{c.date || 'Date pending'}</span>
                </div>
                <div className="cert-card__side">
                  <StatusBadge status={c.status} />
                  {ready(c) ? (
                    <div className="cert-card__actions">
                      <button type="button" className="btn btn--sm btn--outline" onClick={() => setPreview(c)}>
                        <Eye size={14} /> View
                      </button>
                      <button type="button" className="btn btn--sm btn--primary" onClick={() => printCertificate(c)}>
                        <Download size={14} /> PDF
                      </button>
                    </div>
                  ) : (
                    <span className="cert-card__pending">Being processed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showRequest && (
        <div className="admin-modal-overlay" onClick={() => setShowRequest(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Request a Certificate</h2>
            <form onSubmit={handleRequest}>
              <label>Document Type
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option>Certificate of Donation</option>
                  <option>Certificate of Appreciation</option>
                </select>
              </label>
              <label>For Donation
                <select value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })}>
                  <option value="">General (no specific donation)</option>
                  {eligibleDonations.map((d) => (
                    <option key={d.dbId} value={d.trackingCode}>
                      {d.trackingCode} — {d.amount} ({d.date})
                    </option>
                  ))}
                </select>
              </label>
              <p className="portal-hint">Only verified donations can be linked to a certificate.</p>
              <div className="admin-modal__actions">
                <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Sending...' : 'Send Request'}</button>
                <button type="button" className="btn btn--ghost" onClick={() => setShowRequest(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {preview && (
        <div className="admin-modal-overlay" onClick={() => setPreview(null)}>
          <div className="admin-modal admin-modal--cert" onClick={(e) => e.stopPropagation()}>
            <div className="cert-preview-toolbar">
              <h2>{preview.type}</h2>
              <div className="cert-preview-toolbar__actions">
                <button type="button" className="btn btn--sm btn--outline" onClick={() => printCertificate(preview)}>
                  <Printer size={14} /> Print
                </button>
                <button type="button" className="btn btn--sm btn--primary" onClick={() => printCertificate(preview)}>
                  <Download size={14} /> Download PDF
                </button>
                <button type="button" className="btn btn--sm btn--ghost" onClick={() => setPreview(null)}>Close</button>
              </div>
            </div>
            <CertificateView cert={preview} />
          </div>
        </div>
      )}
    </ApiState>
  )
}
