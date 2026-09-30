import { Check, Clock, FileText, CheckCircle, Package, Truck, MapPin, XCircle, ShieldCheck } from 'lucide-react'

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
    description: 'Goods packed',
  },
  {
    key: 'distribution',
    label: 'In Transit',
    icon: Truck,
    statuses: ['In Transit', 'Out for Delivery', 'Scheduled', 'Dispatched'],
    description: 'Dispatched to site',
  },
  {
    key: 'delivered',
    label: 'Delivered',
    icon: MapPin,
    statuses: ['Delivered', 'Distributed'],
    description: 'Aid received',
  },
  {
    key: 'proof',
    label: 'Proof Review',
    icon: ShieldCheck,
    statuses: ['Proof Review', 'Proof Submitted', 'Awaiting Proof'],
    description: 'Under review',
  },
  {
    key: 'completed',
    label: 'Completed',
    icon: Check,
    statuses: ['Completed', 'Done'],
    description: 'Proof approved',
  },
]

function determineCurrentStage(status) {
  if (!status) return 0
  if (['Rejected', 'Declined', 'Cancelled'].includes(status)) return 'rejected'
  const normalized = ['Preparing', 'Scheduled', 'In Distribution', 'In Progress'].includes(status) ? 'Allocated' : status
  const stageIndex = WORKFLOW_STAGES.findIndex((stage) =>
    stage.statuses.some((s) => s.toLowerCase() === normalized.toLowerCase())
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
          <span className="req-tracker-pct">
            {progressPercentage}% Completed
          </span>
        )}
      </div>

      {/* Progress Bar */}
      {!isRejected && (
        <div className="req-tracker-bar-wrap">
          <div
            className="req-tracker-bar-fill"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      )}

      {/* Rejection Notice */}
      {isRejected && (
        <div className="req-tracker-rejected">
          <XCircle size={18} style={{ flexShrink: 0 }} />
          <div>
            <strong>Request {request?.status}</strong>
            <p>This assistance request is closed or cancelled.</p>
          </div>
        </div>
      )}

      {/* Stepper - two rows of 4 to avoid overflow */}
      <div className="req-stepper-wrap">
        <div className="req-stepper-grid">
          {WORKFLOW_STAGES.map((stage, index) => {
            const status = getStageStatus(index, currentStageIndex)
            const Icon = stage.icon
            const isActive = status === 'active'
            const isCompleted = status === 'completed'
            const isRejectedStage = status === 'rejected'

            return (
              <div key={stage.key} className={`req-step-item req-step-item--${status}`}>
                <div className="req-step-dot">
                  {isCompleted ? <Check size={15} /> : isRejectedStage ? <XCircle size={15} /> : <Icon size={14} />}
                </div>
                <span className="req-step-label">{stage.label}</span>
                <span className="req-step-desc">{stage.description}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
