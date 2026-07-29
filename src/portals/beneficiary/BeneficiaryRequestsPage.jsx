import { useState } from 'react'
import { Search, AlertCircle, CheckCircle, Clock, XCircle, Plus, X } from 'lucide-react'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import ModalHeader from '../../components/admin/shared/ModalHeader'
import { assistanceRequestsApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { programs } from '../../data/mockData'
import Req from '../../components/shared/Req'
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

// Assistance types
const ASSISTANCE_TYPES = [
  'Food Supplies',
  'Medical Supplies',
  'Shelter/Housing',
  'Financial Assistance',
  'Educational Materials',
  'Livelihood Support',
  'Infrastructure Repair',
  'Emergency Relief',
  'Other',
]

// Goods that might be required
const GOODS_OPTIONS = [
  { id: 'food', label: 'Food Packs' },
  { id: 'water', label: 'Water/Drinking Supplies' },
  { id: 'relief-pack', label: 'Relief Packs' },
  { id: 'rice', label: 'Sacks of Rice' },
  { id: 'medicine', label: 'Medicines' },
  { id: 'clothing', label: 'Clothing' },
  { id: 'hygiene-kits', label: 'Hygiene Kits' },
  { id: 'blankets', label: 'Blankets/Mats' },
  { id: 'construction', label: 'Construction Materials' },
  { id: 'educational', label: 'School Supplies' },
]

const emptyForm = {
  calamityType: '',
  customCalamity: '',
  assistanceType: '',
  customAssistance: '',
  familiesAffected: '',
  selectedGoods: [],
  customGoods: [],
  priority: 'Medium',
  notes: '',
  newGoodInput: '',
}

const CLOSED_STATUSES = ['Completed', 'Rejected', 'Cancelled', 'Done']

function canEditRequest(request) {
  return Boolean(request) && !CLOSED_STATUSES.includes(request.status)
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

  // Filter requests
  const filteredData = data.filter((r) => {
    const matchesSearch = !searchQuery ||
      (r.type || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.notes || '').toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'All' || r.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

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
    
    if (!form.assistanceType.trim()) {
      setSubmitError('Please select the type of assistance needed.')
      return
    }
    
    if (form.assistanceType === 'Other' && !form.customAssistance.trim()) {
      setSubmitError('Please specify the assistance type.')
      return
    }
    
    if (!form.familiesAffected || Number(form.familiesAffected) < 1) {
      setSubmitError('Please enter the number of families affected (at least 1).')
      return
    }
    
    // Build request
    const calamityType = form.calamityType === 'Other' ? form.customCalamity : form.calamityType
    const assistanceType = form.assistanceType === 'Other' ? form.customAssistance : form.assistanceType
    
    // Collect all goods
    const allGoods = [
      ...form.selectedGoods.map(id => {
        const option = GOODS_OPTIONS.find(g => g.id === id)
        return option ? option.label : id
      }),
      ...form.customGoods
    ]
    
    // Build notes with structured information
    const structuredNotes = [
      `Calamity/Program: ${calamityType}`,
      `Assistance Type: ${assistanceType}`,
      `Families Affected: ${form.familiesAffected}`,
      allGoods.length > 0 ? `Goods Required: ${allGoods.join(', ')}` : '',
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
    
    // Extract goods
    const goodsMatch = notes.match(/Goods Required: (.+?)(?:\n|$)/i)
    const goodsString = goodsMatch ? goodsMatch[1].trim() : ''
    const goodsList = goodsString ? goodsString.split(',').map(g => g.trim()) : []
    
    // Match goods to predefined options
    const selectedGoods = []
    const customGoods = []
    
    goodsList.forEach(good => {
      const matchingOption = GOODS_OPTIONS.find(opt => opt.label === good)
      if (matchingOption) {
        selectedGoods.push(matchingOption.id)
      } else if (good) {
        customGoods.push(good)
      }
    })
    
    // Extract additional notes
    const notesMatch = notes.match(/Additional Notes: (.+)/is)
    const additionalNotes = notesMatch ? notesMatch[1].trim() : ''
    
    // Check if assistance type is predefined
    const isPresetAssistance = ASSISTANCE_TYPES.includes(request.type)
    
    setForm({
      calamityType: isPresetCalamity ? calamityType : 'Other',
      customCalamity: isPresetCalamity ? '' : calamityType,
      assistanceType: isPresetAssistance ? request.type : 'Other',
      customAssistance: isPresetAssistance ? '' : request.type,
      familiesAffected: familiesAffected,
      selectedGoods: selectedGoods,
      customGoods: customGoods,
      priority: request.priority || 'Medium',
      notes: additionalNotes,
      newGoodInput: '',
    })
    
    setEditingRequest(request)
    setShowForm(true)
    setSelectedRequest(null)
  }

  const handleAddCustomGood = () => {
    if (!form.newGoodInput.trim()) return
    if (form.customGoods.includes(form.newGoodInput.trim())) return
    
    setForm({
      ...form,
      customGoods: [...form.customGoods, form.newGoodInput.trim()],
      newGoodInput: '',
    })
  }

  const handleRemoveCustomGood = (index) => {
    setForm({
      ...form,
      customGoods: form.customGoods.filter((_, i) => i !== index),
    })
  }

  const toggleGood = (goodId) => {
    setForm({
      ...form,
      selectedGoods: form.selectedGoods.includes(goodId)
        ? form.selectedGoods.filter(id => id !== goodId)
        : [...form.selectedGoods, goodId],
    })
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
          <div className="beneficiary-requests-grid">
            {filteredData.map((r) => (
              <div key={r.id} className="beneficiary-request-card">
                <div className="beneficiary-request-card__header">
                  <div className="beneficiary-request-card__ref">
                    <span className="beneficiary-request-card__id" title="Request ID">{r.id}</span>
                    <strong>{r.type}</strong>
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
                  {r.notes && (
                    <p className="beneficiary-request-card__notes">{r.notes}</p>
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
            ))}
          </div>
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

              {/* Step 2: Type of Assistance */}
              <fieldset className="beneficiary-form-section">
                <legend>2. Type of Assistance Needed</legend>
                <label>
                  <Req required>Assistance Type</Req>
                  <select
                    required
                    value={form.assistanceType}
                    onChange={(e) => setForm({ ...form, assistanceType: e.target.value, customAssistance: '' })}
                  >
                    <option value="">Select assistance type...</option>
                    {ASSISTANCE_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </label>
                
                {form.assistanceType === 'Other' && (
                  <label>
                    <Req required>Specify Assistance Type</Req>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Temporary Shelter Setup"
                      value={form.customAssistance}
                      onChange={(e) => setForm({ ...form, customAssistance: e.target.value })}
                    />
                  </label>
                )}
              </fieldset>

              {/* Step 2b: Families Affected */}
              <fieldset className="beneficiary-form-section">
                <legend>2b. Impact Assessment</legend>
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

              {/* Step 3: Goods Required */}
              <fieldset className="beneficiary-form-section">
                <legend>3. Goods That Might Be Required</legend>
                <p className="beneficiary-form-hint">
                  Select all goods that are needed for this request.
                </p>
                <div className="beneficiary-goods-grid">
                  {GOODS_OPTIONS.map((good) => (
                    <label key={good.id} className="beneficiary-checkbox-card">
                      <input
                        type="checkbox"
                        checked={form.selectedGoods.includes(good.id)}
                        onChange={() => toggleGood(good.id)}
                      />
                      <span className="beneficiary-checkbox-card__label">{good.label}</span>
                    </label>
                  ))}
                </div>
                
                {/* Custom Goods */}
                <div className="beneficiary-custom-goods">
                  <label>
                    Additional/Specific Goods
                    <div className="beneficiary-custom-goods__input">
                      <input
                        type="text"
                        placeholder="e.g., Baby formula, Generators"
                        value={form.newGoodInput}
                        onChange={(e) => setForm({ ...form, newGoodInput: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddCustomGood()
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn--sm btn--primary"
                        onClick={handleAddCustomGood}
                        disabled={!form.newGoodInput.trim()}
                      >
                        <Plus size={16} /> Add
                      </button>
                    </div>
                  </label>
                  
                  {form.customGoods.length > 0 && (
                    <div className="beneficiary-custom-goods__list">
                      {form.customGoods.map((good, index) => (
                        <div key={index} className="beneficiary-custom-good-tag">
                          <span>{good}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomGood(index)}
                            aria-label="Remove"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
      {selectedRequest && (
        <div className="admin-modal-overlay" onClick={() => setSelectedRequest(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title="Request Details" onClose={() => setSelectedRequest(null)} />
            
            <div className="beneficiary-request-detail">
              <div className="beneficiary-request-detail__row">
                <label>Request ID:</label>
                <span className="beneficiary-request-id">{selectedRequest.id}</span>
              </div>
              <div className="beneficiary-request-detail__row">
                <label>Type:</label>
                <span>{selectedRequest.type}</span>
              </div>
              <div className="beneficiary-request-detail__row">
                <label>Status:</label>
                <StatusBadge status={selectedRequest.status} />
              </div>
              <div className="beneficiary-request-detail__row">
                <label>Priority:</label>
                <span className={`beneficiary-priority-badge beneficiary-priority-badge--${selectedRequest.priority?.toLowerCase()}`}>
                  {selectedRequest.priority}
                </span>
              </div>
              <div className="beneficiary-request-detail__row">
                <label>Submitted:</label>
                <span>{selectedRequest.date}</span>
              </div>
              {selectedRequest.approvedDate && (
                <div className="beneficiary-request-detail__row">
                  <label>Approved:</label>
                  <span>{selectedRequest.approvedDate}</span>
                </div>
              )}
              {selectedRequest.completedDate && (
                <div className="beneficiary-request-detail__row">
                  <label>Completed:</label>
                  <span>{selectedRequest.completedDate}</span>
                </div>
              )}
              {selectedRequest.notes && (
                <div className="beneficiary-request-detail__row beneficiary-request-detail__row--full">
                  <label>Notes:</label>
                  <p>{selectedRequest.notes}</p>
                </div>
              )}
              <div className="beneficiary-request-tracker">
                <strong>Request tracker</strong>
                <p>Use Request ID <span className="beneficiary-request-id">{selectedRequest.id}</span> when following up with staff about allocation or delivery.</p>
                <ol className="beneficiary-request-tracker__steps">
                  {[
                    { key: 'submitted', label: 'Submitted', done: true },
                    { key: 'review', label: 'Under Review', done: !['Pending', 'Pending Review', 'Pending Verification'].includes(selectedRequest.status) },
                    { key: 'approved', label: 'Approved', done: ['Approved', 'Allocated', 'Completed', 'Done'].includes(selectedRequest.status) },
                    { key: 'allocated', label: 'Allocated', done: ['Allocated', 'Completed', 'Done'].includes(selectedRequest.status) },
                    { key: 'completed', label: 'Completed', done: ['Completed', 'Done'].includes(selectedRequest.status) },
                  ].map((step) => (
                    <li
                      key={step.key}
                      className={`beneficiary-request-tracker__step${step.done ? ' is-done' : ''}${selectedRequest.status === 'Rejected' && step.key === 'review' ? ' is-rejected' : ''}`}
                    >
                      {step.label}
                    </li>
                  ))}
                </ol>
              </div>
            </div>

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
      )}
    </ApiState>
  )
}
