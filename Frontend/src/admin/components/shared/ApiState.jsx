import { useEffect } from 'react'
import { useLoading } from '../../../context/LoadingContext'

export default function ApiState({ loading, error, onRetry, children }) {
  const { showLoading, hideLoading } = useLoading()

  useEffect(() => {
    if (loading) {
      showLoading('Loading data from database…')
      return () => {
        hideLoading()
      }
    }
  }, [loading, showLoading, hideLoading])

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
