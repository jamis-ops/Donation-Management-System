import { useState } from 'react'
import { Award, Download, Eye, Printer, X, Share2, FileText, BadgeCheck } from 'lucide-react'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import CertificateView from '../../components/shared/CertificateView'
import { printCertificate } from '../../components/shared/printCertificate'
import { certificatesApi, donationsApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'

const CERT_TYPE_CONFIG = {
  'Certificate of Appreciation': { color: 'gold', icon: Award },
  'Certificate of Donation': { color: 'crimson', icon: FileText },
  'Certificate of Participation': { color: 'blue', icon: FileText },
  'Annual Summary': { color: 'purple', icon: BadgeCheck },
  'Annual Summary Receipt': { color: 'purple', icon: BadgeCheck },
  // Legacy type still shown if present in older records
  'Tax Receipt': { color: 'crimson', icon: FileText },
}

function displayCertType(type) {
  if (type === 'Tax Receipt') return 'Donation Certificate'
  if (type === 'Annual Summary Receipt') return 'Annual Summary'
  return type
}

export default function DonorCertificatesPage() {
  const { data, loading, error, reload } = useApiList(() => certificatesApi.list())
  const { data: donations } = useApiList(() => donationsApi.list())
  const [preview, setPreview] = useState(null)
  const [showRequest, setShowRequest] = useState(false)
  const [form, setForm] = useState({ type: 'Certificate of Appreciation', reference: '' })
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [shareModalOpen, setShareModalOpen] = useState(null)

  const eligibleDonations = donations.filter((d) => d.status !== 'Pending Verification' && d.status !== 'Cancelled')

  const normalizedType = (type) => {
    if (type === 'Tax Receipt') return 'Certificate of Donation'
    if (type === 'Annual Summary Receipt') return 'Annual Summary'
    return type
  }

  const filteredCerts = data.filter((cert) => {
    if (typeFilter === 'All') return true
    return normalizedType(cert.type) === typeFilter
  })

  const typeCounts = {
    All: data.length,
    'Certificate of Appreciation': data.filter((c) => normalizedType(c.type) === 'Certificate of Appreciation').length,
    'Certificate of Donation': data.filter((c) => normalizedType(c.type) === 'Certificate of Donation').length,
    'Annual Summary': data.filter((c) => normalizedType(c.type) === 'Annual Summary').length,
  }

  const statusCounts = {
    Generated: data.filter((c) => c.status === 'Generated').length,
    Processing: data.filter((c) => c.status === 'Processing').length,
  }

  const handleRequest = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await certificatesApi.create({ type: form.type, reference: form.reference || undefined })
      setShowRequest(false)
      setForm({ type: 'Certificate of Appreciation', reference: '' })
      setNotice('Your certificate request has been sent. You will be notified once it is ready.')
      reload()
    } catch (err) {
      alert(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleShare = (cert) => {
    setShareModalOpen(cert)
  }

  const handleCopyLink = (cert) => {
    const link = `${window.location.origin}/certificates/verify/${cert.reference}`
    navigator.clipboard.writeText(link)
    alert('Certificate verification link copied to clipboard!')
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

      <div className="donor-cert-summary">
        <div className="donor-cert-summary-card">
          <div className="donor-cert-summary-card__icon">
            <BadgeCheck size={20} />
          </div>
          <div className="donor-cert-summary-card__content">
            <span className="donor-cert-summary-card__value">{statusCounts.Generated}</span>
            <span className="donor-cert-summary-card__label">Ready to Download</span>
          </div>
        </div>
        <div className="donor-cert-summary-card donor-cert-summary-card--blue">
          <div className="donor-cert-summary-card__icon">
            <FileText size={20} />
          </div>
          <div className="donor-cert-summary-card__content">
            <span className="donor-cert-summary-card__value">{statusCounts.Processing}</span>
            <span className="donor-cert-summary-card__label">Being Processed</span>
          </div>
        </div>
        <div className="donor-cert-summary-card donor-cert-summary-card--green">
          <div className="donor-cert-summary-card__icon">
            <Award size={20} />
          </div>
          <div className="donor-cert-summary-card__content">
            <span className="donor-cert-summary-card__value">{data.length}</span>
            <span className="donor-cert-summary-card__label">Total Certificates</span>
          </div>
        </div>
      </div>

      <section className="portal-panel">
        <div className="portal-panel__header">
          <h2>Certificates</h2>
          <button type="button" className="btn btn--sm btn--primary" onClick={() => setShowRequest(true)}>
            + Request Certificate
          </button>
        </div>

        <div className="portal-filter-bar portal-filter-bar--simple">
          <div className="portal-filter-bar__filters">
            {Object.keys(typeCounts).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setTypeFilter(type)}
                className={`portal-filter-btn ${typeFilter === type ? 'active' : ''}`}
              >
                {type} <span className="portal-filter-btn__count">({typeCounts[type]})</span>
              </button>
            ))}
          </div>
        </div>

        {filteredCerts.length === 0 ? (
          <div className="cert-empty">
            <Award size={36} />
            <p>
              {typeFilter !== 'All'
                ? `No ${typeFilter.toLowerCase()} found`
                : 'No certificates yet. Request one for a verified donation.'}
            </p>
          </div>
        ) : (
          <div className="cert-grid cert-grid--enhanced">
            {filteredCerts.map((c) => {
              const config = CERT_TYPE_CONFIG[c.type] || { color: 'gray', icon: FileText }
              const Icon = config.icon
              return (
                <div key={c.id} className={`cert-card cert-card--${config.color}`}>
                  <div className={`cert-card__icon cert-card__icon--${config.color}`}>
                    <Icon size={22} />
                  </div>
                  <div className="cert-card__body">
                    <strong>{displayCertType(c.type)}</strong>
                    <span className="cert-card__period">{c.period}</span>
                    {c.amount && (
                      <span className="cert-card__amount">{c.amount}</span>
                    )}
                    {c.reference && (
                      <span className="cert-card__reference">Ref: {c.reference}</span>
                    )}
                    <span className="cert-card__date">
                      {c.date ? `Issued: ${c.date}` : 'Date pending'}
                    </span>
                  </div>
                  <div className="cert-card__side">
                    <StatusBadge status={c.status} />
                    {ready(c) ? (
                      <div className="cert-card__actions">
                        <button
                          type="button"
                          className="btn btn--sm btn--outline"
                          onClick={() => setPreview(c)}
                          title="Preview certificate"
                        >
                          <Eye size={14} /> View
                        </button>
                        <button
                          type="button"
                          className="btn btn--sm btn--outline"
                          onClick={() => handleShare(c)}
                          title="Share certificate"
                        >
                          <Share2 size={14} /> Share
                        </button>
                        <button
                          type="button"
                          className="btn btn--sm btn--primary"
                          onClick={() => printCertificate(c)}
                          title="Download PDF"
                        >
                          <Download size={14} /> PDF
                        </button>
                      </div>
                    ) : (
                      <span className="cert-card__pending">Being processed</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {showRequest && (
        <div className="admin-modal-overlay" onClick={() => setShowRequest(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Request a Certificate</h2>
            <form onSubmit={handleRequest}>
              <label>
                Document Type
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option>Certificate of Appreciation</option>
                  <option>Certificate of Donation</option>
                </select>
              </label>
              <label>
                For Donation
                <select value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })}>
                  <option value="">General (no specific donation)</option>
                  {eligibleDonations.map((d) => (
                    <option key={d.dbId} value={d.trackingCode}>
                      {d.trackingCode} — {d.amount} ({d.date})
                    </option>
                  ))}
                </select>
              </label>
              <div className="admin-modal__actions">
                <button type="submit" className="btn btn--primary" disabled={busy}>
                  {busy ? 'Sending...' : 'Send Request'}
                </button>
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
              <h2>{displayCertType(preview.type)}</h2>
              <div className="cert-preview-toolbar__actions">
                <button type="button" className="btn btn--sm btn--outline" onClick={() => printCertificate(preview)}>
                  <Printer size={14} /> Print
                </button>
                <button type="button" className="btn btn--sm btn--outline" onClick={() => handleShare(preview)}>
                  <Share2 size={14} /> Share
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

      {shareModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setShareModalOpen(null)}>
          <div className="admin-modal admin-modal--share" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal__header">
              <h3>Share Certificate</h3>
              <button type="button" onClick={() => setShareModalOpen(null)} className="admin-modal__close">×</button>
            </div>
            <div className="admin-modal__body">
              <div className="share-modal-content">
                <div className="share-modal-cert-info">
                  <Award size={24} />
                  <div>
                    <strong>{displayCertType(shareModalOpen.type)}</strong>
                    <span>{shareModalOpen.period}</span>
                  </div>
                </div>

                <div className="share-modal-section">
                  <h4>Copy verification link</h4>
                  <div className="share-modal-link">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/certificates/verify/${shareModalOpen.reference}`}
                      className="share-modal-input"
                    />
                    <button
                      type="button"
                      className="btn btn--sm btn--primary"
                      onClick={() => handleCopyLink(shareModalOpen)}
                    >
                      Copy Link
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </ApiState>
  )
}
