import { Navigate, Outlet, useLocation } from 'react-router'

import { useSession } from '@/stores/session'

/** Unauthenticated visitors go to the login screen. */
export function RequireSession() {
  const session = useSession()
  const location = useLocation()

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

/**
 * Admin-only area. A member session can never reach Members, Schemes, Reports,
 * Roles, Audit, Backup — it is sent back to its own home.
 */
export function RequireAdmin() {
  const session = useSession()

  if (session?.kind !== 'admin') {
    return <Navigate to="/me" replace />
  }

  return <Outlet />
}
