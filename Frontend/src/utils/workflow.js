/**
 * One-way workflow definitions and helper functions for Admin and Portal UIs.
 */

// ── 1. Distributions Workflow ──
export const DISTRIBUTION_WORKFLOW = [
  'Planning',
  'Preparing',
  'In Transit',
  'Delivered',
  'Awaiting Proof',
  'Completed',
]
export const DISTRIBUTION_TERMINAL = ['Completed']
export const DISTRIBUTION_ALIASES = {
  Scheduled: 'Planning',
  Pending: 'Planning',
  'In Progress': 'Preparing',
}

// ── 2. Donations Workflow ──
export const DONATION_WORKFLOW = [
  'Pending Verification',
  'Verified',
  'In Inventory',
  'Partially Allocated',
  'Allocated',
  'Distributed',
  'Completed',
]
export const DONATION_TERMINAL = ['Completed', 'Rejected', 'Cancelled']
export const DONATION_BRANCHES = {
  'Pending Verification': ['Rejected', 'Cancelled'],
  'Verified': ['Partially Allocated', 'Allocated', 'Cancelled'],
  'Partially Allocated': ['Allocated', 'Cancelled'],
}

// ── 3. Relief / Assistance Requests Workflow ──
export const REQUEST_WORKFLOW = [
  'Pending Review',
  'Under Review',
  'Approved',
  'Partially Funded',
  'Partially Allocated',
  'Allocated',
  'In Distribution',
  'Completed',
]
export const REQUEST_TERMINAL = ['Completed', 'Rejected', 'Cancelled']
export const REQUEST_BRANCHES = {
  'Pending Review': ['Under Review', 'Approved', 'Rejected', 'Cancelled'],
  'Under Review': ['Approved', 'Rejected', 'Cancelled'],
  'Approved': ['Partially Funded', 'Partially Allocated', 'Allocated', 'Cancelled'],
  'Partially Funded': ['Partially Allocated', 'Allocated', 'Cancelled'],
  'Partially Allocated': ['Allocated', 'In Distribution', 'Cancelled'],
  'Allocated': ['In Distribution', 'Cancelled'],
  'In Distribution': ['Completed'],
}
export const REQUEST_ALIASES = {
  'In Progress': 'In Distribution',
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
  const isApproved = norm === 'Approved'
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
export const ALLOCATION_WORKFLOW = ['Pending', 'Reserved', 'Allocated', 'In Distribution', 'Delivered']
export const ALLOCATION_TERMINAL = ['Delivered', 'Cancelled']
export const ALLOCATION_BRANCHES = {
  Pending: ['Cancelled'],
  Reserved: ['Cancelled'],
  Allocated: ['In Distribution', 'Cancelled'],
  'In Distribution': ['Delivered', 'Cancelled'],
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
