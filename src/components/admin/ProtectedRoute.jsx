import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getHomeForRole, isAdminPortalRole } from '../../utils/roleRoutes'

export default function ProtectedRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-loading__spinner" />
        <p>Loading...</p>
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
