import { useLayoutEffect } from 'react'
import { useLoading } from '../../context/LoadingContext'
import '../../styles/loading-spinner.css'

/**
 * Standardized Rise Above Foundation Cebu loading screen component.
 * Directly integrates with the single original heart-and-butterfly loading modal
 * to prevent duplicate loaders throughout the system.
 */
export default function LoadingSpinner({
  message = 'Loading…',
  subtext = 'Please wait.',
}) {
  const { showLoading, hideLoading } = useLoading()

  useLayoutEffect(() => {
    showLoading({ message: message || 'Loading…', subtext: subtext ?? 'Please wait.' })
    return () => {
      hideLoading()
    }
  }, [showLoading, hideLoading, message, subtext])

  return null
}

/**
 * Full-page loading overlay consolidated into the single heart-and-butterfly modal.
 */
export function LoadingOverlay({ message = 'Loading…', subtext = 'Please wait.' }) {
  return <LoadingSpinner message={message} subtext={subtext} />
}

/**
 * Consolidated into the single heart-and-butterfly modal.
 */
export function LoadingHeart({ message = 'Loading…', subtext = 'Please wait.' }) {
  return <LoadingSpinner message={message} subtext={subtext} />
}

/**
 * Consolidated skeleton loader into the single heart-and-butterfly modal.
 */
export function SkeletonLoader({ message = 'Loading…', subtext = 'Please wait.' }) {
  return <LoadingSpinner message={message} subtext={subtext} />
}

/**
 * Inline loader returning null to eliminate competing spinner designs in favor
 * of the single unified heart-and-butterfly modal.
 */
export function InlineLoader() {
  return null
}
