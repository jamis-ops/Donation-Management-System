import { useEffect } from 'react'
import { useLoading } from '../../../context/LoadingContext'

function getDefaultLoadingMessage() {
  if (typeof window === 'undefined') return 'Loading…'
  const path = window.location.pathname.toLowerCase()
  if (path.includes('dashboard')) return 'Loading dashboard…'
  if (path.includes('inventory')) return 'Loading inventory…'
  if (path.includes('donation')) return 'Loading donations…'
  if (path.includes('request') || path.includes('assistance')) return 'Loading relief requests…'
  if (path.includes('volunteer') || path.includes('intern')) return 'Loading volunteers…'
  if (path.includes('beneficiar') || path.includes('barangay')) return 'Loading barangays…'
  if (path.includes('distribution')) return 'Loading distribution data…'
  if (path.includes('allocation')) return 'Loading allocations…'
  if (path.includes('report')) return 'Loading reports…'
  if (path.includes('donor')) return 'Loading donors…'
  if (path.includes('task')) return 'Loading tasks…'
  if (path.includes('certificate')) return 'Loading certificates…'
  if (path.includes('staff')) return 'Loading staff…'
  if (path.includes('admin')) return 'Loading administrators…'
  if (path.includes('content')) return 'Loading content…'
  return 'Loading…'
}

export default function ApiState({
  loading,
  error,
  onRetry,
  message,
  subtext = 'Please wait.',
  children,
}) {
  const { showLoading, hideLoading } = useLoading()

  useEffect(() => {
    if (loading) {
      const activeMessage = message || getDefaultLoadingMessage()
      showLoading({ message: activeMessage, subtext })
      return () => {
        hideLoading()
      }
    }
  }, [loading, showLoading, hideLoading, message, subtext])

  if (loading) {
    return <div style={{ minHeight: '200px' }} />
  }

  if (error) {
    return (
      <div className="admin-alert admin-alert--warning">
        <strong>Could not load data:</strong> {error}
        {onRetry && (
          <button type="button" className="btn btn--sm btn--outline" style={{ marginLeft: '1rem' }} onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    )
  }

  return children
}
