import { LogOutIcon } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'

import { AdminBottomNav } from '@/components/layout/AdminBottomNav'
import { adminNavItems } from '@/components/layout/nav-items'
import { BrandLockup, LogoMark } from '@/components/brand/Logo'
import { OfflineBadge } from '@/components/OfflineBadge'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { useSessionStore } from '@/stores/session'
import { cn } from '@/lib/utils'

export function AdminLayout() {
  const signOut = useSessionStore((s) => s.signOut)

  return (
    <div className="bg-background min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="bg-sidebar text-sidebar-foreground fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r lg:flex">
        <div className="border-sidebar-border border-b px-5 py-4">
          <BrandLockup />
        </div>
        <nav aria-label="Main" className="flex-1 space-y-1 overflow-y-auto p-3">
          {adminNavItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent',
                )
              }
            >
              <Icon className="size-4.5 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-sidebar-border border-t p-3">
          <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
            <LogOutIcon className="size-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="bg-background/95 sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b px-4 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <LogoMark className="size-8 text-sm" />
          <span className="font-[family-name:var(--font-display)] font-bold">GouriNidhi</span>
        </div>
        <div className="flex items-center gap-1">
          <OfflineBadge />
          <ThemeToggle />
          <Button variant="ghost" size="icon-sm" aria-label="Sign out" onClick={signOut}>
            <LogOutIcon className="size-4" />
          </Button>
        </div>
      </header>

      {/* Desktop top bar */}
      <div className="hidden lg:block lg:pl-64">
        <header className="bg-background/95 sticky top-0 z-20 flex h-14 items-center justify-end gap-3 border-b px-6 backdrop-blur">
          <span className="text-muted-foreground mr-auto text-sm">Admin workspace</span>
          <OfflineBadge />
          <ThemeToggle />
        </header>
      </div>

      <main className="px-4 pt-6 pb-24 lg:pl-68 lg:pr-6 lg:pb-10">
        <div className="mx-auto w-full max-w-7xl">
          <Outlet />
        </div>
      </main>

      <AdminBottomNav />
    </div>
  )
}
