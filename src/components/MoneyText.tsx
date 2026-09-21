import { formatINR, type Paise } from '@/domain/money/money'
import { cn } from '@/lib/utils'

/**
 * Every rupee amount on screen goes through this component so figures always
 * use tabular numerals and en-IN grouping.
 */
export function MoneyText({
  amount,
  precise = false,
  signed = false,
  className,
  colored = false,
}: {
  amount: Paise
  precise?: boolean
  /** Show an explicit + for positive values (payout adjustments). */
  signed?: boolean
  colored?: boolean
  className?: string
}) {
  const formatted = formatINR(Math.abs(amount), { precise })
  const sign = amount < 0 ? '−' : signed && amount > 0 ? '+' : ''

  return (
    <span
      className={cn(
        'tabular',
        colored && amount < 0 && 'text-destructive',
        colored && amount > 0 && 'text-success',
        className,
      )}
    >
      {sign}
      {formatted}
    </span>
  )
}
