import LoadingSpinner from '../../shared/LoadingSpinner'

export default function ApiState({ loading, error, onRetry, children }) {
  if (loading) {
    return (
      <div style={{ minHeight: '200px' }}>
        <LoadingSpinner variant="card" message="Loading data from database..." />
      </div>
    )
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
