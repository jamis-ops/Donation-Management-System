import { useState } from 'react'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import { distributionsApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import ModalHeader from '../../components/admin/shared/ModalHeader'

export default function BeneficiaryDistributionsPage() {
  const { data, loading, error, reload } = useApiList(() => distributionsApi.list())
  const [modal, setModal] = useState(null) // { row, mode: 'receive' | 'missing' }
  const [qty, setQty] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const openReceive = (row) => { setModal({ row, mode: 'receive' }); setQty(row.beneficiaries || ''); setNotes('') }
  const openMissing = (row) => { setModal({ row, mode: 'missing' }); setNotes('') }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (modal.mode === 'receive') {
        await distributionsApi.update(modal.row.dbId, {
          action: 'confirm-receipt',
          receivedQuantity: Number(qty) || 0,
          notes,
        })
      } else {
        await distributionsApi.update(modal.row.dbId, { action: 'report-missing', notes })
      }
      setModal(null)
      reload()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const canAct = (d) => d.beneficiaryId && d.receiptStatus !== 'Received'

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      <section className="portal-panel">
        <div className="portal-panel__header">
          <h2>My Distributions</h2>
          <p className="portal-hint">Confirm receipt and record the quantity received, or report if a scheduled donation has not arrived.</p>
        </div>
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th>Date</th><th>Location</th><th>Type</th><th>Status</th>
                <th>Receipt</th><th>Received Qty</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>No distributions yet.</td></tr>
              )}
              {data.map((d) => (
                <tr key={d.id}>
                  <td>{d.date}</td>
                  <td>{d.location}</td>
                  <td>{d.type}</td>
                  <td><StatusBadge status={d.status} /></td>
                  <td><StatusBadge status={d.receiptStatus} /></td>
                  <td>{d.receivedQuantity ?? '—'}</td>
                  <td>
                    {canAct(d) ? (
                      <div className="table-actions">
                        <button type="button" className="btn btn--sm btn--primary" onClick={() => openReceive(d)}>
                          <CheckCircle2 size={13} /> Confirm
                        </button>
                        <button type="button" className="btn btn--sm btn--outline" onClick={() => openMissing(d)}>
                          <AlertTriangle size={13} /> Not received
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                        {d.receiptStatus === 'Received' ? 'Confirmed' : '—'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {modal && (
        <div className="admin-modal-overlay" onClick={() => setModal(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title={modal.mode === 'receive' ? 'Confirm Receipt' : 'Report Not Received'}
              onClose={() => setModal(null)}
            />
            <p className="portal-hint">{modal.row.location} — {modal.row.date}</p>
            <form onSubmit={submit}>
              {modal.mode === 'receive' && (
                <label>Quantity Received
                  <input type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 150" />
                </label>
              )}
              <label>{modal.mode === 'receive' ? 'Notes (optional)' : 'Describe the issue'}
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder={modal.mode === 'receive' ? 'Condition of goods, remarks...' : 'e.g. Delivery has not arrived as of today.'} />
              </label>
              <div className="admin-modal__actions">
                <button type="submit" className={`btn ${modal.mode === 'receive' ? 'btn--primary' : 'btn--danger'}`} disabled={saving}>
                  {saving ? 'Submitting...' : modal.mode === 'receive' ? 'Confirm Receipt' : 'Report Issue'}
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ApiState>
  )
}
