import { PanelLeftCloseIcon, PanelLeftOpenIcon } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router'

import { AdminBottomNav } from '@/components/layout/AdminBottomNav'
import { SessionAccountBar } from '@/components/layout/SessionAccountBar'
import { MenuSearchButton, MenuSearchProvider } from '@/components/layout/MenuSearch'
import {
  adminMenuCommands,
  adminMyAccountItem,
  adminNavItems,
  type NavItem,
} from '@/components/layout/nav-items'
import { PageChromeProvider, usePageChrome } from '@/components/layout/page-chrome'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { BrandLockup, LogoMark } from '@/components/brand/Logo'
import { OfflineBadge } from '@/components/OfflineBadge'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSessionStore } from '@/stores/session'
import { cn } from '@/lib/utils'

const SIDEBAR_KEY = 'gouri-admin-sidebar-collapsed'
const HEADER_BAR = 'flex h-16 shrink-0 items-center border-b'

function readSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1'
  } catch {
    return false
  }
}

export function AdminLayout() {
  const session = useSessionStore((s) => s.session)
  const showMyAccount = session?.kind === 'member'
  const navItems = showMyAccount ? [...adminNavItems, adminMyAccountItem] : adminNavItems
  const menuCommands = showMyAccount
    ? adminMenuCommands
    : adminMenuCommands.filter((command) => command.to !== '/me')
  const [collapsed, setCollapsed] = useState(readSidebarCollapsed)

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0')
      } catch {
        /* ignore quota / private mode */
      }
      return next
    })
  }

  return (
    <PageChromeProvider>
      <MenuSearchProvider commands={menuCommands}>
        <div className="bg-background flex h-dvh flex-col">
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <aside
              className={cn(
                'bg-sidebar text-sidebar-foreground hidden shrink-0 flex-col border-r transition-[width] duration-200 lg:flex',
                collapsed ? 'w-20' : 'w-64',
              )}
            >
              <div
                className={cn(
                  HEADER_BAR,
                  'border-sidebar-border px-3',
                  collapsed ? 'justify-center' : 'gap-1',
                )}
              >
                {collapsed ? (
                  <LogoMark />
                ) : (
                  <>
                    <BrandLockup className="min-w-0 flex-1" />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Collapse sidebar"
                      onClick={toggleSidebar}
                    >
                      <PanelLeftCloseIcon className="size-4" />
                    </Button>
                  </>
                )}
              </div>
              <nav aria-label="Main" className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
                {navItems.map(({ to, label, icon: Icon, end }) => (
                  <SidebarLink
                    key={to}
                    to={to}
                    end={end}
                    label={label}
                    collapsed={collapsed}
                    icon={Icon}
                  />
                ))}
              </nav>
            </aside>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <AdminTopBar collapsed={collapsed} onExpandSidebar={toggleSidebar} />

              <main className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">
                  <Outlet />
                </div>
              </main>

              <div className="bg-sidebar flex h-14 items-center border-t px-4 lg:hidden">
                <SessionAccountBar className="w-full" />
              </div>
              <div className="lg:hidden">
                <SiteFooter pinned={false} />
              </div>
              <AdminBottomNav pinned={false} showMyAccount={showMyAccount} />
            </div>
          </div>

          <div className="border-sidebar-border hidden min-h-14 shrink-0 border-t lg:flex">
            <div
              className={cn(
                'bg-sidebar text-sidebar-foreground flex items-center border-r px-3',
                collapsed ? 'w-20 py-2' : 'w-64',
              )}
            >
              <SessionAccountBar sidebar collapsed={collapsed} className="w-full" />
            </div>
            <SiteFooter pinned={false} className="min-h-0 flex-1 border-t-0" />
          </div>
        </div>
      </MenuSearchProvider>
    </PageChromeProvider>
  )
}

function AdminTopBar({
  collapsed,
  onExpandSidebar,
}: {
  collapsed: boolean
  onExpandSidebar: () => void
}) {
  const chrome = usePageChrome()

  return (
    <>
      <header className="bg-background flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4 lg:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <LogoMark className="size-8 shrink-0 text-sm" />
          <div className="min-w-0">
            <p className="truncate font-[family-name:var(--font-display)] text-sm font-bold">
              {chrome.title ?? 'GouriNidhi'}
            </p>
            {chrome.description && (
              <p className="text-muted-foreground truncate text-[11px]">{chrome.description}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <MenuSearchButton />
          <OfflineBadge />
          <ThemeToggle />
        </div>
      </header>

      <header className={cn(HEADER_BAR, 'bg-background hidden gap-4 px-6 lg:flex')}>
        {collapsed && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="-ml-1"
            aria-label="Expand sidebar"
            onClick={onExpandSidebar}
          >
            <PanelLeftOpenIcon className="size-4" />
          </Button>
        )}
        <div className="min-w-0 flex-1 leading-tight">
          <h1 className="truncate text-base font-bold">{chrome.title ?? 'Admin workspace'}</h1>
          {chrome.description && (
            <p className="text-muted-foreground truncate text-xs">{chrome.description}</p>
          )}
        </div>
        {chrome.actions && (
          <div className="flex shrink-0 flex-nowrap items-center justify-end gap-2">{chrome.actions}</div>
        )}
        <div className="flex shrink-0 items-center gap-2">
          <MenuSearchButton />
          <OfflineBadge />
          <ThemeToggle />
        </div>
      </header>

      {chrome.actions && (
        <div className="bg-background flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2 lg:hidden">
          {chrome.actions}
        </div>
      )}
    </>
  )
}

function SidebarLink({
  to,
  end,
  label,
  collapsed,
  icon: Icon,
}: {
  to: string
  end?: boolean
  label: string
  collapsed: boolean
  icon: NavItem['icon']
}) {
  const link = (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex min-h-11 items-center rounded-lg text-sm font-medium transition-colors',
          collapsed ? 'w-full justify-center' : 'gap-3 px-3',
          isActive
            ? 'bg-sidebar-primary text-sidebar-primary-foreground'
            : 'text-sidebar-foreground hover:bg-sidebar-accent',
        )
      }
    >
      <Icon className="size-4.5 shrink-0" />
      {collapsed ? <span className="sr-only">{label}</span> : label}
    </NavLink>
  )

  if (!collapsed) return link

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex w-full">{link}</span>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}
