import { BanknoteIcon, LogOutIcon, UserIcon, WalletIcon } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'

import { BrandLockup } from '@/components/brand/Logo'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { OfflineBadge } from '@/components/OfflineBadge'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { membershipsRepository } from '@/repositories/membershipsRepository'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { isCashierSession, useSession, useSessionStore } from '@/stores/session'
import { cn } from '@/lib/utils'

export function CashierLayout() {
  const session = useSession()
  const signOut = useSessionStore((s) => s.signOut)
  const personId = session?.kind === 'member' ? session.personId : undefined
  const memberships = useLiveQuery(
    () => (personId ? membershipsRepository.listForPerson(personId) : Promise.resolve([])),
    [personId],
  )
  const showMyAccount = (memberships?.length ?? 0) > 0

  return (
    <div className="bg-background min-h-dvh">
      <header className="bg-background/95 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between gap-3 px-4">
          <BrandLockup showSubtitle={false} />
          <div className="flex items-center gap-1">
            <OfflineBadge />
            <ThemeToggle />
            <Button variant="ghost" size="icon-sm" aria-label="Sign out" onClick={signOut}>
              <LogOutIcon className="size-4" />
            </Button>
          </div>
        </div>
        {isCashierSession(session) && (
          <nav aria-label="Cashier" className="mx-auto flex h-11 max-w-3xl items-center gap-4 px-4">
            <NavLink
              to="/collect"
              end
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-1.5 text-sm font-medium',
                  isActive ? 'text-foreground' : 'text-muted-foreground',
                )
              }
            >
              <WalletIcon className="size-4" />
              Members
            </NavLink>
            <NavLink
              to="/collect/payouts"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-1.5 text-sm font-medium',
                  isActive ? 'text-foreground' : 'text-muted-foreground',
                )
              }
            >
              <BanknoteIcon className="size-4" />
              Handover
            </NavLink>
            {showMyAccount && (
              <NavLink
                to="/me"
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-1.5 text-sm font-medium',
                    isActive ? 'text-foreground' : 'text-muted-foreground',
                  )
                }
              >
                <UserIcon className="size-4" />
                My account
              </NavLink>
            )}
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-6 pb-24">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}
