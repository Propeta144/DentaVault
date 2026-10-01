import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import PageLoader from './PageLoader'

export const CHANGE_PASSWORD_PATH = '/change-password'

export default function ProtectedRoute({ allowedRoles }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <PageLoader fullScreen />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Temporary password pa (galing sa dentist): kailangang palitan muna bago
  // makapunta kahit saan. Hinaharang din ito ng server (403), kaya hindi
  // ito malalampasan kahit baguhin ang client.
  if (user.mustChangePassword && location.pathname !== CHANGE_PASSWORD_PATH) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
