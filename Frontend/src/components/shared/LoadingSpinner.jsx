import { useLayoutEffect } from 'react'
import { useLoading } from '../../context/LoadingContext'
import '../../styles/loading-spinner.css'

/**
 * Standardized Rise Above Foundation Cebu loading screen component.
 * Directly integrates with the single original heart-and-butterfly loading modal
 * to prevent duplicate loaders throughout the system.
 */
export default function LoadingSpinner({
  message = 'Please wait…',
}) {
  const { showLoading, hideLoading } = useLoading()

  useLayoutEffect(() => {
    showLoading(message || 'Please wait…')
    return () => {
      hideLoading()
    }
  }, [showLoading, hideLoading, message])

  return null
}

/**
 * Full-page loading overlay consolidated into the single heart-and-butterfly modal.
 */
export function LoadingOverlay({ message = 'Please wait…' }) {
  return <LoadingSpinner message={message} />
}

/**
 * Consolidated into the single heart-and-butterfly modal.
 */
export function LoadingHeart({ message = 'Please wait…' }) {
  return <LoadingSpinner message={message} />
}

/**
 * Consolidated skeleton loader into the single heart-and-butterfly modal.
 */
export function SkeletonLoader({ message = 'Please wait…' }) {
  return <LoadingSpinner message={message} />
}

/**
 * Inline loader returning null to eliminate competing spinner designs in favor
 * of the single unified heart-and-butterfly modal.
 */
export function InlineLoader() {
  return null
}
