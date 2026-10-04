import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Calendar, Users, MapPin, FileText, Check, X, Clock, 
  Package, Tag, Trash2, Image as ImageIcon, Lock, AlertCircle
} from 'lucide-react'
import ModalHeader from '../shared/ModalHeader'
import StatusBadge from '../shared/StatusBadge'
import { notify, showSuccessModal, confirmAction } from '../../../utils/confirm'
import { assistanceRequestsApi } from '../../../api/resources'
import { getAuthenticatedFileUrl } from '../../../api/auth'
import {
  getReliefRequestActionPermissions,
  validateStatusTransition,
  REQUEST_WORKFLOW,
  REQUEST_TERMINAL,
  REQUEST_BRANCHES,
  REQUEST_ALIASES,
} from '../../../utils/workflow'

export default function ReliefRequestModal({
  request,
  onClose,
  onUpdated,
  onDeleted,
}) {
  const navigate = useNavigate()
  const requestId = request?.dbId || request?.id

  // Authoritative live request status fetched directly from the database
  const [liveRequest, setLiveRequest] = useState(request)
  const [isLoadingFresh, setIsLoadingFresh] = useState(Boolean(requestId))

  useEffect(() => {
    if (!requestId) return

    let active = true
    assistanceRequestsApi.get(requestId)
      .then((res) => {
        if (!active) return
        const fresh = res?.data || res
        if (fresh && (fresh.id || fresh.dbId)) {
          setLiveRequest((prev) => ({ ...prev, ...fresh }))
        }
      })
      .catch((err) => {
        console.warn('Could not fetch live relief request from database:', err)
      })
      .finally(() => {
        if (active) setIsLoadingFresh(false)
      })

    return () => {
      active = false
    }
  }, [requestId])

  const permissions = useMemo(() => {
    return getReliefRequestActionPermissions(liveRequest?.status)
  }, [liveRequest?.status])

  // Clean structured notes to avoid repeating Calamity and Needs
  const cleanedInitialNotes = useMemo(() => {
    const raw = liveRequest?.notes || ''
    if (!raw) return ''
    const addMatch = raw.match(/Additional Notes:\s*([\s\S]+)/i)
    if (addMatch) return addMatch[1].trim()
    const stripped = raw
      .replace(/Calamity\/Program:\s*[^\n\r]+/gi, '')
      .replace(/Type of Needs:\s*[^\n\r]+/gi, '')
      .replace(/Goods Required:\s*[^\n\r]+/gi, '')
      .replace(/Families\s*Affected\s*:\s*\d+/gi, '')
      .trim()
    return stripped
  }, [liveRequest?.notes])

  const [notesDraft, setNotesDraft] = useState(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [selectedPriority, setSelectedPriority] = useState('')
  const notes = notesDraft ?? cleanedInitialNotes

  // Extract calamity cleanly
  const calamity = useMemo(() => {
    if (liveRequest?.calamityTags && Array.isArray(liveRequest.calamityTags) && liveRequest.calamityTags.length > 0) {
      return liveRequest.calamityTags[0]
    }
    if (liveRequest?.calamity) return liveRequest.calamity
    if (liveRequest?.notes) {
      const match = liveRequest.notes.match(/Calamity\/Program:\s*([^\n\r]+)/i)
      if (match) return match[1].trim()
    }
    return liveRequest?.reason || 'General Assistance'
  }, [liveRequest])

  // Extract needs cleanly
  const needsList = useMemo(() => {
    if (Array.isArray(liveRequest?.needs) && liveRequest.needs.length > 0) {
      return liveRequest.needs
    }
    if (typeof liveRequest?.needs === 'string' && liveRequest.needs.trim()) {
      return liveRequest.needs.split(',').map(s => s.trim()).filter(Boolean)
    }
    if (liveRequest?.type) {
      return liveRequest.type.split(',').map(s => s.trim()).filter(Boolean)
    }
    return []
  }, [liveRequest])

  // Request-specific affected families
  const affectedFamiliesCount = useMemo(() => {
    if (liveRequest?.affectedFamilies != null && Number(liveRequest.affectedFamilies) > 0) {
      return Number(liveRequest.affectedFamilies)
    }
    if (liveRequest?.families != null && Number(liveRequest.families) > 0) {
      return Number(liveRequest.families)
    }
    if (liveRequest?.notes) {
      const match = liveRequest.notes.match(/Families\s*Affected\s*:\s*(\d+)/i) || liveRequest.notes.match(/(\d+)\s*families/i)
      if (match) return parseInt(match[1], 10)
    }
    return 0
  }, [liveRequest])

  // Formatted submission date
  const formattedDate = useMemo(() => {
    const raw = liveRequest?.requestDate || liveRequest?.date || liveRequest?.createdAt
    if (!raw) return '—'
    try {
      return new Date(raw).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return raw
    }
  }, [liveRequest])

  if (!liveRequest) return null

  const isCompleted = String(liveRequest.status || '').toLowerCase() === 'completed'

  // Workflow update
  const handleStatusUpdate = async (nextStatus) => {
    const current = liveRequest.status || 'Pending Review'
    const check = validateStatusTransition({
      entityName: 'Assistance request',
      currentStatus: current,
      nextStatus,
      workflowOrder: REQUEST_WORKFLOW,
      terminalStatuses: REQUEST_TERMINAL,
      branches: REQUEST_BRANCHES,
      aliases: REQUEST_ALIASES,
    })
    if (!check.valid) {
      notify.error(check.message)
      return
    }

    if (nextStatus === 'Approved') {
      const ok = await confirmAction({
        title: 'Approve Relief Request',
        message: `Approve relief request for ${liveRequest.beneficiary || liveRequest.barangay || 'barangay'}? Once approved, approval and rejection actions are permanently completed.`,
        confirmText: 'Approve Request',
        type: 'success',
      })
      if (!ok) return
    } else if (nextStatus === 'Rejected') {
      const ok = await confirmAction({
        title: 'Reject Relief Request',
        message: `Reject relief request for ${liveRequest.beneficiary || liveRequest.barangay || 'barangay'}? This action is final and will allow permanent deletion.`,
        confirmText: 'Reject Request',
        type: 'danger',
      })
      if (!ok) return
    }

    setIsUpdating(true)
    try {
      const updates = {
        status: nextStatus,
        notes: notes,
      }
      const reqId = liveRequest.dbId || liveRequest.id
      await assistanceRequestsApi.update(reqId, updates)
      notify.success(`Request marked as ${nextStatus}.`)
      showSuccessModal(`Request successfully updated to "${nextStatus}".`)
      setLiveRequest(prev => ({ ...prev, ...updates }))
      if (onUpdated) {
        onUpdated({ ...liveRequest, ...updates })
      }
      onClose()
    } catch (err) {
      notify.error(err.message || 'Failed to update request')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleSaveNotesOnly = async () => {
    setIsUpdating(true)
    try {
      const reqId = liveRequest.dbId || liveRequest.id
      await assistanceRequestsApi.update(reqId, { notes })
      notify.success('Notes saved.')
      showSuccessModal('Request remarks successfully updated.')
      setLiveRequest(prev => ({ ...prev, notes }))
      setNotesDraft(null)
      if (onUpdated) {
        onUpdated({ ...liveRequest, notes })
      }
    } catch (err) {
      notify.error(err.message || 'Failed to save notes')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleAssignPriority = async () => {
    if (!selectedPriority) {
      notify.error('Select a Priority Level first.')
      return
    }
    const ok = await confirmAction({
      title: 'Assign Priority Level',
      message: `Assign ${selectedPriority} priority? This cannot be changed or overwritten afterward.`,
      confirmText: 'Assign & Lock Priority',
      type: 'success',
    })
    if (!ok) return
    setIsUpdating(true)
    try {
      const reqId = liveRequest.dbId || liveRequest.id
      const response = await assistanceRequestsApi.update(reqId, { priority: selectedPriority })
      const updated = response?.data || { priority: selectedPriority, priorityAssigned: true }
      setLiveRequest(prev => ({ ...prev, ...updated }))
      setSelectedPriority('')
      if (onUpdated) onUpdated({ ...liveRequest, ...updated })
      showSuccessModal('Priority assigned and permanently locked.')
    } catch (err) {
      notify.error(err.message || 'Failed to assign priority')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async () => {
    if (!permissions.canDelete) {
      notify.error('Only rejected relief requests can be deleted.')
      return
    }
    const ok = await confirmAction({
      title: 'Delete Relief Request',
      message: `Are you sure you want to permanently delete this rejected relief request? This action cannot be undone.`,
      confirmText: 'Delete Request',
      type: 'danger',
    })
    if (!ok) return

    setIsUpdating(true)
    try {
      const reqId = liveRequest.dbId || liveRequest.id
      await assistanceRequestsApi.remove(reqId)
      notify.success('Relief request permanently deleted.')
      showSuccessModal('Request successfully deleted.')
      if (onDeleted) {
        onDeleted(reqId)
      } else if (onUpdated) {
        onUpdated({ ...liveRequest, status: 'Deleted', _deleted: true })
      }
      onClose()
    } catch (err) {
      notify.error(err.message || 'Failed to delete request')
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div 
        className="admin-modal relief-modal-improved" 
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '760px', width: '94%', borderRadius: '14px', overflow: 'hidden' }}
      >
        <ModalHeader
          title={`Relief Request — ${liveRequest.id}`}
          subtitle={`Submitted for ${liveRequest.beneficiary || liveRequest.barangay || 'Barangay'}`}
          onClose={onClose}
        />

        {/* ── TOP ACTION & STATUS BAR (Approve/Reject for Pending only; Delete for Rejected only; NO buttons for Approved/Allocated/In Distribution/Completed) ── */}
        <div className="relief-modal-statusbar" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem 1.25rem',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          flexWrap: 'wrap',
          gap: '0.65rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            {liveRequest.priorityAssigned && liveRequest.priority ? <StatusBadge status={liveRequest.priority} /> : (
              <span className="badge" style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #cbd5e1' }}>
                Priority Not Assigned
              </span>
            )}
            <StatusBadge status={liveRequest.status} />
            {isLoadingFresh && (
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>
                syncing database…
              </span>
            )}
          </div>

          {/* Action Buttons: Pending → Approve/Reject | Rejected → Delete only | Approved/Allocated/In Distribution/Completed → NO Approve/Reject/Delete */}
          <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
            {/* 1. Pending / Under Review: Approve and Reject only (NO delete) */}
            {permissions.canApprove && (
              <>
                {liveRequest.status === 'Pending Review' && (
                  <button
                    type="button"
                    className="btn btn--outline btn--xs"
                    disabled={isUpdating}
                    onClick={() => handleStatusUpdate('Under Review')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      color: '#b45309',
                      borderColor: '#fde68a',
                      fontWeight: 650,
                      fontSize: '0.78rem',
                      padding: '0.35rem 0.65rem'
                    }}
                  >
                    <Clock size={12} style={{ flexShrink: 0 }} /> Mark Under Review
                  </button>
                )}

                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  disabled={isUpdating}
                  onClick={() => handleStatusUpdate('Rejected')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontWeight: 650,
                    fontSize: '0.82rem',
                    padding: '0.42rem 0.95rem',
                    borderRadius: '7px',
                    backgroundColor: '#dc2626',
                    borderColor: '#dc2626',
                    color: '#ffffff',
                    boxShadow: '0 1px 3px rgba(220, 38, 38, 0.25)',
                    cursor: 'pointer'
                  }}
                >
                  <X size={14} style={{ flexShrink: 0 }} /> Reject
                </button>

                <button
                  type="button"
                  className="btn btn--success btn--sm"
                  disabled={isUpdating || !liveRequest.priorityAssigned}
                  onClick={() => handleStatusUpdate('Approved')}
                  title={liveRequest.priorityAssigned ? 'Approve Request' : 'Assign and save the priority first'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontWeight: 650,
                    fontSize: '0.82rem',
                    padding: '0.42rem 1.05rem',
                    borderRadius: '7px',
                    backgroundColor: '#16a34a',
                    borderColor: '#16a34a',
                    color: '#ffffff',
                    boxShadow: '0 1px 3px rgba(22, 163, 74, 0.25)',
                    cursor: 'pointer'
                  }}
                >
                  <Check size={14} style={{ flexShrink: 0 }} /> Approve Request
                </button>
              </>
            )}

            {/* 2. Rejected: Delete only (NO approve, NO reject) */}
            {permissions.canDelete && (
              <button
                type="button"
                className="btn btn--danger btn--sm"
                disabled={isUpdating}
                onClick={handleDelete}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontWeight: 650,
                  fontSize: '0.82rem',
                  padding: '0.42rem 0.95rem',
                  borderRadius: '7px',
                  backgroundColor: '#dc2626',
                  borderColor: '#dc2626',
                  color: '#ffffff',
                  boxShadow: '0 1px 3px rgba(220, 38, 38, 0.25)',
                  cursor: 'pointer'
                }}
              >
                <Trash2 size={14} style={{ flexShrink: 0 }} /> Delete Request
              </button>
            )}

            {/* 3. Approved: Allocate warehouse stock navigation only (NO Approve, NO Reject, NO Delete) */}
            {permissions.isApproved && !liveRequest.hasAllocation && (
              <button
                type="button"
                className="btn btn--primary btn--xs"
                onClick={() => {
                  onClose()
                  navigate('/admin/allocation', {
                    state: {
                      prefillRequest: {
                        requestId: liveRequest.dbId || liveRequest.id,
                        beneficiaryId: liveRequest.beneficiaryId,
                        type: liveRequest.type,
                        notes: liveRequest.notes,
                        beneficiaryName: liveRequest.beneficiary || liveRequest.barangay,
                        affectedFamilies: affectedFamiliesCount,
                      },
                    },
                  })
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontWeight: 650,
                  fontSize: '0.78rem',
                  padding: '0.38rem 0.75rem',
                  borderRadius: '7px',
                  backgroundColor: '#af101a',
                  borderColor: '#af101a',
                  color: '#ffffff',
                  boxShadow: '0 1px 3px rgba(175, 16, 26, 0.25)',
                  cursor: 'pointer'
                }}
              >
                <span>Allocate Warehouse Stock</span>
                <span>&rarr;</span>
              </button>
            )}

            {/* 4. Allocated / In Distribution / Completed / Cancelled: Absolutely NO Approve, NO Reject, NO Delete */}
          </div>
        </div>

        {/* ── MODAL BODY ── */}
        <div className="relief-modal-body" style={{ padding: '1.15rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!isCompleted && (
          <div className="relief-modal-card" style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem 1.15rem', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.8rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>Priority Assessment</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>Review the disaster photos, then assign the severity once.</div>
              </div>
              {liveRequest.priorityAssigned ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.45rem 0.65rem', borderRadius: '7px', background: '#f8fafc', border: '1px solid #e2e8f0', fontWeight: 700 }}>
                  <Lock size={14} color="#64748b" /> {liveRequest.priority} Priority
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <select value={selectedPriority} onChange={(e) => setSelectedPriority(e.target.value)} disabled={isUpdating} style={{ minWidth: '175px' }}>
                    <option value="">Select priority...</option>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                  <button type="button" className="btn btn--success btn--sm" disabled={isUpdating || !selectedPriority} onClick={handleAssignPriority}>
                    <Check size={13} /> Assign & Lock
                  </button>
                </div>
              )}
            </div>
          </div>
          )}

          <div className="relief-modal-card relief-proof-card" style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem 1.15rem', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>
              <ImageIcon size={14} /> Disaster Proof / Photos
            </div>
            {Array.isArray(liveRequest.disasterProofs) && liveRequest.disasterProofs.length > 0 ? (
              <div className="relief-proof-grid">
                {liveRequest.disasterProofs.map((proof) => (
                  <a key={proof.id || proof.url} href={getAuthenticatedFileUrl(proof.url)} target="_blank" rel="noreferrer" className="relief-proof-preview" title="Open full-size disaster photo">
                    <span className="relief-proof-preview__image">
                      <img src={getAuthenticatedFileUrl(proof.url)} alt={`Disaster proof: ${proof.name || 'uploaded photo'}`} />
                    </span>
                    <span className="relief-proof-preview__name"><ImageIcon size={14} /><span>{proof.name || 'Disaster proof photo'}</span></span>
                  </a>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.55rem', color: '#64748b', fontSize: '0.82rem' }}>
                <AlertCircle size={14} /> No disaster proof photos were uploaded.
              </div>
            )}
          </div>
          
          {/* Main Request Information Card */}
          <div className="relief-modal-card" style={{
            background: 'var(--admin-surface, #ffffff)',
            border: '1px solid var(--admin-border, #e2e8f0)',
            borderRadius: '10px',
            padding: '1rem 1.15rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--admin-brand, #af101a)' }}>
                <Tag size={14} style={{ flexShrink: 0 }} />
              </span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>
                Request Details
              </span>
            </div>

            {/* Aligned Key-Value Details */}
            <div className="relief-request-details-list">
              <span>Relief Request ID:</span>
              <strong>{liveRequest.id || liveRequest.code}</strong>

              <span>Priority:</span>
              <div>{liveRequest.priority ? <StatusBadge status={liveRequest.priority} /> : <span className="relief-request-muted">Not Assigned</span>}</div>

              <span>Status:</span>
              <div><StatusBadge status={liveRequest.status} /></div>
              
              {/* Calamity / Disaster */}
              <span>Calamity / Disaster Type:</span>
              <span style={{ fontWeight: 650, color: '#0f172a' }}>{calamity}</span>

              {/* Needs */}
              <span>Requested Needs:</span>
              <div className="relief-request-needs">
                {needsList.length > 0 ? (
                  needsList.map((need, idx) => (
                    <span 
                      key={idx}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        color: '#334155',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        padding: '0.2rem 0.55rem',
                        borderRadius: '6px',
                      }}
                    >
                      <Package size={12} style={{ color: '#af101a', flexShrink: 0 }} />
                      <span>{need}</span>
                    </span>
                  ))
                ) : (
                  <span style={{ color: '#94a3b8' }}>General Relief Goods</span>
                )}
              </div>

              {/* Affected Families */}
              <span>Affected Families:</span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', lineHeight: 1 }}>
                <Users size={14} style={{ color: '#af101a', flexShrink: 0, display: 'block' }} />
                <span style={{ fontWeight: 700, fontSize: '0.94rem', color: '#af101a', lineHeight: 1 }}>
                  {affectedFamiliesCount.toLocaleString()} {affectedFamiliesCount === 1 ? 'family' : 'families'}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>(for this request)</span>
              </div>

              {/* Request Date */}
              <span>Request Date:</span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#334155' }}>
                <Calendar size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                <span>{formattedDate}</span>
              </div>

              {/* Barangay Location */}
              <span>Barangay:</span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#334155' }}>
                <MapPin size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                <span>
                  <strong>{liveRequest.beneficiary || liveRequest.barangay || '—'}</strong>
                  {liveRequest.municipality ? ` (${liveRequest.municipality})` : ''}
                </span>
              </div>
            </div>

            {/* Description & Notes */}
            <div style={{ marginTop: '0.35rem', paddingTop: '0.65rem', borderTop: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 650, color: '#475569', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <FileText size={12} style={{ flexShrink: 0 }} /> Description / Notes
                </label>
                {!isCompleted && notes !== cleanedInitialNotes && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--xs"
                    onClick={handleSaveNotesOnly}
                    disabled={isUpdating}
                    style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem' }}
                  >
                    Save Notes
                  </button>
                )}
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotesDraft(e.target.value)}
                readOnly={isCompleted}
                aria-readonly={isCompleted}
                placeholder="Enter situation details, delivery instructions, or notes…"
                rows={3}
                className={isCompleted ? 'relief-request-notes-input relief-request-notes-input--readonly' : 'relief-request-notes-input'}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  fontSize: '0.82rem',
                  lineHeight: '1.4',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          </div>

        </div>

        {/* Modal Close Button at bottom */}
        <div className="relief-modal-footer" style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '0.65rem 1.25rem',
          background: '#fafafa',
          borderTop: '1px solid var(--admin-border, #e2e8f0)',
        }}>
          <button 
            type="button" 
            className="btn btn--outline btn--sm" 
            onClick={onClose}
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}
          >
            Close
          </button>
        </div>

      </div>
    </div>
  )
}
