import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'

import { LoadingState } from '@/components/EmptyState'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { CashierLayout } from '@/components/layout/CashierLayout'
import { MemberLayout } from '@/components/layout/MemberLayout'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { RequireAdmin, RequireCashier, RequireSession } from '@/app/guards'
import { LoginPage } from '@/features/auth/LoginPage'
import { NotFoundPage } from '@/features/misc/NotFoundPage'
import { RouteErrorBoundary } from '@/features/misc/RouteErrorBoundary'
import { features } from '@/config/features'

/*
 * Pages are code-split so a member on a phone downloads their one screen
 * rather than the whole admin workspace (charts, reports and backup tooling).
 * Login stays in the main bundle because it is always the first paint.
 */
const AdminDashboardPage = lazy(() =>
  import('@/features/dashboard/admin/AdminDashboardPage').then((m) => ({
    default: m.AdminDashboardPage,
  })),
)
const MemberHomePage = lazy(() =>
  import('@/features/dashboard/member/MemberHomePage').then((m) => ({
    default: m.MemberHomePage,
  })),
)
const MembersPage = lazy(() =>
  import('@/features/members/MembersPage').then((m) => ({ default: m.MembersPage })),
)
const MemberDetailPage = lazy(() =>
  import('@/features/members/MemberDetailPage').then((m) => ({ default: m.MemberDetailPage })),
)
const SchemesPage = lazy(() =>
  import('@/features/schemes/SchemesPage').then((m) => ({ default: m.SchemesPage })),
)
const SchemeFormPage = lazy(() =>
  import('@/features/schemes/SchemeFormPage').then((m) => ({ default: m.SchemeFormPage })),
)
const SchemeDetailPage = lazy(() =>
  import('@/features/schemes/SchemeDetailPage').then((m) => ({ default: m.SchemeDetailPage })),
)
const RoundDetailPage = lazy(() =>
  import('@/features/rounds/RoundDetailPage').then((m) => ({ default: m.RoundDetailPage })),
)
const ReportsPage = lazy(() =>
  import('@/features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })),
)
const RolesPage = lazy(() =>
  import('@/features/roles/RolesPage').then((m) => ({ default: m.RolesPage })),
)
const AuditPage = lazy(() =>
  import('@/features/audit/AuditPage').then((m) => ({ default: m.AuditPage })),
)
const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
const CashiersPage = lazy(() =>
  import('@/features/cashiers/CashiersPage').then((m) => ({ default: m.CashiersPage })),
)
const CallOverduePage = lazy(() =>
  import('@/features/dashboard/admin/CallOverduePage').then((m) => ({
    default: m.CallOverduePage,
  })),
)
const CashierCollectPage = lazy(() =>
  import('@/features/dashboard/cashier/CashierCollectPage').then((m) => ({
    default: m.CashierCollectPage,
  })),
)
const CashierPayoutsPage = lazy(() =>
  import('@/features/dashboard/cashier/CashierPayoutsPage').then((m) => ({
    default: m.CashierPayoutsPage,
  })),
)
const ContactPage = lazy(() =>
  import('@/features/site/ContactPage').then((m) => ({ default: m.ContactPage })),
)
const OrganizersPage = lazy(() =>
  import('@/features/site/OrganizersPage').then((m) => ({ default: m.OrganizersPage })),
)
const TermsPage = lazy(() =>
  import('@/features/site/TermsPage').then((m) => ({ default: m.TermsPage })),
)

/** Chunks load from the service worker cache offline, so this is brief. */
function page(element: ReactNode) {
  return <Suspense fallback={<LoadingState label="Loading…" />}>{element}</Suspense>
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    element: <PublicLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: '/contact', element: page(<ContactPage />) },
      { path: '/organizers', element: page(<OrganizersPage />) },
      { path: '/terms', element: page(<TermsPage />) },
    ],
  },
  {
    element: <RequireSession />,
    errorElement: <RouteErrorBoundary />,
    children: [
      // Member workspace: one page only.
      {
        element: <MemberLayout />,
        children: [{ path: '/me', element: page(<MemberHomePage />) }],
      },
      {
        element: <RequireCashier />,
        children: [
          {
            element: <CashierLayout />,
            children: [
              { path: '/collect', element: page(<CashierCollectPage />) },
              { path: '/collect/payouts', element: page(<CashierPayoutsPage />) },
            ],
          },
        ],
      },
      // Admin workspace.
      {
        element: <RequireAdmin />,
        children: [
          {
            element: <AdminLayout />,
            children: [
              { index: true, element: page(<AdminDashboardPage />) },
              { path: 'members', element: page(<MembersPage />) },
              { path: 'cashiers', element: page(<CashiersPage />) },
              { path: 'overdue', element: page(<CallOverduePage />) },
              { path: 'members/:personId', element: page(<MemberDetailPage />) },
              { path: 'schemes', element: page(<SchemesPage />) },
              { path: 'schemes/new', element: page(<SchemeFormPage />) },
              { path: 'schemes/:schemeId', element: page(<SchemeDetailPage />) },
              { path: 'schemes/:schemeId/edit', element: page(<SchemeFormPage />) },
              { path: 'schemes/:schemeId/rounds/:roundId', element: page(<RoundDetailPage />) },
              { path: 'reports', element: page(<ReportsPage />) },
              { path: 'roles', element: page(<RolesPage />) },
              ...(features.auditLog ? [{ path: 'audit', element: page(<AuditPage />) }] : []),
              { path: 'settings', element: page(<SettingsPage />) },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/login" replace /> },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
