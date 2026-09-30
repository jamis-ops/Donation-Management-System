/**
 * One-way workflow definitions and helper functions for Admin and Portal UIs.
 */

// ── 1. Distributions Workflow ──
export const DISTRIBUTION_WORKFLOW = [
  'Planning',
  'Preparing',
  'In Transit',
  'Delivered',
  'Proof Review',
  'Completed',
]
export const DISTRIBUTION_TERMINAL = ['Completed']
export const DISTRIBUTION_ALIASES = {
  Scheduled: 'Planning',
  Pending: 'Planning',
  'In Progress': 'Preparing',
  'Awaiting Proof': 'Proof Review',
}

/**
 * Determines the sequential next step, action button label, icon,
 * and contextual prompt for a distribution based on its current stage and proof status.
 */
export function getNextDistributionAction(distribution) {
  if (!distribution) return null

  const current = DISTRIBUTION_ALIASES[distribution.status] || distribution.status || 'Planning'
  const proofStatus = distribution.proofStatus || 'Not Required'
  const hasProofs = (distribution.proofs && distribution.proofs.length > 0) || (distribution.proofsCount > 0)
  const isProofSubmitted = proofStatus === 'Proof Submitted' || (hasProofs && proofStatus !== 'Proof Rejected')
  const isProofVerified = proofStatus === 'Proof Verified' || current === 'Completed'

  switch (current) {
    case 'Planning':
      return {
        nextStatus: 'Preparing',
        label: 'Start Preparing Delivery',
        shortLabel: 'Start Preparing',
        prompt: 'Transition distribution to Preparing? Logistics team can begin cargo staging and repacking.',
        buttonVariant: 'primary',
        canAdvance: true,
        isApproveAction: false,
        pendingText: 'Pending cargo packing and vehicle preparation.',
        verifiedText: 'Delivery scheduled & cargo allocated.',
      }

    case 'Preparing':
      return {
        nextStatus: 'In Transit',
        label: 'Dispatch Delivery (In Transit)',
        shortLabel: 'Dispatch Delivery',
        prompt: 'Dispatch delivery? Vehicle and assigned team will be marked In Transit to target barangay.',
        buttonVariant: 'primary',
        canAdvance: true,
        isApproveAction: false,
        pendingText: 'Awaiting team dispatch to destination.',
        verifiedText: 'Cargo repacked and vehicle assigned.',
      }

    case 'In Transit':
      return {
        nextStatus: 'Delivered',
        label: 'Confirm Delivery Arrival (Delivered)',
        shortLabel: 'Confirm Delivered',
        prompt: 'Confirm that the delivery team has reached the destination barangay and handed over cargo?',
        buttonVariant: 'primary',
        canAdvance: true,
        isApproveAction: false,
        pendingText: 'In transit to drop-off location.',
        verifiedText: 'Dispatched and on route.',
      }

    case 'Delivered':
      // If barangay already submitted proof, admin can approve and complete
      if (isProofSubmitted) {
        return {
          nextStatus: 'Completed',
          label: 'Approve Proof & Complete Delivery',
          shortLabel: 'Approve & Complete',
          prompt: 'Approve the uploaded turnover proof photos and finalize this distribution as Completed?',
          buttonVariant: 'success',
          canAdvance: true,
          isApproveAction: true,
          pendingText: 'Turnover proof photos submitted. Ready for admin verification.',
          verifiedText: 'Delivered to barangay destination.',
        }
      }
      return {
        nextStatus: 'Proof Review',
        label: 'Advance to Proof Review',
        shortLabel: 'Proof Review',
        prompt: 'Move to Proof Review stage? The barangay can upload turnover proof photos.',
        buttonVariant: 'primary',
        canAdvance: true,
        isApproveAction: false,
        pendingText: 'Awaiting barangay acknowledgment & turnover photo upload.',
        verifiedText: 'Delivered to drop-off point.',
      }

    case 'Proof Review':
      if (isProofSubmitted) {
        return {
          nextStatus: 'Completed',
          label: 'Approve Proof & Complete Delivery',
          shortLabel: 'Approve & Complete',
          prompt: 'Approve the uploaded turnover proof photos and finalize this distribution as Completed?',
          buttonVariant: 'success',
          canAdvance: true,
          isApproveAction: true,
          pendingText: 'Turnover proof photos submitted. Ready for admin approval.',
          verifiedText: 'Goods received by barangay.',
        }
      }
      return {
        nextStatus: null,
        label: 'Awaiting Barangay Proof Submission',
        shortLabel: 'Awaiting Proof',
        prompt: null,
        buttonVariant: 'muted',
        canAdvance: false,
        isApproveAction: false,
        pendingText: 'Barangay has not uploaded turnover proof photos yet. Representative can upload via Barangay Portal.',
        verifiedText: 'Cargo delivered.',
      }

    case 'Completed':
      return {
        nextStatus: null,
        label: 'Delivery Completed & Verified',
        shortLabel: 'Completed',
        prompt: null,
        buttonVariant: 'completed',
        canAdvance: false,
        isApproveAction: false,
        pendingText: null,
        verifiedText: 'Delivery completed and turnover proof verified.',
      }

    default:
      return null
  }
}

// ── 2. Donations Workflow ──
export const DONATION_WORKFLOW = [
  'Pending Verification',
  'Verified',
  'Allocated',
  'In Transit',
  'Delivered',
  'Completed',
]
export const DONATION_TERMINAL = ['Completed', 'Rejected', 'Cancelled']
export const DONATION_BRANCHES = {
  'Pending Verification': ['Rejected', 'Cancelled'],
  'Verified': ['Allocated', 'Cancelled'],
  'Allocated': ['In Transit', 'Delivered', 'Completed', 'Cancelled'],
  'In Transit': ['Delivered', 'Completed'],
  'Delivered': ['Completed'],
}

// ── 3. Relief / Assistance Requests Workflow ──
export const REQUEST_WORKFLOW = [
  'Pending Review',
  'Under Review',
  'Approved',
  'Ready for Allocation',
  'Partially Funded',
  'Partially Allocated',
  'Allocated',
  'In Transit',
  'Delivered',
  'Proof Review',
  'Completed',
]
export const REQUEST_TERMINAL = ['Completed', 'Rejected', 'Cancelled']
export const REQUEST_BRANCHES = {
  'Pending Review': ['Under Review', 'Approved', 'Ready for Allocation', 'Rejected', 'Cancelled'],
  'Under Review': ['Approved', 'Ready for Allocation', 'Rejected', 'Cancelled'],
  'Approved': ['Ready for Allocation', 'Partially Funded', 'Partially Allocated', 'Allocated', 'Cancelled'],
  'Ready for Allocation': ['Partially Funded', 'Partially Allocated', 'Allocated', 'Cancelled'],
  'Partially Funded': ['Ready for Allocation', 'Partially Allocated', 'Allocated', 'Cancelled'],
  'Partially Allocated': ['Allocated', 'Cancelled'],
  'Allocated': ['In Transit', 'Cancelled'],
  'In Transit': ['Delivered', 'Completed'],
  'Delivered': ['Proof Review', 'Completed'],
  'Proof Review': ['Delivered', 'Completed'],
}
export const REQUEST_ALIASES = {
  'In Progress': 'Allocated',
  'In Distribution': 'Allocated',
  'Preparing': 'Allocated',
  'Scheduled': 'Allocated',
  'Scheduled for Delivery': 'Allocated',
  'Ready': 'Ready for Allocation',
}

/**
 * Universal action permissions for Relief Requests:
 * - Pending Review / Under Review: Approve and Reject only (NO delete).
 * - Approved / Allocated / In Progress / Completed: NO Approve, NO Reject, NO Delete.
 * - Rejected: Delete only (NO approve, NO reject).
 */
export function getReliefRequestActionPermissions(status) {
  const norm = (status || '').trim()
  const isPending = ['Pending Review', 'Under Review', 'Pending'].includes(norm)
  const isRejected = norm === 'Rejected'
  const isApproved = norm === 'Approved' || norm === 'Ready for Allocation'
  const isAllocatedOrInProgressOrDone = [
    'Approved',
    'Partially Funded',
    'Partially Allocated',
    'Allocated',
    'In Distribution',
    'In Progress',
    'In Transit',
    'Delivered',
    'Distributed',
    'Completed',
    'Done',
    'Cancelled',
  ].includes(norm)

  return {
    canApprove: isPending,
    canReject: isPending,
    canDelete: isRejected,
    isPending,
    isRejected,
    isApproved,
    isAllocatedOrInProgressOrDone,
  }
}

// ── 4. Task Board Columns Workflow ──
export const TASK_WORKFLOW = ['todo', 'inProgress', 'review', 'done']
export const TASK_TERMINAL = ['done']
export const TASK_ALIASES = {
  'To Do': 'todo',
  'In Progress': 'inProgress',
  'In Review': 'review',
  'Done': 'done',
  'Completed': 'done',
}

// ── 5. Allocations Workflow ──
export const ALLOCATION_WORKFLOW = ['Allocated', 'Scheduled', 'In Transit', 'Delivered']
export const ALLOCATION_TERMINAL = ['Delivered', 'Cancelled']
export const ALLOCATION_BRANCHES = {
  Allocated: ['Scheduled', 'In Distribution', 'Cancelled'],
  Scheduled: ['In Transit', 'Cancelled'],
  'In Distribution': ['Scheduled', 'In Transit', 'Delivered', 'Cancelled'],
  'In Transit': ['Delivered'],
}
export const ALLOCATION_ALIASES = {
  Pending: 'Allocated',
  Reserved: 'Allocated',
  Preparing: 'Scheduled',
  'Scheduled for Delivery': 'Scheduled',
}

// ── 6. Volunteers Workflow ──
export const VOLUNTEER_WORKFLOW = [
  'Pending Review',
  'Approved',
  'Active',
  'Assigned',
  'Completed',
]
export const VOLUNTEER_TERMINAL = ['Completed', 'Rejected']
export const VOLUNTEER_BRANCHES = {
  'Pending Review': ['Rejected'],
}

// ── 7. Certificates Workflow ──
export const CERTIFICATE_WORKFLOW = ['Requested', 'Pending', 'Approved', 'Generated', 'Released']
export const CERTIFICATE_TERMINAL = ['Released', 'Rejected']
export const CERTIFICATE_BRANCHES = {
  Requested: ['Approved', 'Rejected'],
  Pending: ['Approved', 'Rejected'],
  Approved: ['Generated', 'Rejected'],
}

/**
 * Returns whether a status is a final/completed terminal status.
 */
export function isTerminalStatus(status, terminalList = []) {
  if (!status) return false
  return terminalList.includes(status)
}

/**
 * Filters the list of all statuses to only those that represent valid forward progression
 * from the current status (including current status).
 */
export function getAvailableNextStatuses({
  currentStatus,
  allStatuses = [],
  workflowOrder = [],
  terminalStatuses = [],
  branches = {},
  aliases = {},
}) {
  const normCurrent = aliases[currentStatus] || currentStatus

  // If no current status (e.g. new creation form), allow all initial statuses (or all options)
  if (!normCurrent) {
    return allStatuses.length ? allStatuses : workflowOrder
  }

  // If status is terminal/final, only the current status can be shown (locked)
  if (isTerminalStatus(normCurrent, terminalStatuses)) {
    return [currentStatus]
  }

  const currIndex = workflowOrder.indexOf(normCurrent)
  const allowedBranchOptions = branches[normCurrent] || []

  // If not found in linear workflow, allow current plus any branch options
  if (currIndex === -1) {
    const list = [currentStatus, ...allowedBranchOptions]
    return [...new Set(list)]
  }

  // Linear forward steps: current index onwards
  const forwardSteps = workflowOrder.slice(currIndex)

  // Map to original labels if in allStatuses
  const combined = [...forwardSteps, ...allowedBranchOptions]
  
  // If allStatuses was provided, filter it so we preserve exact casing/formatting from the caller
  if (allStatuses.length > 0) {
    const available = allStatuses.filter((s) => {
      const normS = aliases[s] || s
      return combined.includes(normS) || normS === normCurrent
    })
    return available.length ? available : [currentStatus]
  }

  return combined
}

/**
 * Checks whether a proposed status transition is valid (one-way forward).
 */
export function validateStatusTransition({
  entityName = 'Record',
  currentStatus,
  nextStatus,
  workflowOrder = [],
  terminalStatuses = [],
  branches = {},
  aliases = {},
}) {
  const curr = aliases[currentStatus] || currentStatus
  const next = aliases[nextStatus] || nextStatus

  if (!curr || curr === next) return { valid: true }

  if (isTerminalStatus(curr, terminalStatuses)) {
    return {
      valid: false,
      message: `${entityName} is already ${curr} (final status) and cannot be changed or reverted.`,
    }
  }

  const allowedBranch = (branches[curr] || []).includes(next)
  if (allowedBranch) return { valid: true }

  const currIdx = workflowOrder.indexOf(curr)
  const nextIdx = workflowOrder.indexOf(next)

  if (currIdx !== -1 && nextIdx !== -1) {
    if (nextIdx < currIdx) {
      return {
        valid: false,
        message: `Cannot revert ${entityName.toLowerCase()} status from "${currentStatus}" back to previous status "${nextStatus}". Status workflow is one-way.`,
      }
    }
    return { valid: true }
  }

  return {
    valid: false,
    message: `Invalid status transition for ${entityName.toLowerCase()} from "${currentStatus}" to "${nextStatus}".`,
  }
}
