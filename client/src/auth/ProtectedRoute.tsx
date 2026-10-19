import { Navigate, Outlet, useLocation } from 'react-router';
import { PageSpinner } from '../components/ui/PageSpinner';
import type { Role } from '../types';
import { useAuth } from './AuthContext';
import { ROLE_HOME } from './roles';

/**
 * Renders child routes only for a logged-in user (and, if `roles` is given, one of those roles).
 * Others go to /login, or to their own role's home page.
 */
export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) return <PageSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={ROLE_HOME[user.role]} replace />;
  return <Outlet />;
}
