import { BanknoteIcon, LogOutIcon, UserIcon, WalletIcon } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'

import { BrandLockup } from '@/components/brand/Logo'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { OfflineBadge } from '@/components/OfflineBadge'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { isCashierSession, useSession, useSessionStore } from '@/stores/session'
import { cn } from '@/lib/utils'

/** Members get one page. Cashiers who are also members keep Collect in the header. */
export function MemberLayout() {
  const session = useSession()
  const signOut = useSessionStore((s) => s.signOut)
  const cashier = isCashierSession(session)

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <header className="bg-background/95 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4">
          <BrandLockup />
          <div className="flex items-center gap-1">
            <OfflineBadge />
            <ThemeToggle />
            <Button variant="ghost" size="icon-sm" aria-label="Sign out" onClick={signOut}>
              <LogOutIcon className="size-4" />
            </Button>
          </div>
        </div>
        {cashier && (
          <nav
            aria-label="Cashier"
            className="mx-auto flex h-12 w-full max-w-5xl items-center gap-1 px-4"
          >
            <MemberNavLink to="/collect" icon={WalletIcon} label="Collect" />
            <MemberNavLink to="/collect/payouts" icon={BanknoteIcon} label="Handover" />
            <MemberNavLink to="/me" icon={UserIcon} label="My account" />
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}

function MemberNavLink({
  to,
  label,
  icon: Icon,
}: {
  to: string
  label: string
  icon: typeof WalletIcon
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )
      }
    >
      <Icon className="size-4" />
      {label}
    </NavLink>
  )
}
