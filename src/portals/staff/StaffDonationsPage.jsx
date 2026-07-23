import { useState } from 'react'
import { Download, FileText } from 'lucide-react'
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

export default function StaffDonationsPage() {
  const { data, loading, error, reload } = useApiList(() => donationsApi.list())
  const [selected, setSelected] = useState(null)

  const handleVerify = async (row) => {
    if (!row.hasProof) {
      alert('Cannot approve: proof of donation is required.')
      return
    }
    try {
      const res = await donationsApi.update(row.dbId, { status: 'Verified' })
      if (res?.accountCreated || res?.credentialsSent) {
        alert(verifyResultMessage(res))
      } else if (res?.message) {
        alert(res.message)
      }
      reload()
      setSelected(null)
    } catch (err) {
      alert(err.message || 'Failed to verify donation')
    }
  }

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      <section className="portal-panel">
        <div className="portal-panel__header"><h2>Donations to Process</h2></div>
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Donor</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr
                  key={d.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelected(d)}
                >
                  <td>{d.trackingCode}</td>
                  <td>{d.donor}</td>
                  <td>{d.amount}</td>
                  <td><StatusBadge status={d.status} /></td>
                  <td>
                    {d.status === 'Pending Verification' && (
                      <button
                        type="button"
                        className="btn btn--sm btn--primary"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleVerify(d)
                        }}
                      >
                        Verify
                      </button>
                    )}
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
            <ModalHeader title="Donation Details" onClose={() => setSelected(null)} />
            <dl className="detail-list">
              <dt>Tracking Code</dt><dd>{selected.trackingCode}</dd>
              <dt>Donor</dt><dd>{selected.donor}</dd>
              <dt>Email</dt><dd>{selected.donorEmail || '—'}</dd>
              <dt>Type</dt><dd>{selected.type}</dd>
              <dt>Category</dt><dd>{selected.category || '—'}</dd>
              <dt>Amount</dt><dd>{selected.amount}</dd>
              <dt>Payment Method</dt><dd>{selected.paymentMethod || '—'}</dd>
              <dt>Status</dt><dd><StatusBadge status={selected.status} /></dd>
              <dt>Date</dt><dd>{selected.date}</dd>
              <dt>Notes</dt><dd>{selected.notes || '—'}</dd>
            </dl>

            {selected.hasProof && (
              <div className="donation-proof-panel">
                <h3>Uploaded Proof</h3>
                {selected.proofIsImage ? (
                  <a href={selected.proofUrl} target="_blank" rel="noreferrer" className="donation-proof-panel__preview">
                    <img src={selected.proofUrl} alt={selected.proofFileName || 'Donation proof'} />
                  </a>
                ) : (
                  <div className="donation-proof-panel__doc">
                    <FileText size={28} />
                    <div>
                      <strong>{selected.proofFileName || 'Document'}</strong>
                      <p>{selected.proofFileType || 'File'}</p>
                    </div>
                  </div>
                )}
                <a href={selected.proofUrl} target="_blank" rel="noreferrer" className="btn btn--sm btn--outline" download={selected.proofFileName}>
                  <Download size={14} /> View / Download
                </a>
              </div>
            )}

            <DonationUpdatesTimeline
              donationId={selected.dbId}
              canPost
              onPosted={reload}
            />

            <div className="admin-modal__actions">
              {selected.status === 'Pending Verification' && (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => handleVerify(selected)}
                  disabled={!selected.hasProof}
                  title={!selected.hasProof ? 'Proof of donation is required' : undefined}
                >
                  Verify &amp; Approve
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
