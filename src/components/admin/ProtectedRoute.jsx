import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getHomeForRole, isAdminPortalRole } from '../../utils/roleRoutes'
import LoadingSpinner from '../shared/LoadingSpinner'

export default function ProtectedRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="admin-loading">
        <LoadingSpinner size="large" message="Verifying authentication..." />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }

  if (user?.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  if (!isAdminPortalRole(user?.role)) {
    return <Navigate to={getHomeForRole(user?.role)} replace />
  }

  return children
}
