import { LogOutIcon } from 'lucide-react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  isAdminSession,
  isCashierSession,
  useSession,
  useSessionStore,
  type Session,
} from '@/stores/session'

function roleLabel(session: Session): string {
  if (isAdminSession(session)) return 'Admin'
  if (isCashierSession(session)) return 'Cashier'
  return 'Member'
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function InitialsMark({
  name,
  mobile,
  role,
  to,
}: {
  name: string
  mobile?: string
  role: string
  to?: string
}) {
  const detail = `${name}${mobile ? ` · ${mobile}` : ''} · ${role}`
  const markClass =
    'bg-sidebar-accent grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold'
  const mark = to ? (
    <Link to={to} className={`${markClass} hover:bg-sidebar-accent/80`} aria-label={`My account, ${detail}`}>
      {initials(name)}
    </Link>
  ) : (
    <div className={markClass} aria-label={detail}>
      {initials(name)}
    </div>
  )
  return (
    <Tooltip>
      <TooltipTrigger asChild>{mark}</TooltipTrigger>
      <TooltipContent side="right">{detail}</TooltipContent>
    </Tooltip>
  )
}

export function SessionAccountBar({
  collapsed = false,
  sidebar = false,
  className,
}: {
  collapsed?: boolean
  sidebar?: boolean
  className?: string
}) {
  const session = useSession()
  const signOut = useSessionStore((s) => s.signOut)
  const name = session?.kind === 'member' ? session.fullName : 'Signed in'
  const mobile = session?.kind === 'member' ? session.mobile : undefined
  const role = roleLabel(session)
  const myAccountTo = session?.kind === 'member' ? '/me' : undefined

  if (collapsed) {
    return (
      <div className={cn('flex flex-col items-center gap-2 p-2', className)}>
        <InitialsMark name={name} mobile={mobile} role={role} to={myAccountTo} />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Sign out" onClick={signOut}>
              <LogOutIcon className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Sign out</TooltipContent>
        </Tooltip>
      </div>
    )
  }

  if (sidebar) {
    return (
      <div className={cn('flex items-center justify-between gap-3', className)}>
        <InitialsMark name={name} mobile={mobile} role={role} to={myAccountTo} />
        <Button variant="ghost" size="sm" className="shrink-0" onClick={signOut}>
          <LogOutIcon className="size-4" />
          Sign out
        </Button>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="text-muted-foreground truncate text-xs">
          {mobile ? <span className="tabular">{mobile}</span> : null}
          {mobile ? ' · ' : null}
          {role}
        </p>
      </div>
      <Button variant="ghost" size="sm" className="shrink-0" onClick={signOut}>
        <LogOutIcon className="size-4" />
        Sign out
      </Button>
    </div>
  )
}
