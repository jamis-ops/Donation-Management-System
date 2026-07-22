import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import { donationsApi, certificatesApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import ModalHeader from '../../components/admin/shared/ModalHeader'
import DonationUpdatesTimeline from '../../components/shared/DonationUpdatesTimeline'

export default function DonorDonationsPage() {
  const { data, loading, error, reload } = useApiList(() => donationsApi.list())
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const filtered = data.filter((d) =>
    !search ||
    d.trackingCode?.toLowerCase().includes(search.toLowerCase()) ||
    d.status?.toLowerCase().includes(search.toLowerCase())
  )

  const handleCancel = async (row) => {
    if (!window.confirm(`Cancel donation ${row.trackingCode}? This cannot be undone.`)) return
    setBusy(true)
    try {
      await donationsApi.remove(row.dbId)
      setSelected(null)
      setNotice(`Donation ${row.trackingCode} was cancelled.`)
      reload()
    } catch (err) {
      alert(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleRequestCert = async (row) => {
    setBusy(true)
    try {
      await certificatesApi.create({ type: 'Certificate of Donation', reference: row.trackingCode })
      setSelected(null)
      setNotice(`Certificate requested for ${row.trackingCode}. You will be notified once it is ready.`)
    } catch (err) {
      alert(err.message)
    } finally {
      setBusy(false)
    }
  }

  const canRequestCert = selected && !['Pending Verification'].includes(selected.status)

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      {notice && (
        <div className="portal-notice">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss"><X size={14} /></button>
        </div>
      )}

      <section className="portal-panel">
        <div className="portal-panel__header">
          <h2>My Donations</h2>
          <Link to="/donate" className="btn btn--sm btn--primary">+ Make a Donation</Link>
        </div>

        <div className="portal-search">
          <Search size={15} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by tracking code or status..."
          />
        </div>

        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead>
              <tr><th>Tracking Code</th><th>Type</th><th>Amount / Items</th><th>Date</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: '#6b7280' }}>No donations found.</td></tr>
              ) : filtered.map((d) => (
                <tr key={d.id}>
                  <td><strong>{d.trackingCode}</strong></td>
                  <td>{d.type}</td>
                  <td>{d.amount}</td>
                  <td>{d.date}</td>
                  <td><StatusBadge status={d.status} /></td>
                  <td>
                    <button type="button" className="btn btn--sm btn--outline" onClick={() => setSelected(d)}>
                      Track
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <div className="admin-modal-overlay" onClick={() => setSelected(null)}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title={`Donation ${selected.trackingCode}`} onClose={() => setSelected(null)} />

            <dl className="detail-list" style={{ marginBottom: '1.25rem' }}>
              <dt>Type</dt><dd>{selected.type}</dd>
              <dt>Amount / Items</dt><dd>{selected.amount}</dd>
              <dt>Date</dt><dd>{selected.date}</dd>
              <dt>Status</dt><dd><StatusBadge status={selected.status} /></dd>
            </dl>

            <DonationUpdatesTimeline donationId={selected.dbId} />

            <div className="admin-modal__actions">
              {canRequestCert && (
                <button type="button" className="btn btn--primary" disabled={busy} onClick={() => handleRequestCert(selected)}>
                  Request Certificate
                </button>
              )}
              {selected.status === 'Pending Verification' && (
                <button type="button" className="btn btn--outline" disabled={busy} onClick={() => handleCancel(selected)}>
                  Cancel Donation
                </button>
              )}
              <button type="button" className="btn btn--ghost" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </ApiState>
  )
}
