import { useMemo, useState } from 'react'
import { Search, CheckCircle, XCircle, Eye, FileText } from 'lucide-react'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import ModalHeader from '../../components/admin/shared/ModalHeader'
import DonationUpdatesTimeline from '../../components/shared/DonationUpdatesTimeline'
import { donationsApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'

function verifyResultMessage(res) {
  if (!res?.accountCreated) {
    return res?.message || 'Donation verified.'
  }
  if (res.credentialsSent) {
    return 'Donation verified. Donor portal account created and login credentials were emailed.'
  }
  return 'Donation verified. Donor portal account was created, but the credential email was NOT delivered.'
}

export default function StaffVerificationPage() {
  const { data, loading, error, reload } = useApiList(() => donationsApi.list())
  const [searchQuery, setSearchQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [selected, setSelected] = useState(null)
  const [busy, setBusy] = useState(false)

  const pending = useMemo(() => {
    return (data || [])
      .filter((d) => d.status === 'Pending Verification')
      .map((d) => {
        const amountNum = parseFloat(String(d.amount || '').replace(/[₱,]/g, '')) || 0
        const priority = d.type === 'In-Kind'
          ? 'Medium'
          : amountNum >= 20000 ? 'High' : amountNum >= 5000 ? 'Medium' : 'Low'
        return { ...d, priority, program: d.category || 'General Donation' }
      })
  }, [data])

  const filtered = pending.filter((d) => {
    const q = searchQuery.toLowerCase()
    const matchesSearch = !q
      || d.donor?.toLowerCase().includes(q)
      || d.trackingCode?.toLowerCase().includes(q)
      || d.program?.toLowerCase().includes(q)
    const matchesPriority = priorityFilter === 'All' || d.priority === priorityFilter
    return matchesSearch && matchesPriority
  })

  const priorityCounts = {
    All: pending.length,
    High: pending.filter((d) => d.priority === 'High').length,
    Medium: pending.filter((d) => d.priority === 'Medium').length,
    Low: pending.filter((d) => d.priority === 'Low').length,
  }

  const handleVerify = async (row) => {
    if (!row.hasProof) {
      alert('Cannot approve: proof of donation is required.')
      return
    }
    if (!window.confirm(`Verify donation ${row.trackingCode} from ${row.donor}?`)) return
    setBusy(true)
    try {
      const res = await donationsApi.update(row.dbId, { status: 'Verified' })
      alert(verifyResultMessage(res))
      setSelected(null)
      reload()
    } catch (err) {
      alert(err.message || 'Failed to verify donation')
    } finally {
      setBusy(false)
    }
  }

  const handleReject = async (row) => {
    const reason = window.prompt('Reason for rejection (optional):')
    if (reason === null) return
    setBusy(true)
    try {
      await donationsApi.update(row.dbId, { status: 'Rejected', notes: reason || undefined })
      setSelected(null)
      reload()
    } catch (err) {
      alert(err.message || 'Failed to reject donation')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      <div className="staff-tasks-summary">
        {Object.entries(priorityCounts).map(([label, count]) => (
          <button
            key={label}
            type="button"
            className={`staff-task-summary-card${priorityFilter === label ? ' staff-task-summary-card--active' : ''}`}
            onClick={() => setPriorityFilter(label)}
          >
            <span className="staff-task-summary-card__value">{count}</span>
            <span className="staff-task-summary-card__label">{label === 'All' ? 'Pending' : `${label} Priority`}</span>
          </button>
        ))}
      </div>

      <section className="portal-panel">
        <div className="portal-panel__header">
          <h2>Donations Awaiting Verification</h2>
          <span className="portal-panel__hint">{filtered.length} of {pending.length}</span>
        </div>

        <div className="portal-filter-bar">
          <div className="portal-filter-bar__search">
            <Search size={18} />
            <input
              className="portal-search-input"
              placeholder="Search donor, code, or program..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="portal-empty">
            <CheckCircle size={36} />
            <p>No donations match your filters.</p>
          </div>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Donor</th>
                  <th>Amount</th>
                  <th>Program</th>
                  <th>Priority</th>
                  <th>Proof</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.dbId || d.id}>
                    <td><strong>{d.trackingCode}</strong></td>
                    <td>{d.donor}</td>
                    <td>{d.amount}</td>
                    <td>{d.program}</td>
                    <td><StatusBadge status={d.priority} /></td>
                    <td>{d.hasProof ? 'Yes' : 'Missing'}</td>
                    <td>
                      <div className="table-actions" style={{ display: 'flex', gap: '0.35rem' }}>
                        <button type="button" className="btn btn--sm btn--outline" onClick={() => setSelected(d)}>
                          <Eye size={14} /> View
                        </button>
                        <button
                          type="button"
                          className="btn btn--sm btn--primary"
                          disabled={busy || !d.hasProof}
                          onClick={() => handleVerify(d)}
                        >
                          <CheckCircle size={14} /> Verify
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <div className="admin-modal-overlay" onClick={() => setSelected(null)}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title={`Verify ${selected.trackingCode}`} onClose={() => setSelected(null)} />
            <dl className="detail-list">
              <dt>Donor</dt><dd>{selected.donor}</dd>
              <dt>Email</dt><dd>{selected.donorEmail || '—'}</dd>
              <dt>Type</dt><dd>{selected.type}</dd>
              <dt>Amount</dt><dd>{selected.amount}</dd>
              <dt>Program</dt><dd>{selected.program}</dd>
              <dt>Date</dt><dd>{selected.date}</dd>
              <dt>Status</dt><dd><StatusBadge status={selected.status} /></dd>
              <dt>Proof</dt>
              <dd>
                {selected.hasProof ? (
                  <a href={selected.proofUrl || selected.proofPath} target="_blank" rel="noreferrer">
                    <FileText size={14} /> View proof
                  </a>
                ) : 'Missing'}
              </dd>
              <dt>Notes</dt><dd>{selected.notes || '—'}</dd>
            </dl>
            <DonationUpdatesTimeline donationId={selected.dbId} />
            <div className="admin-modal__actions">
              <button type="button" className="btn btn--primary" disabled={busy || !selected.hasProof} onClick={() => handleVerify(selected)}>
                <CheckCircle size={16} /> Verify
              </button>
              <button type="button" className="btn btn--outline" disabled={busy} onClick={() => handleReject(selected)}>
                <XCircle size={16} /> Reject
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </ApiState>
  )
}
