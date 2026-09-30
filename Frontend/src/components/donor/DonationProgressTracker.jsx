import { useEffect, useState } from 'react'
import { Check, Clock, HeartHandshake, Upload, ShieldCheck, Award, AlertCircle } from 'lucide-react'
import { donationUpdatesApi } from '../../api/resources'
import LoadingSpinner from '../shared/LoadingSpinner'
import '../../styles/donation-progress-tracker.css'

const WORKFLOW_STAGES = [
  {
    key: 'donate',
    label: 'Donate',
    icon: HeartHandshake,
    description: 'Your donation has been submitted',
  },
  {
    key: 'submit-proof',
    label: 'Submit Proof',
    icon: Upload,
    description: 'Submit the required donation proof',
  },
  {
    key: 'verify-proof',
    label: 'Verify Proof',
    icon: ShieldCheck,
    description: 'Our team verifies the submitted proof',
  },
  {
    key: 'completed',
    label: 'Completed',
    icon: Check,
    description: 'The donation process is complete',
  },
]

/* Statuses the backend can return that mean the donation is fully done */
const COMPLETED_STATUSES = [
  'completed',
  'certificate / official receipt',
  'verified',
  'verified & acknowledged',
  'in inventory',
  'in stock',
  'repacked',
  'repacking',
  'partially allocated',
  'allocated',
  'reserved',
  'assigned',
  'scheduled',
  'in transit',
  'out for delivery',
  'distributed',
  'delivered',
  'received',
]

function determineCurrentStage(status, hasProof) {
  const normalized = String(status || '').trim().toLowerCase()
  if (!normalized) return 0

  // If the status means the donation is verified / processed / delivered → Completed
  if (COMPLETED_STATUSES.includes(normalized)) return 3

  // Still being verified
  if (['pending verification', 'under review'].includes(normalized)) return hasProof ? 2 : 1

  // Fallback: submitted
  return 0
}

function getStageStatus(stageIndex, currentIndex) {
  if (currentIndex < 0) return 'pending'
  if (stageIndex < currentIndex) return 'completed'
  if (stageIndex === currentIndex) return 'active'
  return 'pending'
}

export default function DonationProgressTracker({ donation, donationId, onRequestCertificate }) {
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

    // Auto-refresh every 30 seconds if enabled
    if (autoRefresh) {
      const interval = setInterval(fetchUpdates, 30000)
      return () => clearInterval(interval)
    }
  }, [donationId, donation?.status, autoRefresh])

  const syncedStatus = remoteProgress.donationId === donationId && remoteProgress.status
    ? remoteProgress.status
    : (donation?.status || '')

  const currentStageIndex = determineCurrentStage(syncedStatus, donation?.hasProof)
  const isCompleted = currentStageIndex === 3
  const progressPercentage = isCompleted
    ? 100
    : Math.round(((currentStageIndex + 1) / WORKFLOW_STAGES.length) * 100)

  const latestUpdate = updates.length > 0 ? updates[updates.length - 1] : null

  return (
    <div className="donation-progress-tracker">
      {/* Header with overall status */}
      <div className="progress-tracker-header">
        <div className="progress-tracker-title">
          <h3>Donation Journey</h3>
          <div className="progress-tracker-controls">
            <label className="progress-tracker-toggle">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              <span>Auto-refresh</span>
            </label>
          </div>
        </div>
        <div className="progress-tracker-status">
          <div className="progress-tracker-status-badge">
            <Clock size={14} />
            <span>Current Status: <strong>{syncedStatus || 'Unknown'}</strong></span>
          </div>
          {latestUpdate && (
            <div className="progress-tracker-last-update">
              Last updated: {new Date(latestUpdate.createdAt || latestUpdate.date).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* Overall Progress Bar */}
      <div className="progress-tracker-bar-container">
        <div className="progress-tracker-bar">
          <div
            className="progress-tracker-bar-fill"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <span className="progress-tracker-percentage">{progressPercentage}%</span>
      </div>

      {/* Workflow Stages */}
      <div className="progress-tracker-stages">
        {WORKFLOW_STAGES.map((stage, index) => {
          const stageStatus = getStageStatus(index, currentStageIndex)
          const Icon = stage.icon
          const isActive = stageStatus === 'active'
          const isStageCompleted = stageStatus === 'completed'
          const connectorReached = index <= currentStageIndex

          return (
            <div
              key={stage.key}
              className={`progress-stage progress-stage--${stageStatus}`}
            >
              <div className="progress-stage-line">
                {index > 0 && (
                  <div className={`progress-stage-line-segment ${connectorReached ? 'completed' : ''}`} />
                )}
              </div>

              <div className="progress-stage-icon-wrapper">
                <div className={`progress-stage-icon ${isActive ? 'pulse' : ''}`}>
                  {isStageCompleted ? <Check size={18} /> : <Icon size={18} />}
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

      {/* Certificate Action — only shown after completion */}
      {isCompleted && (
        <div className="progress-tracker-certificate-action">
          <div className="certificate-action-info">
            <Award size={20} />
            <div>
              <strong>Donation Completed!</strong>
              <span>Your certificate is now available.</span>
            </div>
          </div>
          {onRequestCertificate ? (
            <button
              type="button"
              className="btn btn--primary certificate-action-btn"
              onClick={onRequestCertificate}
            >
              <Award size={16} />
              Get Certificate
            </button>
          ) : (
            <span className="certificate-action-hint">
              You can request a certificate from the modal actions below.
            </span>
          )}
        </div>
      )}

      {loading && <LoadingSpinner message="Loading progress details…" />}
    </div>
  )
}
