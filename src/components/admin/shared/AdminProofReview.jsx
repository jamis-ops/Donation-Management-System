import { useMemo, useState } from 'react'
import {
  CheckCircle2, XCircle, Eye, Download, FileText, MapPin, Calendar, Building2,
} from 'lucide-react'
import StatusBadge from './StatusBadge'
import { reviewProof } from '../../../api/resources'

function isPending(status) {
  return status === 'Pending' || status === 'Pending Review'
}

export default function AdminProofReview({
  proofs,
  onChanged,
  lockedBeneficiaryId = null,
  lockedBarangay = '',
  hideBarangayFilter = false,
}) {
  const [preview, setPreview] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const [remarks, setRemarks] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [barangayFilter, setBarangayFilter] = useState(lockedBarangay || '')
  const [toast, setToast] = useState('')

  const scoped = useMemo(() => {
    if (lockedBeneficiaryId) {
      return proofs.filter((p) => Number(p.beneficiaryId) === Number(lockedBeneficiaryId))
    }
    if (lockedBarangay) {
      return proofs.filter((p) => p.barangay === lockedBarangay)
    }
    return proofs
  }, [proofs, lockedBeneficiaryId, lockedBarangay])

  const barangays = useMemo(() => {
    const set = new Set(scoped.map((p) => p.barangay).filter(Boolean))
    return [...set].sort()
  }, [scoped])

  const filtered = scoped.filter((p) => {
    if (filter === 'pending' && !isPending(p.status)) return false
    if (filter === 'approved' && p.status !== 'Approved') return false
    if (filter === 'rejected' && p.status !== 'Rejected') return false
    if (!hideBarangayFilter && !lockedBarangay && barangayFilter && p.barangay !== barangayFilter) return false
    return true
  })

  const counts = {
    pending: scoped.filter((p) => isPending(p.status)).length,
    approved: scoped.filter((p) => p.status === 'Approved').length,
    rejected: scoped.filter((p) => p.status === 'Rejected').length,
  }

  const flash = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2800)
  }

  const approve = async (proof) => {
    if (!window.confirm(`Approve proof from ${proof.barangay} for "${proof.eventName || proof.distributionCode}"?`)) return
    setBusyId(proof.id)
    try {
      await reviewProof(proof.id, 'Approved')
      flash('Proof approved successfully.')
      onChanged?.()
    } catch (err) {
      alert(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const submitReject = async (e) => {
    e.preventDefault()
    if (!rejecting) return
    if (!remarks.trim()) {
      alert('Please provide a rejection reason for the barangay.')
      return
    }
    setBusyId(rejecting.id)
    try {
      await reviewProof(rejecting.id, 'Rejected', remarks.trim())
      setRejecting(null)
      setRemarks('')
      flash('Proof rejected. The barangay has been notified.')
      onChanged?.()
    } catch (err) {
      alert(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="proof-review">
      {toast && <div className="proof-review__toast" role="status">{toast}</div>}

      <div className="proof-review__toolbar">
        <div className="proof-review__chips">
          <button type="button" className={`proof-chip${filter === 'all' ? ' proof-chip--active' : ''}`} onClick={() => setFilter('all')}>
            All <span>{scoped.length}</span>
          </button>
          <button type="button" className={`proof-chip proof-chip--pending${filter === 'pending' ? ' proof-chip--active' : ''}`} onClick={() => setFilter('pending')}>
            Pending <span>{counts.pending}</span>
          </button>
          <button type="button" className={`proof-chip proof-chip--ok${filter === 'approved' ? ' proof-chip--active' : ''}`} onClick={() => setFilter('approved')}>
            Approved <span>{counts.approved}</span>
          </button>
          <button type="button" className={`proof-chip proof-chip--bad${filter === 'rejected' ? ' proof-chip--active' : ''}`} onClick={() => setFilter('rejected')}>
            Rejected <span>{counts.rejected}</span>
          </button>
        </div>
        {!hideBarangayFilter && !lockedBarangay && !lockedBeneficiaryId && (
          <label className="proof-review__barangay-filter">
            Barangay
            <select value={barangayFilter} onChange={(e) => setBarangayFilter(e.target.value)}>
              <option value="">All barangays</option>
              {barangays.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="proof-review__empty">
          <FileText size={28} />
          <p>No proof submissions match this filter.</p>
        </div>
      ) : (
        <div className="proof-review__grid">
          {filtered.map((p) => (
            <article key={p.id} className={`proof-card proof-card--${(p.status || 'Pending').toLowerCase()}`}>
              <div className="proof-card__media">
                {p.isImage ? (
                  <button type="button" className="proof-card__thumb" onClick={() => setPreview(p)} aria-label="Preview image">
                    <img src={p.fileUrl} alt={p.fileName} loading="lazy" />
                  </button>
                ) : (
                  <div className="proof-card__file-icon">
                    <FileText size={28} />
                    <span>PDF / Document</span>
                  </div>
                )}
                <StatusBadge status={p.status} />
              </div>

              <div className="proof-card__body">
                <h3>{p.eventName || p.distributionCode}</h3>
                <p className="proof-card__meta">
                  <Building2 size={14} /> {p.barangay || '—'}
                </p>
                <p className="proof-card__meta">
                  <MapPin size={14} /> {p.distributionLocation || '—'}
                </p>
                <p className="proof-card__meta">
                  <Calendar size={14} /> Submitted {p.submittedAt}
                </p>
                {p.notes && <p className="proof-card__notes">{p.notes}</p>}
                {p.status === 'Rejected' && p.reviewRemarks && (
                  <div className="proof-card__remarks">
                    <strong>Rejection reason</strong>
                    <p>{p.reviewRemarks}</p>
                  </div>
                )}
                {p.status === 'Approved' && p.reviewedAt && (
                  <p className="proof-card__reviewed">Approved {p.reviewedAt}</p>
                )}
              </div>

              <div className="proof-card__actions">
                <button type="button" className="btn btn--sm btn--outline" onClick={() => setPreview(p)}>
                  <Eye size={14} /> View
                </button>
                <a href={p.fileUrl} download={p.fileName} className="btn btn--sm btn--outline" target="_blank" rel="noreferrer">
                  <Download size={14} /> Download
                </a>
                {isPending(p.status) && (
                  <>
                    <button
                      type="button"
                      className="btn btn--sm btn--primary"
                      disabled={busyId === p.id}
                      onClick={() => approve(p)}
                    >
                      <CheckCircle2 size={14} /> {busyId === p.id ? '…' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      className="btn btn--sm btn--danger"
                      disabled={busyId === p.id}
                      onClick={() => { setRejecting(p); setRemarks('') }}
                    >
                      <XCircle size={14} /> Reject
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {preview && (
        <div className="admin-modal-overlay" onClick={() => setPreview(null)}>
          <div className="admin-modal admin-modal--wide proof-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="proof-preview-modal__head">
              <div>
                <h2>{preview.eventName || preview.distributionCode}</h2>
                <p>{preview.barangay} · {preview.fileName}</p>
              </div>
              <StatusBadge status={preview.status} />
            </div>
            <div className="proof-preview-modal__body">
              {preview.isImage ? (
                <img src={preview.fileUrl} alt={preview.fileName} />
              ) : (
                <div className="proof-preview-modal__doc">
                  <FileText size={40} />
                  <p>This file type can’t be previewed inline.</p>
                  <a href={preview.fileUrl} target="_blank" rel="noreferrer" className="btn btn--primary">Open / Download</a>
                </div>
              )}
            </div>
            <div className="admin-modal__actions">
              <a href={preview.fileUrl} download={preview.fileName} className="btn btn--outline" target="_blank" rel="noreferrer">
                <Download size={14} /> Download
              </a>
              {isPending(preview.status) && (
                <>
                  <button type="button" className="btn btn--primary" onClick={() => { setPreview(null); approve(preview) }}>
                    Approve
                  </button>
                  <button type="button" className="btn btn--danger" onClick={() => { setRejecting(preview); setRemarks(''); setPreview(null) }}>
                    Reject
                  </button>
                </>
              )}
              <button type="button" className="btn btn--ghost" onClick={() => setPreview(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {rejecting && (
        <div className="admin-modal-overlay" onClick={() => setRejecting(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Reject proof</h2>
            <p className="proof-reject-copy">
              Tell <strong>{rejecting.barangay}</strong> why this submission for
              {' '}<strong>{rejecting.eventName || rejecting.distributionCode}</strong> was rejected so they can resubmit.
            </p>
            <form onSubmit={submitReject}>
              <label>
                Reason / remarks
                <textarea
                  required
                  rows={4}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Photo is unclear / wrong distribution event / missing signature page…"
                />
              </label>
              <div className="admin-modal__actions">
                <button type="submit" className="btn btn--danger" disabled={busyId === rejecting.id}>
                  {busyId === rejecting.id ? 'Rejecting…' : 'Confirm Reject'}
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setRejecting(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
