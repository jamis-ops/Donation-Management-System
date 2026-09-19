import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getHomeForRole, isAdminPortalRole } from '../../utils/roleRoutes'
import LoadingSpinner from '../../components/shared/LoadingSpinner'

export default function ProtectedRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <LoadingSpinner message="Verifying authentication…" />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (user?.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  if (!isAdminPortalRole(user?.role)) {
    return <Navigate to={getHomeForRole(user?.role)} replace />
  }

  return children
}
