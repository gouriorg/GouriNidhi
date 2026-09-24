import { BanknoteIcon, UserIcon, WalletIcon } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'

import { BrandLockup } from '@/components/brand/Logo'
import { SessionAccountBar } from '@/components/layout/SessionAccountBar'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { OfflineBadge } from '@/components/OfflineBadge'
import { ThemeToggle } from '@/components/ThemeToggle'
import { membershipsRepository } from '@/repositories/membershipsRepository'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { isCashierSession, useSession } from '@/stores/session'
import { cn } from '@/lib/utils'

export function CashierLayout() {
  const session = useSession()
  const personId = session?.kind === 'member' ? session.personId : undefined
  const memberships = useLiveQuery(
    () => (personId ? membershipsRepository.listForPerson(personId) : Promise.resolve([])),
    [personId],
  )
  const showMyAccount = (memberships?.length ?? 0) > 0

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <header className="bg-background/95 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4">
          <BrandLockup />
          <div className="flex items-center gap-1">
            <OfflineBadge />
            <ThemeToggle />
          </div>
        </div>
        {isCashierSession(session) && (
          <nav
            aria-label="Cashier"
            className="mx-auto flex h-12 w-full max-w-5xl items-center gap-1 px-4"
          >
            <CashierNavLink to="/collect" end icon={WalletIcon} label="Members" />
            <CashierNavLink to="/collect/payouts" icon={BanknoteIcon} label="Handover" />
            {showMyAccount && <CashierNavLink to="/me" icon={UserIcon} label="My account" />}
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24">
        <Outlet />
      </main>
      <div className="bg-sidebar mx-auto w-full max-w-5xl border-t px-4 py-2">
        <SessionAccountBar />
      </div>
      <SiteFooter />
    </div>
  )
}

function CashierNavLink({
  to,
  end,
  label,
  icon: Icon,
}: {
  to: string
  end?: boolean
  label: string
  icon: typeof WalletIcon
}) {
  return (
    <NavLink
      to={to}
      end={end}
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
