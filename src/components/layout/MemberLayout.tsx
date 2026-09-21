import { LogOutIcon } from 'lucide-react'
import { Outlet } from 'react-router'

import { BrandLockup } from '@/components/brand/Logo'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { OfflineBadge } from '@/components/OfflineBadge'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { useSessionStore } from '@/stores/session'

/** Members get one page. No admin sidebar, no bottom tabs. */
export function MemberLayout() {
  const signOut = useSessionStore((s) => s.signOut)

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
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-6 pb-24">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}
