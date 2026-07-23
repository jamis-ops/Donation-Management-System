import { useState } from 'react'
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
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')

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

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      <section className="portal-panel">
        <div className="portal-panel__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <h2>Assistance Requests</h2>
          <button type="button" className="btn btn--sm btn--primary" onClick={() => setShowForm(true)}>
            + New Request
          </button>
        </div>
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead><tr><th>Reference</th><th>Type</th><th>Date</th><th>Priority</th><th>Status</th></tr></thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No assistance requests yet.
                  </td>
                </tr>
              ) : (
                data.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td><td>{r.type}</td><td>{r.date}</td>
                    <td><StatusBadge status={r.priority} /></td>
                    <td><StatusBadge status={r.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

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
    </ApiState>
  )
}
