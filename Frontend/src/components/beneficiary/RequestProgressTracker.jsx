import { Check, Clock, FileText, CheckCircle, Package, Truck, MapPin, AlertCircle, XCircle } from 'lucide-react'

const WORKFLOW_STAGES = [
  {
    key: 'submission',
    label: 'Submitted',
    icon: FileText,
    statuses: ['Submitted', 'Pending Review', 'Pending Verification', 'Pending'],
    description: 'Request received',
  },
  {
    key: 'review',
    label: 'Under Review',
    icon: CheckCircle,
    statuses: ['Under Review', 'In Review', 'Being Reviewed'],
    description: 'Assessing needs',
  },
  {
    key: 'approved',
    label: 'Approved',
    icon: Check,
    statuses: ['Approved', 'Verified & Acknowledged'],
    description: 'Approved by staff',
  },
  {
    key: 'allocation',
    label: 'Allocated',
    icon: Package,
    statuses: ['Allocated', 'Reserved', 'In Stock'],
    description: 'Relief goods packed',
  },
  {
    key: 'distribution',
    label: 'In Transit',
    icon: Truck,
    statuses: ['In Transit', 'Out for Delivery', 'Scheduled', 'Dispatched'],
    description: 'Dispatched to site',
  },
  {
    key: 'completed',
    label: 'Delivered',
    icon: MapPin,
    statuses: ['Completed', 'Done', 'Delivered', 'Distributed'],
    description: 'Aid received',
  },
]

function determineCurrentStage(status) {
  if (!status) return 0
  if (['Rejected', 'Declined', 'Cancelled'].includes(status)) return 'rejected'
  
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
  const currentStageIndex = determineCurrentStage(request?.status)
  const isRejected = currentStageIndex === 'rejected'
  const progressPercentage = isRejected 
    ? 0 
    : Math.min(100, Math.round(((currentStageIndex + 1) / WORKFLOW_STAGES.length) * 100))

  return (
    <div className="req-tracker-container">
      <div className="req-tracker-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <Clock size={16} style={{ color: '#AF101A' }} />
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
            Lifecycle &amp; Delivery Progress
          </h4>
        </div>
        {!isRejected && (
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#059669', background: '#ecfdf5', padding: '0.2rem 0.6rem', borderRadius: '999px', border: '1px solid #a7f3d0' }}>
            {progressPercentage}% Completed
          </span>
        )}
      </div>

      {/* Progress Bar */}
      {!isRejected && (
        <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden', margin: '0.75rem 0 1.25rem' }}>
          <div
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, #AF101A 0%, #059669 100%)',
              borderRadius: '999px',
              width: `${progressPercentage}%`,
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      )}

      {/* Rejection Notice */}
      {isRejected && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', margin: '0.75rem 0 1rem', fontSize: '0.85rem' }}>
          <XCircle size={18} style={{ flexShrink: 0 }} />
          <div>
            <strong>Request {request?.status}</strong>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: '#b91c1c' }}>This assistance request is closed or cancelled.</p>
          </div>
        </div>
      )}

      {/* Workflow Stepper */}
      <div className="req-stepper-grid">
        {WORKFLOW_STAGES.map((stage, index) => {
          const status = getStageStatus(index, currentStageIndex)
          const Icon = stage.icon
          const isActive = status === 'active'
          const isCompleted = status === 'completed'
          const isRejectedStage = status === 'rejected'

          let dotBg = '#f1f5f9'
          let dotColor = '#94a3b8'
          let borderColor = '#e2e8f0'
          if (isCompleted) {
            dotBg = '#ecfdf5'
            dotColor = '#059669'
            borderColor = '#10b981'
          } else if (isActive) {
            dotBg = '#fef2f2'
            dotColor = '#AF101A'
            borderColor = '#AF101A'
          } else if (isRejectedStage) {
            dotBg = '#fef2f2'
            dotColor = '#ef4444'
            borderColor = '#ef4444'
          }

          return (
            <div key={stage.key} className="req-step-item">
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  background: dotBg,
                  color: dotColor,
                  border: `2px solid ${borderColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 0.4rem',
                  boxShadow: isActive ? '0 0 0 4px rgba(175, 16, 26, 0.12)' : 'none',
                }}
              >
                {isCompleted ? <Check size={16} /> : isRejectedStage ? <XCircle size={16} /> : <Icon size={15} />}
              </div>
              <span style={{ fontSize: '0.78rem', fontWeight: isActive || isCompleted ? 700 : 500, color: isActive ? '#AF101A' : isCompleted ? '#0f172a' : '#94a3b8', display: 'block', textAlign: 'center' }}>
                {stage.label}
              </span>
              <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', textAlign: 'center', marginTop: '0.1rem' }}>
                {stage.description}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
