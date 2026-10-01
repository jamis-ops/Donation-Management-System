import { useState, useMemo } from 'react'
import { Award, Download, Eye, Printer, Share2, BadgeCheck, FileText, X } from 'lucide-react'
import StatusBadge from '../../admin/components/shared/StatusBadge'
import ApiState from '../../admin/components/shared/ApiState'
import CertificateView from '../../components/shared/CertificateView'
import { printCertificate } from '../../components/shared/printCertificate'
import { certificatesApi, tasksApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { usePagination, DEFAULT_PAGE_SIZE } from '../../hooks/usePagination'
import Pagination from '../../admin/components/shared/Pagination'
import ModalHeader from '../../admin/components/shared/ModalHeader'
import { notify, showSuccessModal } from '../../utils/confirm'
import { useLoading } from '../../context/LoadingContext'

const CERTIFICATE_TYPE_CONFIG = {
  'Volunteer Certificate': { color: 'crimson', icon: 'award' },
  'Certificate of Volunteer Service': { color: 'crimson', icon: 'award' },
  'Certificate of Participation': { color: 'blue', icon: 'award' },
  'Special Recognition': { color: 'gold', icon: 'star' },
  'Training Certificate': { color: 'blue', icon: 'book' },
  'Achievement Award': { color: 'purple', icon: 'trophy' },
}

const VOLUNTEER_CERT_TYPES = [
  'Certificate of Volunteer Service',
  'Certificate of Participation',
  'Certificate of Appreciation',
  'Training Certificate',
  'Achievement Award',
  'Special Recognition',
]

function certPeriod(cert) {
  if (cert.period) return cert.period
  if (cert.details) {
    const match = String(cert.details).match(/\b(Q[1-4]\s+\d{4}|\d{4})\b/)
    if (match) return match[0]
  }
  return cert.date || 'Service recognition'
}

export default function VolunteerCertificatesPage() {
  const { showLoading, hideLoading } = useLoading()
  const { data, loading, error, reload } = useApiList(() => certificatesApi.list())
  const { data: rawTasks } = useApiList(() =>
    tasksApi.list().then((r) => ({
      data: Array.isArray(r.data) ? r.data : (r.list || []),
    }))
  )
  const [preview, setPreview] = useState(null)
  const [statusFilter, setStatusFilter] = useState('All')
  const [shareModalOpen, setShareModalOpen] = useState(null)
  const [showRequest, setShowRequest] = useState(false)
  const [form, setForm] = useState({
    type: 'Certificate of Volunteer Service',
    reference: '',
    details: '',
  })
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const tasksList = Array.isArray(rawTasks) ? rawTasks : []

  const isTaskCompleted = (t) =>
    Boolean(t && (t.isDone || t.boardColumn === 'done' || t.status === 'Done' || t.status === 'Completed'))

  const completedTasks = useMemo(() => {
    return tasksList.filter(isTaskCompleted)
  }, [tasksList])

  const filteredCertificates = data.filter((cert) => {
    if (statusFilter === 'All') return true
    if (statusFilter === 'Processing') {
      return ['Requested', 'Pending', 'Approved', 'Processing'].includes(cert.status)
    }
    if (statusFilter === 'Generated') {
      return cert.status === 'Generated' || cert.status === 'Released'
    }
    return cert.status === statusFilter
  })

  const paging = usePagination(filteredCertificates, DEFAULT_PAGE_SIZE, statusFilter)

  const statusCounts = {
    All: data.length,
    Generated: data.filter((c) => c.status === 'Generated' || c.status === 'Released').length,
    Processing: data.filter((c) => ['Requested', 'Pending', 'Approved', 'Processing'].includes(c.status)).length,
  }

  const handleRequest = async (e) => {
    e.preventDefault()
    if (!form.reference) {
      notify.warning('Please select a completed duty or activity.')
      return
    }
    setBusy(true)
    showLoading('Sending request…')
    try {
      const res = await certificatesApi.create({
        type: form.type,
        reference: form.reference,
        details: form.details ? form.details.trim() : undefined,
      })
      setShowRequest(false)
      setForm({
        type: 'Certificate of Volunteer Service',
        reference: completedTasks[0]?.id || completedTasks[0]?.code || '',
        details: '',
      })
      const successMsg = res?.message || 'Certificate request sent successfully.'
      setNotice(successMsg)
      notify.success(successMsg)
      showSuccessModal(successMsg, 'Certificate Request Sent')
      reload()
    } catch (err) {
      notify.error(err.message || 'Failed to submit certificate request')
    } finally {
      hideLoading()
      setBusy(false)
    }
  }

  const handleShare = (cert) => {
    setShareModalOpen(cert)
  }

  const handleCopyLink = (cert) => {
    const link = `${window.location.origin}/certificates/verify/${cert.reference || cert.id}`
    navigator.clipboard.writeText(link)
    notify.success('Certificate link copied to clipboard!')
  }

  const handleSocialShare = (platform, cert) => {
    const text = `I've earned a ${cert.type} from Rise Against Hunger Cebu! ${certPeriod(cert)}`
    const url = `${window.location.origin}/certificates/verify/${cert.reference || cert.id}`
    
    let shareUrl = ''
    switch (platform) {
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
        break
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
        break
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
        break
    }
    
    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400')
    }
  }

  const ready = (c) => c.status === 'Generated' || c.status === 'Released'

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      {notice && (
        <div className="portal-notice">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Volunteer Certificate KPI Summary Cards */}
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
          <div>
            <h2>Volunteer Certificates</h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              View earned certificates, download PDFs, or request new certificates for completed volunteer services.
            </p>
          </div>
          {completedTasks.length > 0 && (
            <button
              type="button"
              className="btn btn--sm btn--primary"
              onClick={() => {
                setForm((prev) => ({
                  ...prev,
                  reference: prev.reference || completedTasks[0]?.id || completedTasks[0]?.code || '',
                }))
                setShowRequest(true)
              }}
            >
              + Request Certificate
            </button>
          )}
        </div>

        {/* Filter Bar */}
        <div className="portal-filter-bar portal-filter-bar--simple">
          <div className="portal-filter-bar__filters">
            {Object.keys(statusCounts).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`portal-filter-btn ${statusFilter === status ? 'active' : ''}`}
              >
                {status} <span className="portal-filter-btn__count">({statusCounts[status]})</span>
              </button>
            ))}
          </div>
        </div>

        {filteredCertificates.length === 0 ? (
          <div className="cert-empty">
            <Award size={36} />
            <p>
              {statusFilter !== 'All' 
                ? `No ${statusFilter.toLowerCase()} certificates` 
                : completedTasks.length > 0
                  ? 'No certificates issued yet. You can request a certificate for your completed volunteer activities.'
                  : 'No certificates yet. Complete assigned tasks and duties to earn and request volunteer certificates.'}
            </p>
            {statusFilter === 'All' && completedTasks.length > 0 && (
              <button
                type="button"
                className="btn btn--sm btn--primary"
                style={{ marginTop: '0.75rem' }}
                onClick={() => {
                  setForm((prev) => ({
                    ...prev,
                    reference: prev.reference || completedTasks[0]?.id || completedTasks[0]?.code || '',
                  }))
                  setShowRequest(true)
                }}
              >
                Request Certificate Now
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="cert-grid cert-grid--enhanced">
              {paging.pageItems.map((c) => {
                const config = CERTIFICATE_TYPE_CONFIG[c.type] || { color: 'gray', icon: 'award' }
                return (
                  <div key={c.id} className={`cert-card cert-card--${config.color}`}>
                    <div className={`cert-card__icon cert-card__icon--${config.color}`}>
                      <Award size={22} />
                    </div>
                    <div className="cert-card__body">
                      <strong>{c.type}</strong>
                      <span className="cert-card__period">{certPeriod(c)}</span>
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
            <Pagination
              page={paging.page}
              totalPages={paging.totalPages}
              total={paging.total}
              startIndex={paging.startIndex}
              endIndex={paging.endIndex}
              onPageChange={paging.setPage}
              className="pagination--portal"
              noun="certificates"
            />
          </>
        )}
      </section>

      {/* Request Certificate Modal */}
      {showRequest && (
        <div className="admin-modal-overlay" onClick={() => setShowRequest(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title="Request a Certificate"
              onClose={() => setShowRequest(false)}
            />
            <form onSubmit={handleRequest}>
              <div className="admin-modal__body">
                <label>
                  Certificate Type
                  <select
                    id="volunteer-certificate-type"
                    name="type"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                  >
                    {VOLUNTEER_CERT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  For Duty / Activity <span style={{ color: '#dc2626' }}>*</span>
                  <select
                    id="volunteer-certificate-reference"
                    name="reference"
                    required
                    value={form.reference}
                    onChange={(e) => setForm({ ...form, reference: e.target.value })}
                  >
                    <option value="" disabled>-- Select Completed Duty / Activity --</option>
                    {completedTasks.map((t) => {
                      const code = t.id || t.code
                      const title = t.title || 'Volunteer Duty'
                      const mod = t.module || t.category || t.program || 'Duty'
                      return (
                        <option key={t.dbId || t.id} value={code}>
                          {code ? `${code} — ` : ''}{title} ({mod})
                        </option>
                      )
                    })}
                  </select>
                </label>

                <label>
                  Purpose / Notes (Optional)
                  <textarea
                    id="volunteer-certificate-details"
                    name="details"
                    rows={3}
                    value={form.details}
                    onChange={(e) => setForm({ ...form, details: e.target.value })}
                    placeholder="e.g. In recognition of completed relief distribution duties and academic community service requirements."
                  />
                </label>
              </div>

              <div className="admin-modal__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowRequest(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary" disabled={busy}>
                  {busy ? 'Submitting...' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {preview && (
        <div className="admin-modal-overlay" onClick={() => setPreview(null)}>
          <div className="admin-modal admin-modal--cert" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title={preview.type} onClose={() => setPreview(null)} />
            <div className="cert-preview-toolbar">
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
              </div>
            </div>
            <CertificateView cert={preview} />
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setShareModalOpen(null)}>
          <div className="admin-modal admin-modal--share" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title="Share Certificate"
              onClose={() => setShareModalOpen(null)}
            />
            <div className="admin-modal__body">
              <div className="share-modal-content">
                <div className="share-modal-cert-info">
                  <Award size={24} />
                  <div>
                    <strong>{shareModalOpen.type}</strong>
                    <span>{certPeriod(shareModalOpen)}</span>
                  </div>
                </div>

                <div className="share-modal-section">
                  <h4>Share on social media</h4>
                  <div className="share-modal-social">
                    <button
                      type="button"
                      className="share-social-btn share-social-btn--facebook"
                      onClick={() => handleSocialShare('facebook', shareModalOpen)}
                    >
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                      Facebook
                    </button>
                    <button
                      type="button"
                      className="share-social-btn share-social-btn--twitter"
                      onClick={() => handleSocialShare('twitter', shareModalOpen)}
                    >
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                        <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                      </svg>
                      Twitter
                    </button>
                    <button
                      type="button"
                      className="share-social-btn share-social-btn--linkedin"
                      onClick={() => handleSocialShare('linkedin', shareModalOpen)}
                    >
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                      LinkedIn
                    </button>
                  </div>
                </div>

                <div className="share-modal-section">
                  <h4>Copy verification link</h4>
                  <div className="share-modal-link">
                    <input
                      id="volunteer-certificate-share-link"
                      name="certificateShareLink"
                      type="text"
                      readOnly
                      value={`${window.location.origin}/certificates/verify/${shareModalOpen.reference || shareModalOpen.id}`}
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
