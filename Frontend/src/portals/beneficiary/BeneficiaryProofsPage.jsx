import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Upload, FileCheck, Image, Calendar, MapPin, AlertTriangle, CheckCircle2,
  Clock3, Download, FileText, Camera, ClipboardSignature, Package,
  ChevronDown, ChevronUp, Eye, RefreshCw, X, AlertCircle, Users,
} from 'lucide-react'
import { assistanceRequestsApi, getDistributionProofs, uploadDistributionProof } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import ApiState from '../../admin/components/shared/ApiState'
import StatusBadge from '../../admin/components/shared/StatusBadge'
import { notify } from '../../utils/confirm'
import { useLoading } from '../../context/LoadingContext'

const PROOF_SLOTS = [
  {
    key: 'received_goods',
    label: 'Received Goods Photos',
    hint: 'Show the goods after they arrived at your barangay.',
    icon: Package,
    accept: 'image/jpeg,image/png,image/webp,image/gif',
  },
  {
    key: 'distribution',
    label: 'Distribution Photos',
    hint: 'Photos during handover or community distribution.',
    icon: Camera,
    accept: 'image/jpeg,image/png,image/webp,image/gif',
  },
  {
    key: 'acknowledgment',
    label: 'Signed Acknowledgment',
    hint: 'Signed form or acknowledgment document (photo or PDF).',
    icon: ClipboardSignature,
    accept: 'image/jpeg,image/png,image/webp,image/gif,application/pdf',
  },
]

function getRequestPreview(request) {
  const notes = String(request?.notes || '')
  const calamityMatch = notes.match(/Calamity\/Program:\s*(.+?)(?:\n|$)/i)
  const familiesMatch = notes.match(/Families Affected:\s*(\d+)/i)
  let needs = Array.isArray(request?.needs) ? request.needs.filter(Boolean) : []
  if (needs.length === 0) {
    const needsMatch = notes.match(/Type of Needs:\s*(.+?)(?:\n|$)/i)
    if (needsMatch) {
      needs = needsMatch[1].split(',').map((n) => n.trim()).filter(Boolean)
    } else if (request?.type) {
      needs = String(request.type).split(',').map((n) => n.trim()).filter(Boolean)
    }
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
  if (status === 'Rejected') return { label: 'Rejected — Resubmit', color: '#dc2626', bg: '#fef2f2', icon: AlertTriangle }
  if (status === 'Pending') return { label: 'Pending Review', color: '#d97706', bg: '#fffbeb', icon: Clock3 }
  return { label: status, color: '#64748b', bg: '#f8fafc', icon: Clock3 }
}

function getRequestProofStatus(request, proofs) {
  const deliveryDbId = request?.delivery?.dbId
  if (!deliveryDbId) return null
  const relatedProofs = proofs.filter(
    (p) => String(p.distributionId) === String(deliveryDbId)
  )
  if (relatedProofs.length === 0) return null
  const statuses = relatedProofs.map((p) => p.status)
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

const emptyFiles = () => ({
  received_goods: null,
  distribution: null,
  acknowledgment: null,
})

export default function BeneficiaryProofsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { showLoading, hideLoading } = useLoading()

  const { data: requests, loading: reqLoading, error: reqError, reload: reloadRequests } = useApiList(
    () => assistanceRequestsApi.list()
  )
  const { data: allProofs, loading: proofLoading, error: proofError, reload: reloadProofs } = useApiList(
    () => getDistributionProofs()
  )

  const [expandedId, setExpandedId] = useState(() => searchParams.get('requestId') || '')
  const [uploadForm, setUploadForm] = useState({ notes: '', files: emptyFiles() })
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const reqId = searchParams.get('requestId')
    const distId = searchParams.get('distributionId')
    if (reqId) setExpandedId(reqId)
    else if (distId) {
      // Map distributionId to requestDbId
      const matched = requests.find((r) => String(r.delivery?.dbId) === String(distId))
      if (matched) setExpandedId(String(matched.dbId))
    }
  }, [searchParams, requests])

  const relevantRequests = requests.filter((r) => {
    const hasDelivery = Boolean(r.delivery?.dbId)
    if (!hasDelivery) return false
    const proofStatus = getRequestProofStatus(r, allProofs)
    const deliveryStatus = r.delivery?.status
    return (
      r.canSubmitProof ||
      proofStatus !== null ||
      ['Delivered', 'Proof Review', 'Completed'].includes(deliveryStatus) ||
      ['Proof Review', 'Completed'].includes(r.status)
    )
  })

  const getRequestProofs = useCallback((request) => {
    const deliveryDbId = request?.delivery?.dbId
    if (!deliveryDbId) return []
    return allProofs.filter((p) => String(p.distributionId) === String(deliveryDbId))
  }, [allProofs])

  const handleToggleExpand = (requestDbId) => {
    const newId = expandedId === String(requestDbId) ? '' : String(requestDbId)
    setExpandedId(newId)
    setMessage('')
    setUploadForm({ notes: '', files: emptyFiles() })
    if (!newId) setSearchParams({}, { replace: true })
  }

  const setFile = (key, file) => {
    setUploadForm((prev) => ({ ...prev, files: { ...prev.files, [key]: file || null } }))
  }

  const handleSubmit = async (e, request) => {
    e.preventDefault()
    const deliveryDbId = request?.delivery?.dbId
    if (!deliveryDbId) { setMessage('No delivery linked to this request.'); return }
    const photoCount = [uploadForm.files.received_goods, uploadForm.files.distribution].filter(Boolean).length
    if (photoCount === 0 || !uploadForm.files.acknowledgment) {
      setMessage('Please upload at least one proof photo and the signed acknowledgment/receipt.')
      return
    }
    setUploading(true)
    showLoading('Sending...')
    setMessage('')
    try {
      const fd = new FormData()
      fd.append('distributionId', String(deliveryDbId))
      fd.append('notes', uploadForm.notes)
      PROOF_SLOTS.forEach((slot) => {
        const file = uploadForm.files[slot.key]
        if (file) fd.append(slot.key, file)
      })
      const res = await uploadDistributionProof(fd)
      const count = res?.count || Object.values(uploadForm.files).filter(Boolean).length
      setUploadForm({ notes: '', files: emptyFiles() })
      setMessage(`${count} proof file(s) submitted. Pending admin review.`)
      notify.success('Proof submitted for review.')
      setSearchParams({}, { replace: true })
      reloadProofs()
      reloadRequests()
    } catch (err) {
      setMessage(err.message)
      notify.error(err.message)
    } finally {
      hideLoading()
      setUploading(false)
    }
  }

  return (
    <div className="proof-upload-page proof-upload-page--request-centric">
      <div className="proof-page-header">
        <div className="proof-page-header__icon">
          <FileCheck size={22} />
        </div>
        <div>
          <h2>Submit Distribution Proof</h2>
          <p>Upload photos and documents after receiving relief goods. Each relief request shows its proof submission status.</p>
        </div>
      </div>

      <ApiState loading={reqLoading || proofLoading} error={reqError || proofError} onRetry={() => { reloadRequests(); reloadProofs() }}>
        {relevantRequests.length === 0 ? (
          <div className="proof-empty-state">
            <AlertCircle size={40} />
            <h3>No Delivered Relief Requests</h3>
            <p>Proof can be submitted after a relief delivery is marked <strong>Delivered</strong> by Admin.</p>
          </div>
        ) : (
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
                <div
                  key={request.dbId}
                  className={`proof-request-card${isExpanded ? ' proof-request-card--expanded' : ''}${proofAggStatus ? ` proof-request-card--${proofAggStatus.toLowerCase().replace(/\s+/g, '-')}` : ''}`}
                >
                  <div className="proof-request-card__header">
                    <div className="proof-request-card__info">
                      <div className="proof-request-card__id-row">
                        <span className="proof-request-card__ref-id">{request.id}</span>
                        <span className={`beneficiary-priority-badge beneficiary-priority-badge--${(request.priority || 'low').toLowerCase()}`}>
                          {request.priority}
                        </span>
                        {hasRejection && (
                          <span className="proof-request-card__rejected-pill">
                            <AlertTriangle size={11} /> Proof Rejected
                          </span>
                        )}
                      </div>

                      <div className="proof-request-card__meta-grid">
                        {request.delivery?.location && (
                          <span className="proof-request-card__meta-item">
                            <MapPin size={12} /> {request.delivery.location}
                          </span>
                        )}
                        {preview.calamity && (
                          <span className="proof-request-card__meta-item">
                            <AlertCircle size={12} /> {preview.calamity}
                          </span>
                        )}
                        {preview.families > 0 && (
                          <span className="proof-request-card__meta-item">
                            <Users size={12} /> {preview.families} Families
                          </span>
                        )}
                        {request.delivery?.date && (
                          <span className="proof-request-card__meta-item">
                            <Calendar size={12} /> Delivered {request.delivery.date}
                          </span>
                        )}
                      </div>

                      {preview.needs.length > 0 && (
                        <div className="proof-request-card__needs">
                          {preview.needs.slice(0, 3).map((n, i) => (
                            <span key={i} className="proof-request-card__need-chip">{n}</span>
                          ))}
                          {preview.needs.length > 3 && (
                            <span className="proof-request-card__need-chip proof-request-card__need-chip--more">+{preview.needs.length - 3} more</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="proof-request-card__actions-col">
                      {proofAggStatus && (
                        <span className="proof-request-card__proof-status" style={{ color: proofInfo.color, background: proofInfo.bg }}>
                          {proofInfo.icon && <proofInfo.icon size={13} />}
                          {proofInfo.label}
                        </span>
                      )}
                      <StatusBadge status={request.delivery?.status || request.status} />
                      {buttonLabel && (
                        <button
                          type="button"
                          className={`btn btn--sm ${proofAggStatus === 'Approved' ? 'btn--outline' : proofAggStatus === 'Rejected' ? 'btn--danger' : 'btn--primary'}`}
                          onClick={() => handleToggleExpand(request.dbId)}
                        >
                          {proofAggStatus === 'Approved' ? <Eye size={13} /> : proofAggStatus === 'Rejected' ? <RefreshCw size={13} /> : <Upload size={13} />}
                          {buttonLabel}
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="proof-request-card__body">
                      <div className="proof-request-summary">
                        <div className="proof-request-summary__row">
                          <span className="proof-request-summary__label"><FileText size={13} /> Request ID</span>
                          <span className="proof-request-summary__value proof-request-summary__value--code">{request.id}</span>
                        </div>
                        {request.delivery?.id && (
                          <div className="proof-request-summary__row">
                            <span className="proof-request-summary__label"><Package size={13} /> Delivery ID</span>
                            <span className="proof-request-summary__value proof-request-summary__value--code">{request.delivery.id}</span>
                          </div>
                        )}
                        {request.delivery?.location && (
                          <div className="proof-request-summary__row">
                            <span className="proof-request-summary__label"><MapPin size={13} /> Barangay</span>
                            <span className="proof-request-summary__value">{request.delivery.location}</span>
                          </div>
                        )}
                        {preview.calamity && (
                          <div className="proof-request-summary__row">
                            <span className="proof-request-summary__label"><AlertCircle size={13} /> Calamity</span>
                            <span className="proof-request-summary__value">{preview.calamity}</span>
                          </div>
                        )}
                        {preview.families > 0 && (
                          <div className="proof-request-summary__row">
                            <span className="proof-request-summary__label"><Users size={13} /> Families</span>
                            <span className="proof-request-summary__value">{preview.families}</span>
                          </div>
                        )}
                        {request.delivery?.items && (
                          <div className="proof-request-summary__row">
                            <span className="proof-request-summary__label"><Package size={13} /> Items</span>
                            <span className="proof-request-summary__value">{request.delivery.items}</span>
                          </div>
                        )}
                      </div>

                      {hasRejection && (
                        <div className="proof-rejection-notice">
                          <AlertTriangle size={18} />
                          <div>
                            <strong>Proof was rejected — please resubmit</strong>
                            {rejectedProofs.map((p) => p.reviewRemarks).filter(Boolean).map((r, i) => (
                              <p key={i}>{r}</p>
                            ))}
                          </div>
                        </div>
                      )}

                      {requestProofs.length > 0 && (
                        <div className="proof-existing-files">
                          <h4 className="proof-existing-files__title">
                            <FileCheck size={15} /> Submitted Proof Files ({requestProofs.length})
                          </h4>
                          <div className="proof-existing-files__grid">
                            {requestProofs.map((p) => (
                              <div key={p.id} className={`proof-file-card proof-file-card--${(p.status || 'pending').toLowerCase()}`}>
                                <div className="proof-file-card__preview">
                                  {p.isImage ? (
                                    <img src={p.fileUrl} alt={p.fileName} />
                                  ) : (
                                    <div className="proof-file-card__doc-icon"><FileCheck size={24} /></div>
                                  )}
                                </div>
                                <div className="proof-file-card__info">
                                  <span className="proof-file-card__category">{p.categoryLabel}</span>
                                  <span className="proof-file-card__name">{p.fileName}</span>
                                  {p.submittedAt && <span className="proof-file-card__date">Submitted {p.submittedAt}</span>}
                                  {p.status === 'Approved' && (
                                    <span className="proof-file-card__status proof-file-card__status--approved">
                                      <CheckCircle2 size={12} /> Approved{p.reviewedAt ? ` · ${p.reviewedAt}` : ''}
                                    </span>
                                  )}
                                  {p.status === 'Rejected' && (
                                    <span className="proof-file-card__status proof-file-card__status--rejected">
                                      <AlertTriangle size={12} /> Rejected
                                      {p.reviewRemarks && <em> — {p.reviewRemarks}</em>}
                                    </span>
                                  )}
                                  {p.status === 'Pending' && (
                                    <span className="proof-file-card__status proof-file-card__status--pending">
                                      <Clock3 size={12} /> Pending Review
                                    </span>
                                  )}
                                </div>
                                <div className="proof-file-card__actions">
                                  <a href={p.fileUrl} target="_blank" rel="noreferrer" className="btn btn--sm btn--outline">
                                    <Download size={13} /> View
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {canSubmit && proofAggStatus !== 'Approved' && (
                        <form className="proof-upload-form proof-upload-form--inline" onSubmit={(e) => handleSubmit(e, request)}>
                          <h4 className="proof-upload-form__title">
                            <Upload size={15} />
                            {hasRejection ? 'Resubmit Proof Files' : 'Upload Proof Files'}
                          </h4>
                          <p className="proof-upload-form__hint">
                            Upload at least one photo and a signed acknowledgment. JPG, PNG, WEBP, GIF, or PDF — max 5MB each.
                          </p>

                          <div className="proof-slots proof-slots--compact">
                            {PROOF_SLOTS.map((slot) => {
                              const Icon = slot.icon
                              const file = uploadForm.files[slot.key]
                              return (
                                <label key={slot.key} className={`proof-slot proof-slot--sm${file ? ' proof-slot--filled' : ''}`}>
                                  <span className="proof-slot__head">
                                    <Icon size={16} />
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
                                    <span className="proof-file-name"><Image size={13} /> {file.name}</span>
                                  ) : (
                                    <span className="proof-slot__choose">Choose file...</span>
                                  )}
                                </label>
                              )
                            })}
                          </div>

                          <label className="proof-upload-form__remarks-label">
                            Remarks <span className="req-optional">(optional)</span>
                            <textarea
                              rows={2}
                              value={uploadForm.notes}
                              onChange={(e) => setUploadForm((prev) => ({ ...prev, notes: e.target.value }))}
                              placeholder="Brief description (e.g. goods received at barangay hall on [date])..."
                            />
                          </label>

                          {message && (
                            <p className={`proof-message${/success|Pending|submitted/i.test(message) ? ' proof-message--success' : ' proof-message--error'}`}>
                              {message}
                            </p>
                          )}

                          <div className="proof-upload-form__actions">
                            <button type="button" className="btn btn--ghost btn--sm" onClick={() => handleToggleExpand(request.dbId)}>
                              <X size={14} /> Cancel
                            </button>
                            <button type="submit" className="btn btn--primary btn--sm" disabled={uploading}>
                              <Upload size={14} />
                              {uploading ? 'Uploading...' : hasRejection ? 'Resubmit Proof' : 'Submit Proof'}
                            </button>
                          </div>
                        </form>
                      )}

                      {proofAggStatus === 'Approved' && (
                        <div className="proof-approved-notice">
                          <CheckCircle2 size={18} />
                          <div>
                            <strong>All proof files approved</strong>
                            <p>This relief request has been fully verified. No further action needed.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </ApiState>
    </div>
  )
}
