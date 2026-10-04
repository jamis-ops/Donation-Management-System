import { useEffect, useState } from 'react'
import { Check, Clock, HeartHandshake, Upload, ShieldCheck } from 'lucide-react'
import { donationUpdatesApi } from '../../api/resources'
import LoadingSpinner from '../shared/LoadingSpinner'
import '../../styles/donation-progress-tracker.css'

const WORKFLOW_STAGES = [
  { key: 'donate', label: 'Donate', icon: HeartHandshake, description: 'Your donation has been submitted' },
  { key: 'submit-proof', label: 'Submit Proof', icon: Upload, description: 'Submit the required donation proof' },
  { key: 'verify-proof', label: 'Verify Proof', icon: ShieldCheck, description: 'Our team verifies the submitted proof' },
  { key: 'completed', label: 'Completed', icon: Check, description: 'The donation process is complete' },
]

const IMPORTANT_ACTIVITY_TERMS = [
  'donation received',
  'donate',
  'submit proof',
  'proof submitted',
  'proof',
  'verify proof',
  'verified',
  'completed',
  'rejected',
  'cancelled',
]

function activityTitle(update) {
  const stage = String(update?.stage || '').trim()
  const normalized = stage.toLowerCase()
  if (normalized === 'donation received' || normalized === 'donate') return 'Donation submitted'
  if (normalized === 'submit proof' || normalized === 'proof submitted') return 'Payment proof submitted'
  if (normalized === 'verify proof' || normalized === 'verified') return 'Payment proof verified'
  if (normalized === 'completed') return 'Donation completed'
  return stage || 'Donation updated'
}

function activityDetail(update) {
  const note = String(update?.note || update?.message || update?.description || '').trim()
  if (!note) return ''
  if (/donation verified and intaked into inventory/i.test(note)) {
    return 'Donation verified and added to inventory.'
  }
  const cleaned = note
    .replace(/\s*Donor portal account created and credentials emailed\.?/gi, '')
    .replace(/\s*Existing donor account linked\.?/gi, '')
    .trim()
  if (!cleaned || cleaned.toLowerCase() === String(update?.stage || '').trim().toLowerCase()) return ''
  return cleaned.length > 120 ? `${cleaned.slice(0, 117).trimEnd()}...` : cleaned
}

function importantRecentActivities(updates) {
  const seen = new Set()
  return [...updates]
    .reverse()
    .filter((update) => {
      const searchable = `${update?.stage || ''} ${update?.note || ''}`.toLowerCase()
      return IMPORTANT_ACTIVITY_TERMS.some((term) => searchable.includes(term))
    })
    .filter((update) => {
      const key = activityTitle(update).toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 5)
}

function determineCurrentStage(status, hasProof) {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'certificate / official receipt') return 3
  if (normalized === 'completed') return 3
  if (['rejected', 'cancelled'].includes(normalized)) return -1
  if (['verified', 'verified & acknowledged', 'in inventory', 'in stock', 'repacked', 'repacking', 'partially allocated', 'allocated', 'reserved', 'assigned', 'scheduled', 'in transit', 'out for delivery', 'distributed', 'delivered', 'received'].includes(normalized)) return 3
  if (['pending verification', 'pending', 'under review', 'in review'].includes(normalized)) return hasProof ? 2 : 1
  return 0
}

function calculateProgressPercentage(currentStageIndex) {
  if (currentStageIndex < 0) return 0
  return Math.min(100, Math.round(((currentStageIndex + 1) / WORKFLOW_STAGES.length) * 100))
}

export default function DonationProgressTracker({ donation, donationId }) {
  const [updates, setUpdates] = useState([])
  const [remoteProgress, setRemoteProgress] = useState({ donationId: null, status: '' })
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    if (!donationId) return
    const fetchUpdates = async () => {
      try {
        const res = await donationUpdatesApi.list(donationId)
        setUpdates(res.data || [])
        setRemoteProgress({ donationId, status: res.currentStatus || donation?.status || '' })
      } catch (err) {
        console.error('Failed to fetch updates:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchUpdates()
    if (autoRefresh) {
      const interval = setInterval(fetchUpdates, 30000)
      return () => clearInterval(interval)
    }
  }, [donationId, donation?.status, autoRefresh])

  const syncedStatus = remoteProgress.donationId === donationId && remoteProgress.status
    ? remoteProgress.status
    : (donation?.status || '')
  const normalizedStatus = String(syncedStatus).trim().toLowerCase()
  const currentStageIndex = determineCurrentStage(syncedStatus, donation?.hasProof)
  const progressPercentage = calculateProgressPercentage(currentStageIndex)
  const isRejectedOrCancelled = ['rejected', 'cancelled'].includes(normalizedStatus)
  const latestUpdate = updates.length > 0 ? updates[updates.length - 1] : null
  const recentActivities = importantRecentActivities(updates)

  return (
    <div className="donation-progress-tracker">
      <div className="progress-tracker-header">
        <div className="progress-tracker-title">
          <h3>Donation Journey</h3>
          <div className="progress-tracker-controls">
            <label className="progress-tracker-toggle">
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
              <span>Auto-refresh</span>
            </label>
          </div>
        </div>
        <div className="progress-tracker-status">
          <div className={`progress-tracker-status-badge ${isRejectedOrCancelled ? 'progress-tracker-status-badge--danger' : ''}`}>
            <Clock size={14} />
            <span>Current Status: <strong>{syncedStatus || 'Pending Verification'}</strong></span>
          </div>
          {latestUpdate && <div className="progress-tracker-last-update">Last updated: {new Date(latestUpdate.createdAt || latestUpdate.date).toLocaleString()}</div>}
        </div>
      </div>

      <div className="progress-tracker-bar-container">
        <div className="progress-tracker-bar">
          <div className="progress-tracker-bar-fill" style={{ width: `${progressPercentage}%` }} />
        </div>
        <span className="progress-tracker-percentage">{progressPercentage}%</span>
      </div>

      <div className="progress-tracker-stages">
        {WORKFLOW_STAGES.map((stage, index) => {
          const isCompleted = currentStageIndex >= 0 && (index < currentStageIndex || (index === currentStageIndex && index === WORKFLOW_STAGES.length - 1))
          const isActive = currentStageIndex >= 0 && index === currentStageIndex && index < WORKFLOW_STAGES.length - 1
          const stageStatus = isCompleted ? 'completed' : (isActive ? 'active' : 'pending')
          const Icon = stage.icon
          const connectorReached = currentStageIndex >= 0 && index <= currentStageIndex
          return (
            <div key={stage.key} className={`progress-stage progress-stage--${stageStatus}`}>
              <div className="progress-stage-line">
                {index > 0 && <div className={`progress-stage-line-segment ${connectorReached ? 'completed' : ''}`} />}
              </div>
              <div className="progress-stage-icon-wrapper">
                <div className={`progress-stage-icon ${isActive ? 'pulse' : ''}`}>
                  {isCompleted ? <Check size={18} /> : <Icon size={18} />}
                </div>
              </div>
              <div className="progress-stage-content">
                <div className="progress-stage-label">{stage.label}</div>
                <div className="progress-stage-description">{stage.description}</div>
              </div>
            </div>
          )
        })}
      </div>

      {recentActivities.length > 0 && (
        <div className="progress-tracker-timeline">
          <h4>Recent Activity</h4>
          <div className="progress-timeline">
            {recentActivities.map((update) => (
              <div key={update.id || `${update.stage}-${update.createdAt}`} className="progress-timeline-item">
                <div className="progress-timeline-marker" />
                <div className="progress-timeline-content">
                  <div className="progress-timeline-title">{activityTitle(update)}</div>
                  {activityDetail(update) && <div className="progress-timeline-detail">{activityDetail(update)}</div>}
                  <div className="progress-timeline-meta">
                    <time dateTime={update.createdAt || undefined}>{new Date(update.createdAt || update.date).toLocaleString()}</time>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && <LoadingSpinner message="Loading progress details…" />}
    </div>
  )
}
