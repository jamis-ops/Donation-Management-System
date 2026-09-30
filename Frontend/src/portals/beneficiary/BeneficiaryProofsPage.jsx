import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Upload, FileCheck, Image, Calendar, MapPin, AlertTriangle, CheckCircle2,
  Clock3, Download, FileText, Camera, ClipboardSignature, Package,
  ChevronDown, ChevronUp, Eye, RefreshCw, X, AlertCircle, Users, Send,
} from 'lucide-react'
import { assistanceRequestsApi, getDistributionProofs, uploadDistributionProof } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import ApiState from '../../admin/components/shared/ApiState'
import StatusBadge from '../../admin/components/shared/StatusBadge'
import { notify } from '../../utils/confirm'
import { useLoading } from '../../context/LoadingContext'

const PROOF_SLOTS = [
  { key: 'received_goods', label: 'Received Goods Photos', hint: 'Show the goods after they arrived at your barangay.', icon: Package, accept: 'image/jpeg,image/png,image/webp,image/gif' },
  { key: 'distribution', label: 'Distribution Photos', hint: 'Photos during handover or community distribution.', icon: Camera, accept: 'image/jpeg,image/png,image/webp,image/gif' },
  { key: 'acknowledgment', label: 'Signed Acknowledgment', hint: 'Signed form or acknowledgment document (photo or PDF).', icon: ClipboardSignature, accept: 'image/jpeg,image/png,image/webp,image/gif,application/pdf' },
]

function getRequestPreview(request) {
  const notes = String(request?.notes || '')
  const calamityMatch = notes.match(/Calamity\/Program:\s*(.+?)(?:\n|$)/i)
  const familiesMatch = notes.match(/Families Affected:\s*(\d+)/i)
  let needs = Array.isArray(request?.needs) ? request.needs.filter(Boolean) : []
  if (needs.length === 0) {
    const needsMatch = notes.match(/Type of Needs:\s*(.+?)(?:\n|$)/i)
    if (needsMatch) needs = needsMatch[1].split(',').map((n) => n.trim()).filter(Boolean)
    else if (request?.type) needs = String(request.type).split(',').map((n) => n.trim()).filter(Boolean)
  }
  return {
    calamity: calamityMatch ? calamityMatch[1].trim() : (request?.type || 'Assistance Request'),
    families: familiesMatch ? parseInt(familiesMatch[1], 10) : (request?.affectedFamilies || 0),
    needs,
  }
}

function proofStatusInfo(status) {
  if (!status || status === 'None') return { label: 'No Proof Yet', color: '#64748b', bg: '#f8fafc', icon: null }
  if (status === 'Approved') return { label: 'Approved', color: '#059669', bg: '#ecfdf5', icon: CheckCircle2 }
  if (status === 'Rejected') return { label: 'Rejected â€” Resubmit', color: '#dc2626', bg: '#fef2f2', icon: AlertTriangle }
  if (status === 'Pending') return { label: 'Pending Review', color: '#d97706', bg: '#fffbeb', icon: Clock3 }
  return { label: status, color: '#64748b', bg: '#f8fafc', icon: Clock3 }
}

function getRequestProofStatus(request, proofs) {
  const deliveryDbId = request?.delivery?.dbId
  if (!deliveryDbId) return null
  const related = proofs.filter((p) => String(p.distributionId) === String(deliveryDbId))
  if (related.length === 0) return null
  const statuses = related.map((p) => p.status)
  if (statuses.every((s) => s === 'Approved')) return 'Approved'
  if (statuses.some((s) => s === 'Rejected') && statuses.every((s) => s === 'Rejected')) return 'Rejected'
  if (statuses.some((s) => s === 'Approved')) return 'Approved'
  return 'Pending'
}

function getProofButtonLabel(request, proofStatus) {
  if (!request.canSubmitProof && !proofStatus) return null
  if (!proofStatus) return 'Submit Proof'
  if (proofStatus === 'Rejected') return 'Update Proof'
  return 'View Proof'
}

const emptyFiles = () => ({ received_goods: null, distribution: null, acknowledgment: null })

export default function BeneficiaryProofsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { showLoading, hideLoading } = useLoading()

  const { data: requests, loading: reqLoading, error: reqError, reload: reloadRequests } = useApiList(() => assistanceRequestsApi.list())
  const { data: allProofs, loading: proofLoading, error: proofError, reload: reloadProofs } = useApiList(() => getDistributionProofs())

  const [topForm, setTopForm] = useState({ selectedRequestId: '', notes: '', files: emptyFiles() })
  const [topUploading, setTopUploading] = useState(false)
  const [topMessage, setTopMessage] = useState('')

  const [expandedId, setExpandedId] = useState(() => searchParams.get('requestId') || '')
  const [uploadForm, setUploadForm] = useState({ notes: '', files: emptyFiles() })
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')

  const deliverableRequests = requests.filter((r) => {
    if (!r.delivery?.dbId) return false
    const ps = getRequestProofStatus(r, allProofs)
    return r.canSubmitProof || ps === 'Rejected' || ['Delivered', 'Proof Review'].includes(r.delivery?.status)
  })

  const relevantRequests = requests.filter((r) => {
    if (!r.delivery?.dbId) return false
    const ps = getRequestProofStatus(r, allProofs)
    return r.canSubmitProof || ps !== null || ['Delivered', 'Proof Review', 'Completed'].includes(r.delivery?.status) || ['Proof Review', 'Completed'].includes(r.status)
  })

  useEffect(() => {
    const reqId = searchParams.get('requestId')
    const distId = searchParams.get('distributionId')
    if (reqId) {
      setExpandedId(reqId)
      const m = requests.find((r) => String(r.dbId) === reqId)
      if (m) setTopForm((prev) => ({ ...prev, selectedRequestId: String(m.dbId) }))
    } else if (distId) {
      const m = requests.find((r) => String(r.delivery?.dbId) === String(distId))
      if (m) { setExpandedId(String(m.dbId)); setTopForm((prev) => ({ ...prev, selectedRequestId: String(m.dbId) })) }
    }
  }, [searchParams, requests])

  const getRequestProofs = useCallback((req) => {
    if (!req?.delivery?.dbId) return []
    return allProofs.filter((p) => String(p.distributionId) === String(req.delivery.dbId))
  }, [allProofs])

  const handleToggleExpand = (id) => {
    const newId = expandedId === String(id) ? '' : String(id)
    setExpandedId(newId)
    setMessage('')
    setUploadForm({ notes: '', files: emptyFiles() })
    if (!newId) setSearchParams({}, { replace: true })
  }

  const setFile = (key, file) => setUploadForm((prev) => ({ ...prev, files: { ...prev.files, [key]: file || null } }))
  const setTopFile = (key, file) => setTopForm((prev) => ({ ...prev, files: { ...prev.files, [key]: file || null } }))

  const doUpload = async (deliveryDbId, notes, files, onSuccess, onError) => {
    const fd = new FormData()
    fd.append('distributionId', String(deliveryDbId))
    fd.append('notes', notes)
    PROOF_SLOTS.forEach((slot) => { if (files[slot.key]) fd.append(slot.key, files[slot.key]) })
    const res = await uploadDistributionProof(fd)
    return res?.count || Object.values(files).filter(Boolean).length
  }

  const handleTopSubmit = async (e) => {
    e.preventDefault()
    const req = requests.find((r) => String(r.dbId) === topForm.selectedRequestId)
    const deliveryDbId = req?.delivery?.dbId
    if (!deliveryDbId) { setTopMessage('Please select a valid delivered request.'); return }
    const photoCount = [topForm.files.received_goods, topForm.files.distribution].filter(Boolean).length
    if (photoCount === 0 || !topForm.files.acknowledgment) { setTopMessage('Please upload at least one proof photo and the signed acknowledgment.'); return }
    setTopUploading(true); showLoading('Sending...'); setTopMessage('')
    try {
      const count = await doUpload(deliveryDbId, topForm.notes, topForm.files)
      setTopForm({ selectedRequestId: '', notes: '', files: emptyFiles() })
      setTopMessage(`${count} proof file(s) submitted. Pending admin review.`)
      notify.success('Proof submitted for review.')
      setSearchParams({}, { replace: true })
      reloadProofs(); reloadRequests()
    } catch (err) { setTopMessage(err.message); notify.error(err.message) }
    finally { hideLoading(); setTopUploading(false) }
  }

  const handleSubmit = async (e, request) => {
    e.preventDefault()
    const deliveryDbId = request?.delivery?.dbId
    if (!deliveryDbId) { setMessage('No delivery linked to this request.'); return }
    const photoCount = [uploadForm.files.received_goods, uploadForm.files.distribution].filter(Boolean).length
    if (photoCount === 0 || !uploadForm.files.acknowledgment) { setMessage('Please upload at least one proof photo and the signed acknowledgment/receipt.'); return }
    setUploading(true); showLoading('Sending...'); setMessage('')
    try {
      const count = await doUpload(deliveryDbId, uploadForm.notes, uploadForm.files)
      setUploadForm({ notes: '', files: emptyFiles() })
      setMessage(`${count} proof file(s) submitted. Pending admin review.`)
      notify.success('Proof submitted for review.')
      setSearchParams({}, { replace: true })
      reloadProofs(); reloadRequests()
    } catch (err) { setMessage(err.message); notify.error(err.message) }
    finally { hideLoading(); setUploading(false) }
  }

  const topSelectedRequest = requests.find((r) => String(r.dbId) === topForm.selectedRequestId)
  const topPreview = topSelectedRequest ? getRequestPreview(topSelectedRequest) : null

  return (
    <div className="proof-upload-page proof-upload-page--request-centric">
      {/* TOP STANDALONE FORM */}
      <div className="proof-top-form-panel">
        <div className="proof-top-form-panel__header">
          <div className="proof-page-header__icon"><FileCheck size={20} /></div>
          <div>
            <h2>Submit Distribution Proof</h2>
            <p>Select a delivered relief request, upload your proof files, and submit for admin review.</p>
          </div>
        </div>
        <ApiState loading={reqLoading || proofLoading} error={reqError || proofError} onRetry={() => { reloadRequests(); reloadProofs() }}>
          {deliverableRequests.length === 0 ? (
            <div className="proof-top-form-empty">
              <AlertCircle size={18} />
              <span>No deliverable requests yet. Proof can be submitted once a delivery is marked <strong>Delivered</strong> by admin.</span>
            </div>
          ) : (
            <form className="proof-top-form" onSubmit={handleTopSubmit} id="proof-submit-form">
              <div className="proof-top-form__field">
                <label className="proof-top-form__label" htmlFor="proof-request-select">
                  <FileText size={14} /> Relief Request <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  id="proof-request-select"
                  className="proof-top-form__select"
                  value={topForm.selectedRequestId}
                  onChange={(e) => { setTopForm((prev) => ({ ...prev, selectedRequestId: e.target.value, files: emptyFiles(), notes: '' })); setTopMessage('') }}
                  required
                >
                  <option value="">â€” Choose a delivered request â€”</option>
                  {deliverableRequests.map((r) => {
                    const pv = getRequestPreview(r)
                    return (
                      <option key={r.dbId} value={r.dbId}>
                        {r.id} Â· {pv.calamity}{r.delivery?.location ? ` Â· ${r.delivery.location}` : ''}{pv.families ? ` Â· ${pv.families} Families` : ''}
                      </option>
                    )
                  })}
                </select>
              </div>

              {topSelectedRequest && (
                <div className="proof-top-form__preview">
                  <div className="proof-top-form__preview-row">
                    <span className="proof-request-card__ref-id">{topSelectedRequest.id}</span>
                    <span className={`beneficiary-priority-badge beneficiary-priority-badge--${(topSelectedRequest.priority || 'low').toLowerCase()}`}>{topSelectedRequest.priority}</span>
                    <StatusBadge status={topSelectedRequest.delivery?.status || topSelectedRequest.status} />
                    {topSelectedRequest.delivery?.id && (
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Delivery: <strong style={{ fontFamily: 'monospace', color: '#AF101A' }}>{topSelectedRequest.delivery.id}</strong></span>
                    )}
                  </div>
                  {topPreview?.needs.length > 0 && (
                    <div className="proof-request-card__needs" style={{ marginTop: '0.4rem' }}>
                      {topPreview.needs.slice(0, 4).map((n, i) => <span key={i} className="proof-request-card__need-chip">{n}</span>)}
                    </div>
                  )}
                </div>
              )}

              <div className="proof-top-form__slots">
                {PROOF_SLOTS.map((slot) => {
                  const Icon = slot.icon
                  const file = topForm.files[slot.key]
                  return (
                    <label key={slot.key} className={`proof-slot${file ? ' proof-slot--filled' : ''}`}>
                      <span className="proof-slot__head"><Icon size={16} /><span><strong>{slot.label}</strong><em>{slot.hint}</em></span></span>
                      <input type="file" accept={slot.accept} onChange={(e) => setTopFile(slot.key, e.target.files?.[0] || null)} />
                      {file ? <span className="proof-file-name"><Image size={13} /> {file.name}</span> : <span className="proof-slot__choose">Choose file...</span>}
                    </label>
                  )
                })}
              </div>

              <label className="proof-upload-form__remarks-label">
                Remarks <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400 }}>(optional)</span>
                <textarea rows={2} value={topForm.notes} onChange={(e) => setTopForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Brief description (e.g. goods received at barangay hall on [date])..." />
              </label>

              {topMessage && (
                <p className={`proof-message${/submitted|Pending|success/i.test(topMessage) ? ' proof-message--success' : ' proof-message--error'}`}>{topMessage}</p>
              )}

              <div className="proof-top-form__actions">
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setTopForm({ selectedRequestId: '', notes: '', files: emptyFiles() }); setTopMessage('') }}><X size={14} /> Clear</button>
                <button type="submit" className="btn btn--primary" disabled={topUploading || !topForm.selectedRequestId}><Send size={15} />{topUploading ? 'Uploading...' : 'Submit Proof'}</button>
              </div>
            </form>
          )}
        </ApiState>
      </div>

      {/* PROOF STATUS CARDS */}
      {relevantRequests.length > 0 && (
        <div className="proof-history-section">
          <h3 className="proof-history-section__title"><FileCheck size={16} /> Submitted Proofs by Request</h3>
          <div className="proof-request-list">
            {relevantRequests.map((request) => {
              const preview = getRequestPreview(request)
              const requestProofs = getRequestProofs(request)
              const proofAggStatus = getRequestProofStatus(request, allProofs)
              const proofInfo = proofStatusInfo(proofAggStatus)
              const isExpanded = expandedId === String(request.dbId)
              const canSubmit = request.canSubmitProof || proofAggStatus === 'Rejected'
              const buttonLabel = getProofButtonLabel(request, proofAggStatus)
              const rejectedProofs = requestProofs.filter((p) => p.status === 'Rejected')
              const hasRejection = rejectedProofs.length > 0
              return (
                <div key={request.dbId} className={`proof-request-card${isExpanded ? ' proof-request-card--expanded' : ''}${proofAggStatus ? ` proof-request-card--${proofAggStatus.toLowerCase().replace(/\s+/g, '-')}` : ''}`}>
                  <div className="proof-request-card__header">
                    <div className="proof-request-card__info">
                      <div className="proof-request-card__id-row">
                        <span className="proof-request-card__ref-id">{request.id}</span>
                        <span className={`beneficiary-priority-badge beneficiary-priority-badge--${(request.priority || 'low').toLowerCase()}`}>{request.priority}</span>
                        {hasRejection && <span className="proof-request-card__rejected-pill"><AlertTriangle size={11} /> Proof Rejected</span>}
                      </div>
                      <div className="proof-request-card__meta-grid">
                        {request.delivery?.location && <span className="proof-request-card__meta-item"><MapPin size={12} /> {request.delivery.location}</span>}
                        {preview.calamity && <span className="proof-request-card__meta-item"><AlertCircle size={12} /> {preview.calamity}</span>}
                        {preview.families > 0 && <span className="proof-request-card__meta-item"><Users size={12} /> {preview.families} Families</span>}
                        {request.delivery?.date && <span className="proof-request-card__meta-item"><Calendar size={12} /> Delivered {request.delivery.date}</span>}
                      </div>
                      {preview.needs.length > 0 && (
                        <div className="proof-request-card__needs">
                          {preview.needs.slice(0, 3).map((n, i) => <span key={i} className="proof-request-card__need-chip">{n}</span>)}
                          {preview.needs.length > 3 && <span className="proof-request-card__need-chip proof-request-card__need-chip--more">+{preview.needs.length - 3} more</span>}
                        </div>
                      )}
                    </div>
                    <div className="proof-request-card__actions-col">
                      {proofAggStatus && (
                        <span className="proof-request-card__proof-status" style={{ color: proofInfo.color, background: proofInfo.bg }}>
                          {proofInfo.icon && <proofInfo.icon size={13} />}{proofInfo.label}
                        </span>
                      )}
                      <StatusBadge status={request.delivery?.status || request.status} />
                      {buttonLabel && (
                        <button type="button" className={`btn btn--sm ${proofAggStatus === 'Approved' ? 'btn--outline' : proofAggStatus === 'Rejected' ? 'btn--danger' : 'btn--primary'}`} onClick={() => handleToggleExpand(request.dbId)}>
                          {proofAggStatus === 'Approved' ? <Eye size={13} /> : proofAggStatus === 'Rejected' ? <RefreshCw size={13} /> : <Upload size={13} />}
                          {buttonLabel}{isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                      )}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="proof-request-card__body">
                      <div className="proof-request-summary">
                        <div className="proof-request-summary__row"><span className="proof-request-summary__label"><FileText size={13} /> Request ID</span><span className="proof-request-summary__value proof-request-summary__value--code">{request.id}</span></div>
                        {request.delivery?.id && <div className="proof-request-summary__row"><span className="proof-request-summary__label"><Package size={13} /> Delivery ID</span><span className="proof-request-summary__value proof-request-summary__value--code">{request.delivery.id}</span></div>}
                        {request.delivery?.location && <div className="proof-request-summary__row"><span className="proof-request-summary__label"><MapPin size={13} /> Barangay</span><span className="proof-request-summary__value">{request.delivery.location}</span></div>}
                        {preview.families > 0 && <div className="proof-request-summary__row"><span className="proof-request-summary__label"><Users size={13} /> Families</span><span className="proof-request-summary__value">{preview.families}</span></div>}
                        {request.delivery?.items && <div className="proof-request-summary__row"><span className="proof-request-summary__label"><Package size={13} /> Items</span><span className="proof-request-summary__value">{request.delivery.items}</span></div>}
                      </div>
                      {hasRejection && (
                        <div className="proof-rejection-notice">
                          <AlertTriangle size={18} />
                          <div>
                            <strong>Proof was rejected â€” please resubmit</strong>
                            {rejectedProofs.map((p) => p.reviewRemarks).filter(Boolean).map((r, i) => <p key={i}>{r}</p>)}
                          </div>
                        </div>
                      )}
                      {requestProofs.length > 0 && (
                        <div className="proof-existing-files">
                          <h4 className="proof-existing-files__title"><FileCheck size={15} /> Submitted Proof Files ({requestProofs.length})</h4>
                          <div className="proof-existing-files__grid">
                            {requestProofs.map((p) => (
                              <div key={p.id} className={`proof-file-card proof-file-card--${(p.status || 'pending').toLowerCase()}`}>
                                <div className="proof-file-card__preview">{p.isImage ? <img src={p.fileUrl} alt={p.fileName} /> : <div className="proof-file-card__doc-icon"><FileCheck size={24} /></div>}</div>
                                <div className="proof-file-card__info">
                                  <span className="proof-file-card__category">{p.categoryLabel}</span>
                                  <span className="proof-file-card__name">{p.fileName}</span>
                                  {p.submittedAt && <span className="proof-file-card__date">Submitted {p.submittedAt}</span>}
                                  {p.status === 'Approved' && <span className="proof-file-card__status proof-file-card__status--approved"><CheckCircle2 size={12} /> Approved{p.reviewedAt ? ` Â· ${p.reviewedAt}` : ''}</span>}
                                  {p.status === 'Rejected' && <span className="proof-file-card__status proof-file-card__status--rejected"><AlertTriangle size={12} /> Rejected{p.reviewRemarks && <em> â€” {p.reviewRemarks}</em>}</span>}
                                  {p.status === 'Pending' && <span className="proof-file-card__status proof-file-card__status--pending"><Clock3 size={12} /> Pending Review</span>}
                                </div>
                                <div className="proof-file-card__actions"><a href={p.fileUrl} target="_blank" rel="noreferrer" className="btn btn--sm btn--outline"><Download size={13} /> View</a></div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {canSubmit && proofAggStatus !== 'Approved' && (
                        <form className="proof-upload-form proof-upload-form--inline" onSubmit={(e) => handleSubmit(e, request)}>
                          <h4 className="proof-upload-form__title"><Upload size={15} />{hasRejection ? 'Resubmit Proof Files' : 'Upload Proof Files'}</h4>
                          <p className="proof-upload-form__hint">Upload at least one photo and a signed acknowledgment. JPG, PNG, WEBP, GIF, or PDF â€” max 5MB each.</p>
                          <div className="proof-slots proof-slots--compact">
                            {PROOF_SLOTS.map((slot) => {
                              const Icon = slot.icon
                              const file = uploadForm.files[slot.key]
                              return (
                                <label key={slot.key} className={`proof-slot proof-slot--sm${file ? ' proof-slot--filled' : ''}`}>
                                  <span className="proof-slot__head"><Icon size={16} /><span><strong>{slot.label}</strong><em>{slot.hint}</em></span></span>
                                  <input type="file" accept={slot.accept} onChange={(e) => setFile(slot.key, e.target.files?.[0] || null)} />
                                  {file ? <span className="proof-file-name"><Image size={13} /> {file.name}</span> : <span className="proof-slot__choose">Choose file...</span>}
                                </label>
                              )
                            })}
                          </div>
                          <label className="proof-upload-form__remarks-label">
                            Remarks <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400 }}>(optional)</span>
                            <textarea rows={2} value={uploadForm.notes} onChange={(e) => setUploadForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Brief description (e.g. goods received at barangay hall on [date])..." />
                          </label>
                          {message && <p className={`proof-message${/success|Pending|submitted/i.test(message) ? ' proof-message--success' : ' proof-message--error'}`}>{message}</p>}
                          <div className="proof-upload-form__actions">
                            <button type="button" className="btn btn--ghost btn--sm" onClick={() => handleToggleExpand(request.dbId)}><X size={14} /> Cancel</button>
                            <button type="submit" className="btn btn--primary btn--sm" disabled={uploading}><Upload size={14} />{uploading ? 'Uploading...' : hasRejection ? 'Resubmit Proof' : 'Submit Proof'}</button>
                          </div>
                        </form>
                      )}
                      {proofAggStatus === 'Approved' && (
                        <div className="proof-approved-notice">
                          <CheckCircle2 size={18} />
                          <div><strong>All proof files approved</strong><p>This relief request has been fully verified. No further action needed.</p></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}