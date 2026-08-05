import { useEffect, useState } from 'react'
import { Search, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import ModalHeader from '../../components/admin/shared/ModalHeader'
import RequestProgressTracker from '../../components/beneficiary/RequestProgressTracker'
import { assistanceRequestsApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { usePagination, DEFAULT_PAGE_SIZE } from '../../hooks/usePagination'
import Pagination from '../../components/admin/shared/Pagination'
import Req from '../../components/shared/Req'
import NeedsPicker from '../../components/shared/NeedsPicker'
import { notify } from '../../utils/toast'

// Calamity/Event types
const CALAMITY_TYPES = [
  'Typhoon/Storm',
  'Flood',
  'Fire',
  'Earthquake',
  'Landslide',
  'Health Emergency/Pandemic',
  'Drought',
  'Other Disaster',
]

// Mission/Program types
const MISSION_TYPES = [
  'Feeding Program',
  'Medical Mission',
  'Educational Support',
  'Livelihood Program',
  'Community Development',
  'Disaster Prevention',
]

const emptyForm = {
  calamityType: '',
  customCalamity: '',
  selectedNeeds: [],
  familiesAffected: '',
  priority: 'Medium',
  notes: '',
}

const CLOSED_STATUSES = ['Completed', 'Rejected', 'Cancelled', 'Done']

function canEditRequest(request) {
  return Boolean(request) && !CLOSED_STATUSES.includes(request.status)
}

/** Structured fields from request notes / needs for cards & detail modal. */
function getRequestPreview(request) {
  const notes = String(request?.notes || '')
  const calamityMatch = notes.match(/Calamity\/Program:\s*(.+?)(?:\n|$)/i)
  const familiesMatch = notes.match(/Families Affected:\s*(\d+)/i)
  let needs = Array.isArray(request?.needs) ? request.needs.filter(Boolean) : []
  if (needs.length === 0) {
    const needsMatch = notes.match(/Type of Needs:\s*(.+?)(?:\n|$)/i)
      || notes.match(/Goods Required:\s*(.+?)(?:\n|$)/i)
    if (needsMatch) {
      needs = needsMatch[1].split(',').map((n) => n.trim()).filter(Boolean)
    } else if (request?.type) {
      needs = String(request.type).split(',').map((n) => n.trim()).filter(Boolean)
    }
  }
  const notesMatch = notes.match(/Additional Notes:\s*([\s\S]+)/i)
  const extraNotes = notesMatch ? notesMatch[1].trim() : ''
  return {
    calamity: calamityMatch ? calamityMatch[1].trim() : '',
    families: familiesMatch ? familiesMatch[1] : '',
    needs,
    extraNotes,
    hasStructured: Boolean(calamityMatch || familiesMatch || needs.length || extraNotes),
  }
}

function canCancelRequest(request) {
  return Boolean(request) && ['Pending Review', 'Under Review'].includes(request.status)
}

export default function BeneficiaryRequestsPage() {
  const { data, loading, error, reload } = useApiList(() => assistanceRequestsApi.list())
  const [showForm, setShowForm] = useState(false)
  const [editingRequest, setEditingRequest] = useState(null)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  // Keep progress tracker in sync when list reloads or status changes server-side.
  useEffect(() => {
    if (!selectedRequest?.dbId) return
    const fresh = (data || []).find((r) => Number(r.dbId) === Number(selectedRequest.dbId))
    if (fresh && (
      fresh.status !== selectedRequest.status
      || fresh.notes !== selectedRequest.notes
      || fresh.priority !== selectedRequest.priority
    )) {
      setSelectedRequest(fresh)
    }
  }, [data, selectedRequest])

  useEffect(() => {
    if (!selectedRequest?.dbId) return undefined
    const id = window.setInterval(() => { reload() }, 30000)
    return () => window.clearInterval(id)
  }, [selectedRequest?.dbId, reload])

  // Filter requests
  const filteredData = data.filter((r) => {
    const matchesSearch = !searchQuery ||
      (r.type || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.notes || '').toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'All' || r.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const paging = usePagination(filteredData, DEFAULT_PAGE_SIZE, `${searchQuery}|${statusFilter}`)

  const statusCounts = {
    All: data.length,
    'Under Review': data.filter(r => r.status === 'Under Review').length,
    'Approved': data.filter(r => r.status === 'Approved').length,
    'Completed': data.filter(r => r.status === 'Completed').length,
    'Rejected': data.filter(r => r.status === 'Rejected').length,
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setSubmitError('')
    
    // Validation
    if (!form.calamityType.trim()) {
      setSubmitError('Please select the type of calamity/program.')
      return
    }
    
    if (form.calamityType === 'Other' && !form.customCalamity.trim()) {
      setSubmitError('Please specify the calamity type.')
      return
    }
    
    if (!form.selectedNeeds.length) {
      setSubmitError('Please select at least one Type of Need from the Admin catalog.')
      return
    }
    
    if (!form.familiesAffected || Number(form.familiesAffected) < 1) {
      setSubmitError('Please enter the number of families affected (at least 1).')
      return
    }
    
    // Build request
    const calamityType = form.calamityType === 'Other' ? form.customCalamity : form.calamityType
    const needs = form.selectedNeeds
    const assistanceType = needs.join(', ')
    
    // Build notes with structured information
    const structuredNotes = [
      `Calamity/Program: ${calamityType}`,
      `Type of Needs: ${needs.join(', ')}`,
      `Families Affected: ${form.familiesAffected}`,
      form.notes ? `Additional Notes: ${form.notes}` : '',
    ].filter(Boolean).join('\n\n')
    
    setSaving(true)
    try {
      if (editingRequest) {
        // Update existing request
        await assistanceRequestsApi.update(editingRequest.dbId, {
          type: assistanceType,
          priority: form.priority,
          notes: structuredNotes,
          calamityTags: [calamityType],
          needs,
        })
        setEditingRequest(null)
        notify.success('Request updated.')
      } else {
        // Create new request
        await assistanceRequestsApi.create({
          type: assistanceType,
          priority: form.priority,
          notes: structuredNotes,
          calamityTags: [calamityType],
          needs,
        })
        notify.success('Request submitted.')
      }
      setForm(emptyForm)
      setShowForm(false)
      reload()
    } catch (err) {
      setSubmitError(err.message || 'Failed to save request')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (request) => {
    // Parse the structured notes to populate the form
    const notes = request.notes || ''
    
    // Extract calamity type
    const calamityMatch = notes.match(/Calamity\/Program: (.+?)(?:\n|$)/i)
    const calamityType = calamityMatch ? calamityMatch[1].trim() : ''
    
    // Check if it's a predefined calamity or custom
    const isPresetCalamity = [...CALAMITY_TYPES, ...MISSION_TYPES].includes(calamityType)
    
    // Extract families affected
    const familiesMatch = notes.match(/Families Affected: (\d+)/i)
    const familiesAffected = familiesMatch ? familiesMatch[1] : ''
    
    // Prefer structured needs from API; fall back to notes parsing
    let selectedNeeds = Array.isArray(request.needs) ? request.needs.filter(Boolean) : []
    if (selectedNeeds.length === 0) {
      const needsMatch = notes.match(/Type of Needs: (.+?)(?:\n|$)/i)
        || notes.match(/Goods Required: (.+?)(?:\n|$)/i)
        || notes.match(/Assistance Type: (.+?)(?:\n|$)/i)
      const needsString = needsMatch ? needsMatch[1].trim() : (request.type || '')
      selectedNeeds = needsString ? needsString.split(',').map((n) => n.trim()).filter(Boolean) : []
    }
    
    // Extract additional notes
    const notesMatch = notes.match(/Additional Notes: (.+)/is)
    const additionalNotes = notesMatch ? notesMatch[1].trim() : ''
    
    setForm({
      calamityType: isPresetCalamity ? calamityType : (calamityType ? 'Other' : ''),
      customCalamity: isPresetCalamity ? '' : calamityType,
      selectedNeeds,
      familiesAffected: familiesAffected,
      priority: request.priority || 'Medium',
      notes: additionalNotes,
    })
    
    setEditingRequest(request)
    setShowForm(true)
    setSelectedRequest(null)
  }

  const handleCancel = async (requestId) => {
    if (!window.confirm('Cancel this assistance request? This action cannot be undone.')) return
    setSaving(true)
    try {
      await assistanceRequestsApi.remove(requestId)
      notify.success('Request cancelled.')
      setSelectedRequest(null)
      reload()
    } catch (err) {
      notify.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      {/* Summary Cards */}
      <div className="beneficiary-request-summary">
        <div className="beneficiary-request-summary-card beneficiary-request-summary-card--pending">
          <div className="beneficiary-request-summary-card__icon">
            <Clock size={20} />
          </div>
          <div className="beneficiary-request-summary-card__content">
            <span className="beneficiary-request-summary-card__value">{statusCounts['Under Review']}</span>
            <span className="beneficiary-request-summary-card__label">Under Review</span>
          </div>
        </div>
        <div className="beneficiary-request-summary-card beneficiary-request-summary-card--approved">
          <div className="beneficiary-request-summary-card__icon">
            <CheckCircle size={20} />
          </div>
          <div className="beneficiary-request-summary-card__content">
            <span className="beneficiary-request-summary-card__value">{statusCounts['Approved']}</span>
            <span className="beneficiary-request-summary-card__label">Approved</span>
          </div>
        </div>
        <div className="beneficiary-request-summary-card beneficiary-request-summary-card--completed">
          <div className="beneficiary-request-summary-card__icon">
            <CheckCircle size={20} />
          </div>
          <div className="beneficiary-request-summary-card__content">
            <span className="beneficiary-request-summary-card__value">{statusCounts['Completed']}</span>
            <span className="beneficiary-request-summary-card__label">Completed</span>
          </div>
        </div>
      </div>

      <section className="portal-panel">
        <div className="portal-panel__header">
          <h2>Assistance Requests</h2>
          <button
            type="button"
            className="btn btn--sm btn--primary"
            onClick={() => {
              setEditingRequest(null)
              setForm(emptyForm)
              setSubmitError('')
              setShowForm(true)
            }}
          >
            + New Request
          </button>
        </div>

        {/* Filter Bar */}
        <div className="portal-filter-bar">
          <div className="portal-filter-bar__search">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search by type or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="portal-search-input"
            />
          </div>
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

        {/* Requests Grid */}
        {filteredData.length === 0 ? (
          <div className="portal-empty">
            <AlertCircle size={36} />
            <p>
              {searchQuery 
                ? `No requests found matching "${searchQuery}"`
                : statusFilter !== 'All'
                ? `No ${statusFilter.toLowerCase()} requests`
                : 'No assistance requests yet. Submit your first request above.'}
            </p>
          </div>
        ) : (
          <>
            <div className="beneficiary-requests-grid">
              {paging.pageItems.map((r) => {
                const preview = getRequestPreview(r)
                return (
                <div key={r.id} className="beneficiary-request-card">
                  <div className="beneficiary-request-card__header">
                    <div className="beneficiary-request-card__ref">
                      <span className="beneficiary-request-card__id" title="Request ID">{r.id}</span>
                      <strong title={r.type}>{r.type}</strong>
                      <span className={`beneficiary-priority-badge beneficiary-priority-badge--${r.priority?.toLowerCase()}`}>
                        {r.priority}
                      </span>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  
                  <div className="beneficiary-request-card__body">
                    <p className="beneficiary-request-card__date">
                      Submitted: {r.date}
                    </p>
                    {preview.hasStructured ? (
                      <dl className="beneficiary-request-card__meta">
                        {preview.calamity && (
                          <div className="beneficiary-request-card__meta-row">
                            <dt>Calamity</dt>
                            <dd>{preview.calamity}</dd>
                          </div>
                        )}
                        {preview.families && (
                          <div className="beneficiary-request-card__meta-row">
                            <dt>Families</dt>
                            <dd>{preview.families}</dd>
                          </div>
                        )}
                        {preview.needs.length > 0 && (
                          <div className="beneficiary-request-card__meta-row">
                            <dt>Needs</dt>
                            <dd>{preview.needs.join(', ')}</dd>
                          </div>
                        )}
                        {preview.extraNotes && (
                          <div className="beneficiary-request-card__meta-row">
                            <dt>Notes</dt>
                            <dd className="beneficiary-request-card__notes-preview">{preview.extraNotes}</dd>
                          </div>
                        )}
                      </dl>
                    ) : r.notes ? (
                      <p className="beneficiary-request-card__notes">{r.notes}</p>
                    ) : (
                      <p className="beneficiary-request-card__empty">No additional details provided.</p>
                    )}
                    {r.approvedDate && (
                      <p className="beneficiary-request-card__approved">
                        <CheckCircle size={14} /> Approved on {r.approvedDate}
                      </p>
                    )}
                    {r.completedDate && (
                      <p className="beneficiary-request-card__completed">
                        <CheckCircle size={14} /> Completed on {r.completedDate}
                      </p>
                    )}
                  </div>

                  <div className="beneficiary-request-card__actions">
                    <button
                      type="button"
                      className="btn btn--sm btn--outline"
                      onClick={() => setSelectedRequest(r)}
                    >
                      View Details
                    </button>
                    {canEditRequest(r) && (
                      <button
                        type="button"
                        className="btn btn--sm btn--primary"
                        onClick={() => handleEdit(r)}
                      >
                        Edit
                      </button>
                    )}
                    {canCancelRequest(r) && (
                      <button
                        type="button"
                        className="btn btn--sm btn--ghost"
                        onClick={() => handleCancel(r.dbId)}
                      >
                        <XCircle size={14} /> Cancel
                      </button>
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
              noun="requests"
            />
          </>
        )}
      </section>

      {/* Create/Edit Request Modal */}
      {showForm && (
        <div className="admin-modal-overlay" onClick={() => !saving && setShowForm(false)}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <ModalHeader 
              title={editingRequest ? 'Edit Request' : 'New Assistance Request'} 
              onClose={() => {
                if (!saving) {
                  setShowForm(false)
                  setEditingRequest(null)
                  setForm(emptyForm)
                }
              }} 
            />
            <form onSubmit={handleCreate} className="beneficiary-request-form">
              {submitError ? (
                <p role="alert" style={{ color: '#c0392b', marginBottom: '1rem', padding: '0.75rem', background: '#fee', borderRadius: '6px', fontSize: '0.875rem' }}>
                  {submitError}
                </p>
              ) : null}

              {/* Step 1: Calamity/Event Type */}
              <fieldset className="beneficiary-form-section">
                <legend>1. Reason for Assistance Request</legend>
                <p className="beneficiary-form-hint">
                  Select the calamity experienced or the program/mission needed.
                </p>
                <label>
                  <Req required>Type of Calamity/Program</Req>
                  <select
                    required
                    value={form.calamityType}
                    onChange={(e) => setForm({ ...form, calamityType: e.target.value, customCalamity: '' })}
                  >
                    <option value="">Select reason...</option>
                    <optgroup label="Calamity/Disaster">
                      {CALAMITY_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Mission/Program">
                      {MISSION_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </optgroup>
                    <option value="Other">Other (Please specify)</option>
                  </select>
                </label>
                
                {form.calamityType === 'Other' && (
                  <label>
                    <Req required>Specify Calamity/Program Type</Req>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Community Earthquake Preparedness"
                      value={form.customCalamity}
                      onChange={(e) => setForm({ ...form, customCalamity: e.target.value })}
                    />
                  </label>
                )}
              </fieldset>

              {/* Step 2: Type of Needs (shared Admin catalog) */}
              <fieldset className="beneficiary-form-section">
                <legend>2. Type of Needs</legend>
                <p className="beneficiary-form-hint">
                  Select the types of needs for this request.
                </p>
                <NeedsPicker
                  required
                  value={form.selectedNeeds}
                  onChange={(selectedNeeds) => setForm({ ...form, selectedNeeds })}
                  error={!form.selectedNeeds.length ? 'Select at least one type of need.' : ''}
                  showNote={false}
                  label="Type of Needs"
                  initialVisible={8}
                />
              </fieldset>

              {/* Step 3: Families Affected */}
              <fieldset className="beneficiary-form-section">
                <legend>3. Impact Assessment</legend>
                <p className="beneficiary-form-hint">
                  Help us understand the scale of assistance needed.
                </p>
                <label>
                  <Req required>Number of Families Affected</Req>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="e.g., 50"
                    value={form.familiesAffected}
                    onChange={(e) => setForm({ ...form, familiesAffected: e.target.value })}
                    style={{ fontSize: '1.125rem', padding: '0.875rem' }}
                  />
                  <span className="field-hint">Enter the approximate number of families in need of assistance</span>
                </label>
              </fieldset>

              {/* Step 4: Priority & Notes */}
              <fieldset className="beneficiary-form-section">
                <legend>4. Priority & Additional Information</legend>
                <label>
                  Priority Level
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  >
                    <option value="Low">Low - Can wait</option>
                    <option value="Medium">Medium - Normal urgency</option>
                    <option value="High">High - Urgent</option>
                    <option value="Critical">Critical - Immediate need</option>
                  </select>
                  <span className="field-hint">Select the urgency level of this request</span>
                </label>
                <label>
                  Additional Notes/Details
                  <textarea
                    rows={5}
                    placeholder="Provide any additional information about the situation, number of families affected, special circumstances, etc."
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </label>
              </fieldset>

              <div className="admin-modal__actions">
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'Saving…' : (editingRequest ? 'Update Request' : 'Submit Request')}
                </button>
                <button 
                  type="button" 
                  className="btn btn--ghost" 
                  onClick={() => {
                    setShowForm(false)
                    setEditingRequest(null)
                    setForm(emptyForm)
                  }} 
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Request Details Modal */}
      {selectedRequest && (() => {
        const preview = getRequestPreview(selectedRequest)
        return (
        <div className="admin-modal-overlay" onClick={() => setSelectedRequest(null)}>
          <div className="admin-modal admin-modal--wide beneficiary-request-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title={`Request ${selectedRequest.id}`} onClose={() => setSelectedRequest(null)} />
            
            <div className="beneficiary-request-detail">
              <div className="beneficiary-request-detail-grid">
                <div className="beneficiary-request-detail__row">
                  <label>Request ID</label>
                  <span className="beneficiary-request-id">{selectedRequest.id}</span>
                </div>
                <div className="beneficiary-request-detail__row">
                  <label>Type</label>
                  <span>{selectedRequest.type}</span>
                </div>
                <div className="beneficiary-request-detail__row">
                  <label>Status</label>
                  <StatusBadge status={selectedRequest.status} />
                </div>
                <div className="beneficiary-request-detail__row">
                  <label>Priority</label>
                  <span className={`beneficiary-priority-badge beneficiary-priority-badge--${selectedRequest.priority?.toLowerCase()}`}>
                    {selectedRequest.priority}
                  </span>
                </div>
                <div className="beneficiary-request-detail__row">
                  <label>Submitted</label>
                  <span>{selectedRequest.date}</span>
                </div>
                {preview.calamity && (
                  <div className="beneficiary-request-detail__row">
                    <label>Calamity</label>
                    <span>{preview.calamity}</span>
                  </div>
                )}
                {preview.families && (
                  <div className="beneficiary-request-detail__row">
                    <label>Families</label>
                    <span>{preview.families}</span>
                  </div>
                )}
                {preview.needs.length > 0 && (
                  <div className="beneficiary-request-detail__row">
                    <label>Needs</label>
                    <span>{preview.needs.join(', ')}</span>
                  </div>
                )}
                {selectedRequest.approvedDate && (
                  <div className="beneficiary-request-detail__row">
                    <label>Approved</label>
                    <span>{selectedRequest.approvedDate}</span>
                  </div>
                )}
                {selectedRequest.completedDate && (
                  <div className="beneficiary-request-detail__row">
                    <label>Completed</label>
                    <span>{selectedRequest.completedDate}</span>
                  </div>
                )}
              </div>
              
              {(preview.extraNotes || (!preview.hasStructured && selectedRequest.notes)) && (
                <div className="beneficiary-request-detail__notes">
                  <label>Additional Notes</label>
                  <p>{preview.extraNotes || selectedRequest.notes}</p>
                </div>
              )}
            </div>

            <RequestProgressTracker request={selectedRequest} />

            <div className="admin-modal__actions">
              {canEditRequest(selectedRequest) && (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => handleEdit(selectedRequest)}
                >
                  Edit Request
                </button>
              )}
              {canCancelRequest(selectedRequest) && (
                <button
                  type="button"
                  className="btn btn--outline"
                  onClick={() => {
                    handleCancel(selectedRequest.dbId)
                    setSelectedRequest(null)
                  }}
                >
                  <XCircle size={16} /> Cancel Request
                </button>
              )}
              <button type="button" className="btn btn--ghost" onClick={() => setSelectedRequest(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
        )
      })()}
    </ApiState>
  )
}
