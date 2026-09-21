import { Link, Outlet } from 'react-router'

import { BrandLockup } from '@/components/brand/Logo'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { useSession } from '@/stores/session'

/** Public pages (contact, organizers, terms) — available without signing in. */
export function PublicLayout() {
  const session = useSession()
  const home = session?.kind === 'member' ? '/me' : session?.kind === 'admin' ? '/' : '/login'

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <header className="bg-background/95 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between gap-3 px-4">
          <Link to={home} className="min-w-0">
            <BrandLockup showSubtitle={false} />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="outline" size="sm">
              <Link to={home}>{session ? 'Home' : 'Sign in'}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 pb-24">
        <Outlet />
      </main>

      <SiteFooter />
    </div>
  )
}
