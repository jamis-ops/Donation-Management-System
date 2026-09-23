import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Calendar, Users, MapPin, FileText, Check, X, Clock, 
  AlertTriangle, CheckCircle2, XCircle, Package, Sparkles, Tag, ShieldAlert
} from 'lucide-react'
import ModalHeader from '../shared/ModalHeader'
import StatusBadge from '../shared/StatusBadge'
import { notify, showSuccessModal } from '../../../utils/confirm'
import { assistanceRequestsApi } from '../../../api/resources'

export default function ReliefRequestModal({
  request,
  onClose,
  onUpdated,
  onProcure,
  availableMonetaryDonations = [],
}) {
  const navigate = useNavigate()
  const [notes, setNotes] = useState(request?.notes || '')
  const [isUpdating, setIsUpdating] = useState(false)

  if (!request) return null

  // Extract calamity cleanly
  const calamity = useMemo(() => {
    if (request.calamityTags && Array.isArray(request.calamityTags) && request.calamityTags.length > 0) {
      return request.calamityTags[0]
    }
    if (request.calamity) return request.calamity
    if (request.notes) {
      const match = request.notes.match(/Calamity\/Program:\s*([^\n\r]+)/i)
      if (match) return match[1].trim()
    }
    return request.reason || 'General Assistance'
  }, [request])

  // Extract needs cleanly
  const needsList = useMemo(() => {
    if (Array.isArray(request.needs) && request.needs.length > 0) {
      return request.needs
    }
    if (typeof request.needs === 'string' && request.needs.trim()) {
      return request.needs.split(',').map(s => s.trim()).filter(Boolean)
    }
    if (request.type) {
      return request.type.split(',').map(s => s.trim()).filter(Boolean)
    }
    return []
  }, [request])

  // Request-specific affected families
  const affectedFamiliesCount = useMemo(() => {
    if (request.affectedFamilies != null && Number(request.affectedFamilies) > 0) {
      return Number(request.affectedFamilies)
    }
    if (request.families != null && Number(request.families) > 0) {
      return Number(request.families)
    }
    if (request.notes) {
      const match = request.notes.match(/Families\s*Affected\s*:\s*(\d+)/i) || request.notes.match(/(\d+)\s*families/i)
      if (match) return parseInt(match[1], 10)
    }
    return 0
  }, [request])

  // Formatted submission date
  const formattedDate = useMemo(() => {
    const raw = request.requestDate || request.date || request.createdAt
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
  }, [request])

  // Workflow update
  const handleStatusUpdate = async (nextStatus) => {
    setIsUpdating(true)
    try {
      const updates = {
        status: nextStatus,
        notes: notes,
      }
      const reqId = request.dbId || request.id
      await assistanceRequestsApi.update(reqId, updates)
      notify.success(`Request marked as ${nextStatus}.`)
      showSuccessModal(`Request successfully updated to "${nextStatus}".`)
      if (onUpdated) {
        onUpdated({ ...request, ...updates })
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
      const reqId = request.dbId || request.id
      await assistanceRequestsApi.update(reqId, { notes })
      notify.success('Notes saved.')
      showSuccessModal('Request remarks successfully updated.')
      if (onUpdated) {
        onUpdated({ ...request, notes })
      }
    } catch (err) {
      notify.error(err.message || 'Failed to save notes')
    } finally {
      setIsUpdating(false)
    }
  }

  const isTerminal = ['Completed', 'Done', 'Rejected', 'Cancelled'].includes(request.status)

  return (
    <div className="admin-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div 
        className="admin-modal relief-modal-improved" 
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '680px', width: '94%' }}
      >
        <ModalHeader
          title={`Relief Request — ${request.id}`}
          subtitle={`Submitted for ${request.beneficiary || request.barangay || 'Barangay'}`}
          onClose={onClose}
        />

        <div className="relief-modal-body" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Main Request Information Card */}
          <div className="relief-modal-card" style={{
            background: 'var(--admin-surface, #ffffff)',
            border: '1px solid var(--admin-border, #e2e8f0)',
            borderRadius: '12px',
            padding: '1.15rem 1.35rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Tag size={15} style={{ color: 'var(--admin-brand, #af101a)' }} />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>
                  Request Information
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                {request.priority && <StatusBadge status={request.priority} />}
                <StatusBadge status={request.status} />
              </div>
            </div>

            {/* Aligned Key-Value Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', rowGap: '0.75rem', columnGap: '1rem', alignItems: 'center', fontSize: '0.88rem' }}>
              
              {/* Calamity / Disaster */}
              <span style={{ color: '#64748b', fontWeight: 600 }}>Calamity:</span>
              <div>
                <span style={{ fontWeight: 650, color: '#0f172a' }}>{calamity}</span>
              </div>

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
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px',
                      }}
                    >
                      <Package size={12} style={{ color: '#af101a' }} />
                      {need}
                    </span>
                  ))
                ) : (
                  <span style={{ color: '#94a3b8' }}>General Relief Goods</span>
                )}
              </div>

              {/* Affected Families (Request-Specific!) */}
              <span style={{ color: '#64748b', fontWeight: 600 }}>Affected Families:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Users size={14} style={{ color: '#af101a' }} />
                <span style={{ fontWeight: 700, fontSize: '0.96rem', color: '#af101a' }}>
                  {affectedFamiliesCount.toLocaleString()} {affectedFamiliesCount === 1 ? 'family' : 'families'}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>(for this request)</span>
              </div>

              {/* Request Date */}
              <span style={{ color: '#64748b', fontWeight: 600 }}>Request Date:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#334155' }}>
                <Calendar size={13} style={{ color: '#64748b' }} />
                <span>{formattedDate}</span>
              </div>

              {/* Barangay Location */}
              <span style={{ color: '#64748b', fontWeight: 600 }}>Barangay:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#334155' }}>
                <MapPin size={13} style={{ color: '#64748b' }} />
                <span>
                  <strong>{request.beneficiary || request.barangay || '—'}</strong>
                  {request.municipality ? ` (${request.municipality})` : ''}
                </span>
              </div>
            </div>

            {/* Description & Notes */}
            <div style={{ marginTop: '0.4rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 650, color: '#475569', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <FileText size={13} /> Description & Administrative Notes
                </label>
                <button
                  type="button"
                  className="btn btn--ghost btn--xs"
                  onClick={handleSaveNotesOnly}
                  disabled={isUpdating || notes === (request.notes || '')}
                  style={{ fontSize: '0.74rem' }}
                >
                  Save Notes
                </button>
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter situation details, delivery instructions, or notes…"
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.8rem',
                  fontSize: '0.84rem',
                  lineHeight: '1.45',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          </div>

        </div>

        {/* Modal Actions Footer */}
        <div className="admin-modal__actions" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--admin-border, #e2e8f0)',
          background: '#fafafa',
          borderBottomLeftRadius: '14px',
          borderBottomRightRadius: '14px',
        }}>
          <button 
            type="button" 
            className="btn btn--outline btn--sm" 
            onClick={onClose}
          >
            Close
          </button>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {request.status === 'Pending Review' && (
              <button
                type="button"
                className="btn btn--outline btn--sm"
                disabled={isUpdating}
                onClick={() => handleStatusUpdate('Under Review')}
                style={{ color: '#b45309', borderColor: '#fde68a' }}
              >
                <Clock size={13} /> Mark Under Review
              </button>
            )}

            {!isTerminal && request.status !== 'Approved' && (
              <button
                type="button"
                className="btn btn--danger btn--sm"
                disabled={isUpdating}
                onClick={() => handleStatusUpdate('Rejected')}
              >
                <X size={13} /> Reject
              </button>
            )}

            {!isTerminal && request.status !== 'Approved' && (
              <button
                type="button"
                className="btn btn--success btn--sm"
                disabled={isUpdating}
                onClick={() => handleStatusUpdate('Approved')}
              >
                <Check size={13} /> Approve Request
              </button>
            )}

            {request.status === 'Approved' && (
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => {
                  onClose()
                  navigate('/admin/allocation', {
                    state: {
                      prefillRequest: {
                        requestId: request.dbId || request.id,
                        beneficiaryId: request.beneficiaryId,
                        type: request.type,
                        notes: request.notes,
                        beneficiaryName: request.beneficiary || request.barangay,
                        affectedFamilies: affectedFamiliesCount,
                      },
                    },
                  })
                }}
              >
                Allocate Warehouse Stock &rarr;
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
