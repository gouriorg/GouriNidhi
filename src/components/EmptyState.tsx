import { AlertTriangleIcon, InboxIcon, Loader2Icon, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function EmptyState({
  icon: Icon = InboxIcon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'border-border/70 flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-14 text-center',
        className,
      )}
    >
      <span className="bg-muted text-muted-foreground mb-4 grid size-12 place-items-center rounded-full">
        <Icon className="size-5" />
      </span>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && (
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="text-muted-foreground flex items-center justify-center gap-2 py-14 text-sm"
    >
      <Loader2Icon className="size-4 animate-spin" />
      {label}
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  action,
}: {
  title?: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="border-destructive/30 bg-destructive/5 flex flex-col items-center justify-center rounded-xl border px-6 py-12 text-center">
      <span className="bg-destructive/12 text-destructive mb-4 grid size-12 place-items-center rounded-full">
        <AlertTriangleIcon className="size-5" />
      </span>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="text-muted-foreground mt-1 max-w-sm text-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
