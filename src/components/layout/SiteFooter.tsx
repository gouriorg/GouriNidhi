import { NavLink } from 'react-router'

import { siteLinks } from '@/content/sitePages'
import { cn } from '@/lib/utils'

/**
 * Fixed bottom chrome, same idea as the admin left panel:
 * always on screen, not scrolled away with the page.
 */
export function SiteFooter({
  className,
  offset = 'default',
}: {
  className?: string
  /** Admin phones already have a bottom nav, so this bar sits above it. */
  offset?: 'default' | 'admin'
}) {
  return (
    <footer
      className={cn(
        'bg-sidebar/95 text-sidebar-foreground fixed inset-x-0 z-30 border-t backdrop-blur',
        offset === 'admin' ? 'bottom-14 lg:right-0 lg:bottom-0 lg:left-64' : 'bottom-0',
        className,
      )}
      style={{
        paddingBottom: offset === 'admin' ? undefined : 'env(safe-area-inset-bottom)',
      }}
    >
      <nav
        aria-label="Site"
        className="mx-auto flex h-12 max-w-7xl items-center justify-center gap-6 px-4 lg:justify-start lg:px-6"
      >
        {siteLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              cn(
                'text-xs font-medium underline-offset-4 transition-colors hover:text-foreground hover:underline',
                isActive ? 'text-foreground' : 'text-muted-foreground',
              )
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </footer>
  )
}
