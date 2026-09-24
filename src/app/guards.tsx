import { Navigate, Outlet, useLocation } from 'react-router'

import { homePath, isAdminSession, isCashierSession, useSession } from '@/stores/session'

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
 * Admin-only area. Members and cashiers are sent to their own home.
 */
export function RequireAdmin() {
  const session = useSession()

  if (!isAdminSession(session)) {
    return <Navigate to={homePath(session)} replace />
  }

  return <Outlet />
}

/** Cashier Collect workspace. */
export function RequireCashier() {
  const session = useSession()

  if (!isCashierSession(session)) {
    return <Navigate to={homePath(session)} replace />
  }

  return <Outlet />
}
