import { useEffect, useState } from 'react'
import { Check, Clock, HeartHandshake, Upload, ShieldCheck, Award, Lock, AlertCircle } from 'lucide-react'
import { donationUpdatesApi } from '../../api/resources'
import LoadingSpinner from '../shared/LoadingSpinner'
import '../../styles/donation-progress-tracker.css'

const WORKFLOW_STAGES = [
  { key: 'donate', label: 'Donate', icon: HeartHandshake, description: 'Your donation has been submitted' },
  { key: 'submit-proof', label: 'Submit Proof', icon: Upload, description: 'Submit the required donation proof' },
  { key: 'verify-proof', label: 'Verify Proof', icon: ShieldCheck, description: 'Our team verifies the submitted proof' },
  { key: 'completed', label: 'Completed', icon: Check, description: 'The donation process is complete' },
  { key: 'certificate', label: 'Certificate', icon: Award, description: 'Available after completion' },
]

const COMPLETED_STATUSES = ['completed', 'certificate / official receipt']

function determineCurrentStage(status, hasProof) {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'certificate / official receipt') return 4
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
  const certificateUnlocked = COMPLETED_STATUSES.includes(normalizedStatus)
  const currentStageIndex = determineCurrentStage(syncedStatus, donation?.hasProof)
  const progressPercentage = calculateProgressPercentage(currentStageIndex)
  const isRejectedOrCancelled = ['rejected', 'cancelled'].includes(normalizedStatus)
  const latestUpdate = updates.length > 0 ? updates[updates.length - 1] : null

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
          const certificateLocked = stage.key === 'certificate' && !certificateUnlocked
          const Icon = certificateLocked ? Lock : stage.icon
          const connectorReached = currentStageIndex >= 0 && index <= currentStageIndex
          return (
            <div key={stage.key} className={`progress-stage progress-stage--${certificateLocked ? 'locked' : stageStatus}${stage.key === 'certificate' && certificateUnlocked ? ' progress-stage--available' : ''}`}>
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
                <div className="progress-stage-description">{stage.key === 'certificate' && certificateUnlocked ? 'Available to request' : stage.description}</div>
                {isActive && latestUpdate && (
                  <div className="progress-stage-update">
                    <AlertCircle size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{latestUpdate.note || latestUpdate.stage || latestUpdate.message || latestUpdate.description}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {updates.length > 0 && (
        <div className="progress-tracker-timeline">
          <h4>Recent Activity</h4>
          <div className="progress-timeline">
            {updates.slice(0, 5).map((update, idx) => (
              <div key={idx} className="progress-timeline-item">
                <div className="progress-timeline-marker" />
                <div className="progress-timeline-content">
                  <div className="progress-timeline-title">{update.note || update.stage || update.message || update.description || 'Status updated'}</div>
                  <div className="progress-timeline-meta">
                    <span>{new Date(update.createdAt || update.date).toLocaleString()}</span>
                    {update.updatedBy && <span> • By {update.updatedBy}</span>}
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
