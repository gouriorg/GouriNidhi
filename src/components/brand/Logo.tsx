import { cn } from '@/lib/utils'

/** GouriNidhi mark. Change the brand look here only. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'bg-primary text-primary-foreground grid size-9 shrink-0 place-items-center rounded-lg font-[family-name:var(--font-display)] text-base font-bold',
        className,
      )}
    >
      GN
    </span>
  )
}

export function BrandLockup({
  className,
  showSubtitle = true,
}: {
  className?: string
  showSubtitle?: boolean
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <LogoMark />
      <div className="min-w-0 leading-tight">
        <div className="font-[family-name:var(--font-display)] text-base font-bold tracking-tight">
          GouriNidhi
        </div>
        {showSubtitle && (
          <div className="text-muted-foreground truncate text-xs">
            Chit Fund Management Made Simple
          </div>
        )}
      </div>
    </div>
  )
}
