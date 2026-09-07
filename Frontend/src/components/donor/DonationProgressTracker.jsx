import { useEffect, useState } from 'react'
import { Check, Clock, Package, CheckCircle, Truck, MapPin, AlertCircle } from 'lucide-react'
import { donationUpdatesApi } from '../../api/resources'

const WORKFLOW_STAGES = [
  {
    key: 'submission',
    label: 'Submission',
    icon: Package,
    statuses: ['Submitted', 'Pending Verification'],
    description: 'Your donation has been received and is awaiting verification',
  },
  {
    key: 'verification',
    label: 'Verification',
    icon: CheckCircle,
    statuses: ['Verified', 'Verified & Acknowledged', 'Under Review'],
    description: 'Our team is verifying your donation details',
  },
  {
    key: 'repacking',
    label: 'Repacking',
    icon: Package,
    statuses: ['In Inventory', 'In Stock', 'Repacked', 'Repacking'],
    description: 'Items are being organized and prepared for distribution',
  },
  {
    key: 'allocation',
    label: 'Allocation',
    icon: MapPin,
    statuses: ['Allocated', 'Reserved', 'Assigned'],
    description: 'Resources are being assigned to beneficiaries',
  },
  {
    key: 'distribution',
    label: 'Distribution',
    icon: Truck,
    statuses: ['In Transit', 'Out for Delivery', 'Scheduled'],
    description: 'Your donation is on its way to beneficiaries',
  },
  {
    key: 'completed',
    label: 'Completed',
    icon: Check,
    statuses: ['Distributed', 'Delivered', 'Completed'],
    description: 'Your donation has reached the beneficiaries!',
  },
]

function determineCurrentStage(status) {
  if (!status) return -1
  
  const stageIndex = WORKFLOW_STAGES.findIndex((stage) =>
    stage.statuses.some((s) => s.toLowerCase() === status.toLowerCase())
  )
  
  return stageIndex >= 0 ? stageIndex : 0
}

function getStageStatus(stageIndex, currentIndex) {
  if (stageIndex < currentIndex) return 'completed'
  if (stageIndex === currentIndex) return 'active'
  return 'pending'
}

export default function DonationProgressTracker({ donation, donationId }) {
  const [updates, setUpdates] = useState([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    if (!donationId) return

    const fetchUpdates = async () => {
      try {
        const res = await donationUpdatesApi.list(donationId)
        setUpdates(res.data || [])
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
  }, [donationId, autoRefresh])

  const currentStageIndex = determineCurrentStage(donation?.status)
  const progressPercentage = ((currentStageIndex + 1) / WORKFLOW_STAGES.length) * 100

  const latestUpdate = updates.length > 0 ? updates[0] : null

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
            <span>Current Status: <strong>{donation?.status || 'Unknown'}</strong></span>
          </div>
          {latestUpdate && (
            <div className="progress-tracker-last-update">
              Last updated: {new Date(latestUpdate.date || latestUpdate.createdAt).toLocaleString()}
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
        <span className="progress-tracker-percentage">{Math.round(progressPercentage)}%</span>
      </div>

      {/* Workflow Stages */}
      <div className="progress-tracker-stages">
        {WORKFLOW_STAGES.map((stage, index) => {
          const status = getStageStatus(index, currentStageIndex)
          const Icon = stage.icon
          const isActive = status === 'active'
          const isCompleted = status === 'completed'

          return (
            <div key={stage.key} className={`progress-stage progress-stage--${status}`}>
              <div className="progress-stage-line">
                {index > 0 && (
                  <div className={`progress-stage-line-segment ${isCompleted ? 'completed' : ''}`} />
                )}
              </div>
              
              <div className="progress-stage-icon-wrapper">
                <div className={`progress-stage-icon ${isActive ? 'pulse' : ''}`}>
                  {isCompleted ? <Check size={18} /> : <Icon size={18} />}
                </div>
              </div>

              <div className="progress-stage-content">
                <div className="progress-stage-label">{stage.label}</div>
                <div className="progress-stage-description">{stage.description}</div>
                
                {isActive && latestUpdate && (
                  <div className="progress-stage-update">
                    <AlertCircle size={12} />
                    <span>{latestUpdate.message || latestUpdate.description}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Recent Activity Timeline */}
      {updates.length > 0 && (
        <div className="progress-tracker-timeline">
          <h4>Recent Activity</h4>
          <div className="progress-timeline">
            {updates.slice(0, 5).map((update, idx) => (
              <div key={idx} className="progress-timeline-item">
                <div className="progress-timeline-marker" />
                <div className="progress-timeline-content">
                  <div className="progress-timeline-title">
                    {update.message || update.description || 'Status updated'}
                  </div>
                  <div className="progress-timeline-meta">
                    <span>{new Date(update.date || update.createdAt).toLocaleString()}</span>
                    {update.updatedBy && <span> • By {update.updatedBy}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="progress-tracker-loading">
          <div className="spinner" />
          <span>Loading progress details...</span>
        </div>
      )}
    </div>
  )
}
