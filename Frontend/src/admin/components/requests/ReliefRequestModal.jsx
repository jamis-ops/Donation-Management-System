import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Calendar, Users, MapPin, FileText, Check, X, Clock, 
  Package, Tag, Trash2
} from 'lucide-react'
import ModalHeader from '../shared/ModalHeader'
import StatusBadge from '../shared/StatusBadge'
import { notify, showSuccessModal, confirmAction } from '../../../utils/confirm'
import { assistanceRequestsApi } from '../../../api/resources'
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
  onProcure,
  availableMonetaryDonations = [],
}) {
  const navigate = useNavigate()

  // Authoritative live request status fetched directly from the database
  const [liveRequest, setLiveRequest] = useState(request)
  const [isLoadingFresh, setIsLoadingFresh] = useState(false)

  useEffect(() => {
    setLiveRequest(request)
    const reqId = request?.dbId || request?.id
    if (!reqId) return

    let active = true
    setIsLoadingFresh(true)
    assistanceRequestsApi.get(reqId)
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
  }, [request?.dbId, request?.id])

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

  const [notes, setNotes] = useState(cleanedInitialNotes)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    setNotes(cleanedInitialNotes)
  }, [cleanedInitialNotes])

  if (!liveRequest) return null

  // Extract calamity cleanly
  const calamity = useMemo(() => {
    if (liveRequest.calamityTags && Array.isArray(liveRequest.calamityTags) && liveRequest.calamityTags.length > 0) {
      return liveRequest.calamityTags[0]
    }
    if (liveRequest.calamity) return liveRequest.calamity
    if (liveRequest.notes) {
      const match = liveRequest.notes.match(/Calamity\/Program:\s*([^\n\r]+)/i)
      if (match) return match[1].trim()
    }
    return liveRequest.reason || 'General Assistance'
  }, [liveRequest])

  // Extract needs cleanly
  const needsList = useMemo(() => {
    if (Array.isArray(liveRequest.needs) && liveRequest.needs.length > 0) {
      return liveRequest.needs
    }
    if (typeof liveRequest.needs === 'string' && liveRequest.needs.trim()) {
      return liveRequest.needs.split(',').map(s => s.trim()).filter(Boolean)
    }
    if (liveRequest.type) {
      return liveRequest.type.split(',').map(s => s.trim()).filter(Boolean)
    }
    return []
  }, [liveRequest])

  // Request-specific affected families
  const affectedFamiliesCount = useMemo(() => {
    if (liveRequest.affectedFamilies != null && Number(liveRequest.affectedFamilies) > 0) {
      return Number(liveRequest.affectedFamilies)
    }
    if (liveRequest.families != null && Number(liveRequest.families) > 0) {
      return Number(liveRequest.families)
    }
    if (liveRequest.notes) {
      const match = liveRequest.notes.match(/Families\s*Affected\s*:\s*(\d+)/i) || liveRequest.notes.match(/(\d+)\s*families/i)
      if (match) return parseInt(match[1], 10)
    }
    return 0
  }, [liveRequest])

  // Formatted submission date
  const formattedDate = useMemo(() => {
    const raw = liveRequest.requestDate || liveRequest.date || liveRequest.createdAt
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
        type: 'primary',
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
      if (onUpdated) {
        onUpdated({ ...liveRequest, notes })
      }
    } catch (err) {
      notify.error(err.message || 'Failed to save notes')
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
        style={{ maxWidth: '640px', width: '92%', borderRadius: '14px', overflow: 'hidden' }}
      >
        <ModalHeader
          title={`Relief Request — ${liveRequest.id}`}
          subtitle={`Submitted for ${liveRequest.beneficiary || liveRequest.barangay || 'Barangay'}`}
          onClose={onClose}
        />

        {/* ── TOP ACTION & STATUS BAR (Approve/Reject for Pending only; Delete for Rejected only; NO buttons for Approved/Allocated/In Distribution/Completed) ── */}
        <div style={{
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
            {liveRequest.priority && <StatusBadge status={liveRequest.priority} />}
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
                  disabled={isUpdating}
                  onClick={() => handleStatusUpdate('Approved')}
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
            <div style={{ display: 'grid', gridTemplateColumns: '125px 1fr', rowGap: '0.65rem', columnGap: '0.85rem', alignItems: 'center', fontSize: '0.86rem' }}>
              
              {/* Calamity / Disaster */}
              <span style={{ color: '#64748b', fontWeight: 600 }}>Calamity:</span>
              <span style={{ fontWeight: 650, color: '#0f172a' }}>{calamity}</span>

              {/* Needs */}
              <span style={{ color: '#64748b', fontWeight: 600 }}>Needs:</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
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
              <span style={{ color: '#64748b', fontWeight: 600 }}>Affected Families:</span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', lineHeight: 1 }}>
                <Users size={14} style={{ color: '#af101a', flexShrink: 0, display: 'block' }} />
                <span style={{ fontWeight: 700, fontSize: '0.94rem', color: '#af101a', lineHeight: 1 }}>
                  {affectedFamiliesCount.toLocaleString()} {affectedFamiliesCount === 1 ? 'family' : 'families'}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>(for this request)</span>
              </div>

              {/* Request Date */}
              <span style={{ color: '#64748b', fontWeight: 600 }}>Request Date:</span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#334155' }}>
                <Calendar size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                <span>{formattedDate}</span>
              </div>

              {/* Barangay Location */}
              <span style={{ color: '#64748b', fontWeight: 600 }}>Barangay:</span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#334155' }}>
                <MapPin size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                <span>
                  <strong>{request.beneficiary || request.barangay || '—'}</strong>
                  {request.municipality ? ` (${request.municipality})` : ''}
                </span>
              </div>
            </div>

            {/* Description & Notes */}
            <div style={{ marginTop: '0.35rem', paddingTop: '0.65rem', borderTop: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 650, color: '#475569', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <FileText size={12} style={{ flexShrink: 0 }} /> Description & Administrative Notes
                </label>
                {notes !== cleanedInitialNotes && (
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
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter situation details, delivery instructions, or notes…"
                rows={2}
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
        <div style={{
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
