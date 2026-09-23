import { LayoutDashboardIcon, MenuIcon, UsersIcon, WalletIcon } from 'lucide-react'
import { useState } from 'react'
import { NavLink, useLocation } from 'react-router'

import { adminMoreNavItems } from '@/components/layout/nav-items'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const primaryTabs = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboardIcon, end: true },
  { to: '/members', label: 'Members', icon: UsersIcon },
  { to: '/schemes', label: 'Schemes', icon: WalletIcon },
]

/** Thumb-reach navigation for phones. */
export function AdminBottomNav({ pinned = true }: { pinned?: boolean }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const { pathname } = useLocation()
  const moreActive = adminMoreNavItems.some((item) => pathname.startsWith(item.to))

  return (
    <nav
      aria-label="Primary"
      className={cn(
        'bg-background/95 border-t backdrop-blur lg:hidden',
        pinned && 'fixed inset-x-0 bottom-0 z-40',
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-4">
        {primaryTabs.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )
            }
          >
            <Icon className="size-5" />
            {label}
          </NavLink>
        ))}

        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger
            className={cn(
              'flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
              moreActive ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <MenuIcon className="size-5" />
            More
          </SheetTrigger>
          <SheetContent side="bottom" className="pb-8">
            <SheetHeader>
              <SheetTitle>More</SheetTitle>
            </SheetHeader>
            <div className="grid gap-1 px-4 pb-2">
              {adminMoreNavItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-muted',
                    )
                  }
                >
                  <Icon className="size-4.5" />
                  {label}
                </NavLink>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  )
}
