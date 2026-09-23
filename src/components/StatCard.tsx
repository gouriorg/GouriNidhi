import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
  className,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: LucideIcon
  tone?: 'default' | 'success' | 'warning' | 'destructive'
  className?: string
}) {
  const toneClass = {
    default: 'bg-primary/10 text-primary',
    success: 'bg-success/12 text-success',
    warning: 'bg-warning/18 text-warning',
    destructive: 'bg-destructive/12 text-destructive',
  }[tone]

  return (
    <Card className={cn('gap-3 p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-muted-foreground text-sm font-medium">{label}</span>
        {Icon && (
          <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', toneClass)}>
            <Icon className="size-4.5" />
          </span>
        )}
      </div>
      <div className="tabular font-[family-name:var(--font-display)] text-2xl font-bold break-words">
        {value}
      </div>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </Card>
  )
}
