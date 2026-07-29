import { useEffect, useState } from 'react'
import { Check, Clock } from 'lucide-react'
import { donationUpdatesApi } from '../../api/resources'
import { notify } from '../../utils/toast'

const FALLBACK_STAGES = [
  'Donation Received',
  'Sorted',
  'Repacked',
  'Scheduled for Distribution',
  'In Transit',
  'Delivered',
]

/**
 * Chronological donation progress timeline (from donation_updates API).
 */
export default function DonationUpdatesTimeline({
  donationId,
  canPost = false,
  onPosted,
}) {
  const [updates, setUpdates] = useState([])
  const [stages, setStages] = useState(FALLBACK_STAGES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stage, setStage] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    if (!donationId) return
    setLoading(true)
    setError('')
    try {
      const res = await donationUpdatesApi.list(donationId)
      setUpdates(Array.isArray(res.data) ? res.data : [])
      if (Array.isArray(res.stages) && res.stages.length) setStages(res.stages)
    } catch (err) {
      setError(err.message || 'Could not load updates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [donationId])

  const handlePost = async (e) => {
    e.preventDefault()
    if (!stage) return
    setSaving(true)
    try {
      await donationUpdatesApi.create({ donationId, stage, note })
      setStage('')
      setNote('')
      await load()
      onPosted?.()
      notify.success('Update posted.')
    } catch (err) {
      notify.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="donation-updates">
      <h3 className="donation-updates__title">Donation Updates</h3>
      {loading ? (
        <p className="donation-updates__empty">Loading updates…</p>
      ) : error ? (
        <p className="donation-updates__empty">{error}</p>
      ) : updates.length === 0 ? (
        <p className="donation-updates__empty">No progress updates yet.</p>
      ) : (
        <ol className="donation-updates__list">
          {updates.map((u, i) => {
            const isLatest = i === updates.length - 1
            return (
              <li key={u.id} className={`donation-updates__item${isLatest ? ' donation-updates__item--latest' : ''}`}>
                <span className="donation-updates__dot" aria-hidden>
                  {isLatest ? <Clock size={12} /> : <Check size={12} />}
                </span>
                <div className="donation-updates__body">
                  <strong>{u.stage}</strong>
                  <span className="donation-updates__meta">
                    {u.dateTime || `${u.date} ${u.time}`.trim()}
                    {' · '}
                    {u.staffName || 'System'}
                  </span>
                  {u.note ? <p className="donation-updates__note">{u.note}</p> : null}
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {canPost && (
        <form className="donation-updates__form" onSubmit={handlePost}>
          <label>
            Add update
            <select required value={stage} onChange={(e) => setStage(e.target.value)}>
              <option value="">Select stage…</option>
              {stages.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>
            Note (optional)
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Brief progress note" />
          </label>
          <button type="submit" className="btn btn--sm btn--primary" disabled={saving || !stage}>
            {saving ? 'Saving…' : 'Post Update'}
          </button>
        </form>
      )}
    </div>
  )
}
