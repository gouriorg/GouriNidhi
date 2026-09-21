import { AlertTriangleIcon, InfoIcon, ShieldAlertIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type CalloutTone = 'info' | 'warning' | 'danger'

const toneStyles: Record<CalloutTone, string> = {
  info: 'border-primary/30 bg-primary/5 text-foreground',
  warning: 'border-warning/40 bg-warning/10 text-foreground',
  danger: 'border-destructive/40 bg-destructive/10 text-foreground',
}

const toneIconStyles: Record<CalloutTone, string> = {
  info: 'text-primary',
  warning: 'text-warning',
  danger: 'text-destructive',
}

const toneIcons: Record<CalloutTone, typeof InfoIcon> = {
  info: InfoIcon,
  warning: AlertTriangleIcon,
  danger: ShieldAlertIcon,
}

/**
 * Inline notice for rules the admin needs to know before acting — funding
 * shortfalls, locked fields, security caveats.
 */
export function Callout({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: CalloutTone
  title?: string
  children: ReactNode
  className?: string
}) {
  const Icon = toneIcons[tone]

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border px-4 py-3 text-sm',
        toneStyles[tone],
        className,
      )}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', toneIconStyles[tone])} aria-hidden />
      <div className="min-w-0 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        <div className="text-muted-foreground leading-relaxed [&_strong]:text-foreground">
          {children}
        </div>
      </div>
    </div>
  )
}
