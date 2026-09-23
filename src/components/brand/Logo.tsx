import { useLayoutEffect, useRef, useState } from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const BRAND_SUBTITLE = 'Chit Fund Management Made Simple'

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
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <LogoMark />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate font-[family-name:var(--font-display)] text-sm font-bold tracking-tight">
          GouriNidhi
        </div>
        {showSubtitle && (
          <TruncatingText
            text={BRAND_SUBTITLE}
            className="text-muted-foreground text-[10px] leading-tight"
          />
        )}
      </div>
    </div>
  )
}

function TruncatingText({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [overflowed, setOverflowed] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const measure = () => setOverflowed(el.scrollWidth > el.clientWidth + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [text])

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <p ref={ref} className={cn('truncate', className)}>
          {text}
        </p>
      </TooltipTrigger>
      {overflowed ? (
        <TooltipContent side="bottom" align="start">
          {text}
        </TooltipContent>
      ) : null}
    </Tooltip>
  )
}
