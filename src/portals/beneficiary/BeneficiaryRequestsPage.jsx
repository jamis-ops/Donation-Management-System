import { useState } from 'react'
import { Search, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import ModalHeader from '../../components/admin/shared/ModalHeader'
import { assistanceRequestsApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { programs } from '../../data/mockData'
import Req from '../../components/shared/Req'

const emptyForm = {
  type: '',
  priority: 'Medium',
  notes: '',
}

export default function BeneficiaryRequestsPage() {
  const { data, loading, error, reload } = useApiList(() => assistanceRequestsApi.list())
  const [showForm, setShowForm] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  // Filter requests
  const filteredData = data.filter((r) => {
    const matchesSearch = !searchQuery ||
      r.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.id.toLowerCase().includes(searchQuery.toLowerCase())
    
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
    if (!form.type.trim()) {
      setSubmitError('Assistance type is required.')
      return
    }
    setSaving(true)
    try {
      await assistanceRequestsApi.create({
        type: form.type,
        priority: form.priority,
        notes: form.notes || null,
      })
      setForm(emptyForm)
      setShowForm(false)
      reload()
    } catch (err) {
      setSubmitError(err.message || 'Failed to create request')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = async (requestId) => {
    if (!window.confirm('Cancel this assistance request? This action cannot be undone.')) return
    setSaving(true)
    try {
      await assistanceRequestsApi.remove(requestId)
      setSelectedRequest(null)
      reload()
    } catch (err) {
      alert(err.message)
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
          <button type="button" className="btn btn--sm btn--primary" onClick={() => setShowForm(true)}>
            + New Request
          </button>
        </div>

        {/* Filter Bar */}
        <div className="portal-filter-bar">
          <div className="portal-filter-bar__search">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search by type or reference..."
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
                    <strong>{r.id}</strong>
                    <span className={`beneficiary-priority-badge beneficiary-priority-badge--${r.priority?.toLowerCase()}`}>
                      {r.priority}
                    </span>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                
                <div className="beneficiary-request-card__body">
                  <h3>{r.type}</h3>
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
                  {r.status === 'Under Review' && (
                    <button
                      type="button"
                      className="btn btn--sm btn--ghost"
                      onClick={() => handleCancel(r.id)}
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

      {/* Create Request Modal */}
      {showForm && (
        <div className="admin-modal-overlay" onClick={() => !saving && setShowForm(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title="New Assistance Request" onClose={() => !saving && setShowForm(false)} />
            <form onSubmit={handleCreate}>
              {submitError ? (
                <p role="alert" style={{ color: '#c0392b', marginBottom: '1rem' }}>{submitError}</p>
              ) : null}
              <label>
                <Req required>Type of Assistance</Req>
                <select
                  required
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  <option value="">Select type</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                  <option value="Other">Other</option>
                </select>
              </label>
              <label>
                Priority
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </label>
              <label>
                Notes / Description
                <textarea
                  rows={4}
                  placeholder="Describe the assistance needed..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
              <div className="admin-modal__actions">
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'Submitting…' : 'Submit Request'}
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setShowForm(false)} disabled={saving}>
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
                <label>Reference ID:</label>
                <span>{selectedRequest.id}</span>
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
            </div>

            <div className="admin-modal__actions">
              {selectedRequest.status === 'Under Review' && (
                <button
                  type="button"
                  className="btn btn--outline"
                  onClick={() => {
                    handleCancel(selectedRequest.id)
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
