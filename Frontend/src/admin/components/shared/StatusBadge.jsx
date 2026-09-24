import React from 'react'

/**
 * Standardized Semantic Status Map
 *
 * System Color Conventions:
 * 🟢 success (Green): Sufficient, Available, Approved, Completed, Delivered, Verified, Active, Done, In Inventory, Proof Verified
 * 🟡 warning / pending (Amber/Yellow): Moderate, Medium Stock, Pending, Pending Verification, Pending Review, Under Review, Pending Approval, Awaiting Confirmation, Reserved, Proof Submitted, Awaiting Proof, Planning, Scheduled
 * 🔵 primary / info (Blue): In Progress, In Transit, Preparing, Allocated, Assigned, Ongoing, In Review
 * 🔴 danger (Red): Low Stock, Critical, High (priority), Disputed, Rejected, Proof Rejected, Not Received, Failed
 * ⚪ neutral (Gray): To Do, Inactive, Cancelled, Generic, Draft, Closed
 */
const statusMap = {
  // Green / Success
  Sufficient: 'success',
  sufficient: 'success',
  Available: 'success',
  Approved: 'success',
  Completed: 'success',
  Delivered: 'success',
  Verified: 'success',
  Active: 'success',
  Done: 'success',
  Generated: 'success',
  Received: 'success',
  Distributed: 'success',
  'In Inventory': 'success',
  'Proof Verified': 'success',
  Low: 'success', // For Priority: Low is non-critical / calm green

  // Amber / Warning / Pending
  Moderate: 'warning',
  moderate: 'warning',
  'Medium Stock': 'warning',
  Medium: 'warning', // Priority Medium
  Pending: 'pending',
  'Pending Verification': 'pending',
  'Pending Review': 'pending',
  'Under Review': 'pending',
  'Pending Approval': 'pending',
  'Awaiting Confirmation': 'warning',
  Reserved: 'warning',
  'Proof Submitted': 'warning',
  'Awaiting Proof': 'warning',
  Planning: 'warning',
  Scheduled: 'warning',

  // Blue / Primary / Ongoing
  'In Progress': 'primary',
  'In Transit': 'primary',
  'In Distribution': 'primary',
  Preparing: 'primary',
  Allocated: 'primary',
  Assigned: 'primary',
  Ongoing: 'primary',
  'In Review': 'primary',

  // Red / Danger / Critical
  'Low Stock': 'danger',
  low: 'danger',
  Critical: 'danger',
  High: 'danger', // Priority High
  'Not Received': 'danger',
  Disputed: 'danger',
  Rejected: 'danger',
  'Proof Rejected': 'danger',
  Failed: 'danger',

  // Gray / Neutral
  'To Do': 'neutral',
  Inactive: 'neutral',
  Cancelled: 'neutral',
  Draft: 'neutral',
  Closed: 'neutral',
}

/**
 * Standardized StatusBadge Component
 *
 * Provides accessible, color-coded badge indicators with text and status dots.
 * Supports both `status` label string and optional `level` ('sufficient'|'moderate'|'low').
 */
export default function StatusBadge({ status, level, className = '' }) {
  // If a stock level is passed explicitly, map directly to inventory stock status
  let resolvedVariant = null
  let displayText = status

  if (level) {
    const normLevel = String(level).toLowerCase().trim()
    if (normLevel === 'low') {
      resolvedVariant = 'danger'
      if (!displayText) displayText = 'Low Stock'
    } else if (normLevel === 'moderate') {
      resolvedVariant = 'warning'
      if (!displayText) displayText = 'Moderate'
    } else if (normLevel === 'sufficient') {
      resolvedVariant = 'success'
      if (!displayText) displayText = 'Sufficient'
    }
  }

  if (!resolvedVariant) {
    resolvedVariant = statusMap[status] || 'neutral'
  }

  if (!displayText) {
    displayText = status || 'Unknown'
  }

  return (
    <span
      className={`status-badge status-badge--${resolvedVariant} ${className}`.trim()}
      role="status"
    >
      <span className="status-badge__dot" aria-hidden="true" />
      <span className="status-badge__label">{displayText}</span>
    </span>
  )
}
