export default function ApiState({ loading, error, onRetry, children }) {
  if (loading) {
    return (
      <div className="admin-loading" style={{ minHeight: '200px' }}>
        <div className="admin-loading__spinner" />
        <p>Loading data from database...</p>
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
