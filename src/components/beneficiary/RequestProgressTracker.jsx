import { useEffect, useState } from 'react'
import { Check, Clock, FileText, CheckCircle, Package, Truck, MapPin, AlertCircle, XCircle } from 'lucide-react'

const WORKFLOW_STAGES = [
  {
    key: 'submission',
    label: 'Submission',
    icon: FileText,
    statuses: ['Submitted', 'Pending Review', 'Pending Verification', 'Pending'],
    description: 'Your assistance request has been submitted and received',
  },
  {
    key: 'review',
    label: 'Under Review',
    icon: CheckCircle,
    statuses: ['Under Review', 'In Review', 'Being Reviewed'],
    description: 'Staff is reviewing your request and assessing needs',
  },
  {
    key: 'approved',
    label: 'Approved',
    icon: Check,
    statuses: ['Approved', 'Verified & Acknowledged'],
    description: 'Your request has been approved and resources are being prepared',
  },
  {
    key: 'allocation',
    label: 'Allocation',
    icon: Package,
    statuses: ['Allocated', 'Reserved', 'In Stock'],
    description: 'Resources have been allocated for your barangay',
  },
  {
    key: 'distribution',
    label: 'Distribution',
    icon: Truck,
    statuses: ['In Transit', 'Out for Delivery', 'Scheduled', 'Dispatched'],
    description: 'Resources are being delivered to your location',
  },
  {
    key: 'completed',
    label: 'Completed',
    icon: MapPin,
    statuses: ['Completed', 'Done', 'Delivered', 'Distributed'],
    description: 'Assistance has been successfully delivered!',
  },
]

function determineCurrentStage(status) {
  if (!status) return -1
  
  // Check for rejected status
  if (['Rejected', 'Declined', 'Cancelled'].includes(status)) {
    return 'rejected'
  }
  
  const stageIndex = WORKFLOW_STAGES.findIndex((stage) =>
    stage.statuses.some((s) => s.toLowerCase() === status.toLowerCase())
  )
  
  return stageIndex >= 0 ? stageIndex : 0
}

function getStageStatus(stageIndex, currentIndex) {
  if (currentIndex === 'rejected') {
    return stageIndex <= 1 ? 'rejected' : 'pending'
  }
  if (stageIndex < currentIndex) return 'completed'
  if (stageIndex === currentIndex) return 'active'
  return 'pending'
}

export default function RequestProgressTracker({ request }) {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    // Update current time every minute for relative timestamps
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  const currentStageIndex = determineCurrentStage(request?.status)
  const isRejected = currentStageIndex === 'rejected'
  const progressPercentage = isRejected 
    ? 0 
    : ((currentStageIndex + 1) / WORKFLOW_STAGES.length) * 100

  // Parse structured notes for additional context
  const notes = request?.notes || ''
  const calamityMatch = notes.match(/Calamity\/Program: (.+?)(?:\n|$)/i)
  const calamityType = calamityMatch ? calamityMatch[1].trim() : ''
  
  const familiesMatch = notes.match(/Families Affected: (\d+)/i)
  const familiesAffected = familiesMatch ? familiesMatch[1] : ''
  
  const needsMatch = notes.match(/Type of Needs: (.+?)(?:\n|$)/i)
  const needsList = needsMatch ? needsMatch[1].trim() : ''

  // Calculate time since submission
  const submittedDate = request?.date ? new Date(request.date) : null
  const daysSinceSubmission = submittedDate 
    ? Math.floor((currentTime - submittedDate) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="request-progress-tracker">
      {/* Header with overall status */}
      <div className="progress-tracker-header">
        <div className="progress-tracker-title">
          <h3>Request Progress</h3>
          {daysSinceSubmission !== null && (
            <span className="progress-tracker-days">
              Submitted {daysSinceSubmission === 0 ? 'today' : `${daysSinceSubmission} day${daysSinceSubmission === 1 ? '' : 's'} ago`}
            </span>
          )}
        </div>
        <div className="progress-tracker-status">
          <div className={`progress-tracker-status-badge ${isRejected ? 'rejected' : ''}`}>
            {isRejected ? <XCircle size={14} /> : <Clock size={14} />}
            <span>Current Status: <strong>{request?.status || 'Unknown'}</strong></span>
          </div>
        </div>
      </div>

      {/* Request Summary Card */}
      {(calamityType || needsList || familiesAffected) && (
        <div className="request-summary-card">
          <div className="request-summary-header">
            <AlertCircle size={16} />
            <strong>Request Summary</strong>
          </div>
          <div className="request-summary-content">
            {calamityType && (
              <div className="request-summary-item">
                <span className="request-summary-label">Reason:</span>
                <span className="request-summary-value">{calamityType}</span>
              </div>
            )}
            {needsList && (
              <div className="request-summary-item">
                <span className="request-summary-label">Needs:</span>
                <span className="request-summary-value">{needsList}</span>
              </div>
            )}
            {familiesAffected && (
              <div className="request-summary-item">
                <span className="request-summary-label">Families Affected:</span>
                <span className="request-summary-value">{familiesAffected}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overall Progress Bar */}
      {!isRejected && (
        <div className="progress-tracker-bar-container">
          <div className="progress-tracker-bar">
            <div
              className="progress-tracker-bar-fill"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <span className="progress-tracker-percentage">{Math.round(progressPercentage)}%</span>
        </div>
      )}

      {/* Rejection Notice */}
      {isRejected && (
        <div className="request-rejection-notice">
          <XCircle size={20} />
          <div>
            <strong>Request {request?.status}</strong>
            <p>Your assistance request was not approved. Please contact the office for more information or submit a new request with updated details.</p>
          </div>
        </div>
      )}

      {/* Workflow Stages */}
      <div className="progress-tracker-stages">
        {WORKFLOW_STAGES.map((stage, index) => {
          const status = getStageStatus(index, currentStageIndex)
          const Icon = stage.icon
          const isActive = status === 'active'
          const isCompleted = status === 'completed'
          const isRejectedStage = status === 'rejected'

          return (
            <div key={stage.key} className={`progress-stage progress-stage--${status}`}>
              <div className="progress-stage-line">
                {index > 0 && (
                  <div className={`progress-stage-line-segment ${isCompleted ? 'completed' : ''} ${isRejectedStage ? 'rejected' : ''}`} />
                )}
              </div>
              
              <div className="progress-stage-icon-wrapper">
                <div className={`progress-stage-icon ${isActive ? 'pulse' : ''}`}>
                  {isRejectedStage ? (
                    <XCircle size={18} />
                  ) : isCompleted ? (
                    <Check size={18} />
                  ) : (
                    <Icon size={18} />
                  )}
                </div>
              </div>

              <div className="progress-stage-content">
                <div className="progress-stage-label">{stage.label}</div>
                <div className="progress-stage-description">{stage.description}</div>
                
                {isActive && !isRejected && (
                  <div className="progress-stage-update">
                    <AlertCircle size={12} />
                    <span>
                      {index === 0 && 'Your request is being processed'}
                      {index === 1 && 'Staff is evaluating your needs'}
                      {index === 2 && 'Resources are being identified'}
                      {index === 3 && 'Preparing items for distribution'}
                      {index === 4 && 'Coordinating delivery schedule'}
                      {index === 5 && 'Distribution in progress'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Important Notes */}
      <div className="progress-tracker-info">
        <div className="progress-tracker-info-icon">
          <AlertCircle size={18} />
        </div>
        <div className="progress-tracker-info-content">
          <strong>Track Your Request</strong>
          <p>
            Use Request ID <code className="request-id-badge">{request?.id || 'N/A'}</code> when 
            following up with staff about allocation or delivery updates. 
            {!isRejected && currentStageIndex < 2 && ' Your request is currently being reviewed by our team.'}
            {!isRejected && currentStageIndex >= 2 && currentStageIndex < 4 && ' Resources are being prepared for distribution.'}
            {!isRejected && currentStageIndex >= 4 && ' Your assistance is being delivered soon!'}
          </p>
          {!isRejected && currentStageIndex < WORKFLOW_STAGES.length - 1 && (
            <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#64748b' }}>
              Estimated time: Processing may take 3-7 business days depending on availability and coordination.
            </p>
          )}
        </div>
      </div>

      {/* Additional Request Details */}
      {request?.priority && (
        <div className="progress-tracker-priority">
          <span className="progress-tracker-priority-label">Priority Level:</span>
          <span className={`beneficiary-priority-badge beneficiary-priority-badge--${request.priority.toLowerCase()}`}>
            {request.priority}
          </span>
        </div>
      )}
    </div>
  )
}
