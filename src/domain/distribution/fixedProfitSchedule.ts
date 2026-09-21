import { dueDateForMonth } from '@/lib/dates'
import { assertPaise, type Paise } from '@/domain/money/money'
import type { DateOnly, ScheduleLine } from '@/types/entities'

export type ScheduleInput = {
  /** Planned headcount, not the current assigned roster. */
  maxMembers: number
  /** Everyone contributes this same amount every month. */
  monthlyAmount: Paise
  durationMonths: number
  startDate: DateOnly
  /** Day of month 1–28 the contribution is due. */
  collectionDay: number
  /** Profit spread in basis points. 10% === 1000. */
  profitBps: number
}

export type Schedule = {
  lines: ScheduleLine[]
  /** maxMembers × monthlyAmount — collected every month. */
  grossPool: Paise
  /** grossPool × durationMonths — total money in, and total money out. */
  totalCollected: Paise
  totalPayout: Paise
}

/**
 * Rotating chit schedule: one winner per month.
 *
 * Whoever withdraws earliest receives the least; the last month receives the
 * most. Month 1 pays `pool × (1 − profit)`, the final month pays
 * `pool × (1 + profit)`, and the months in between rise linearly. The average
 * stays exactly at the pool, so total money out equals total money in — no
 * cash is invented. The final month absorbs any rounding residue.
 */
export function buildFixedProfitSchedule(input: ScheduleInput): Schedule {
  const { maxMembers, monthlyAmount, durationMonths, startDate, collectionDay, profitBps } = input

  if (!Number.isInteger(maxMembers) || maxMembers < 1) {
    throw new Error('maxMembers must be a positive whole number')
  }
  if (!Number.isInteger(durationMonths) || durationMonths < 1) {
    throw new Error('durationMonths must be a positive whole number')
  }
  if (!Number.isInteger(profitBps) || profitBps < 0) {
    throw new Error('profitBps must be a non-negative whole number')
  }
  assertPaise(monthlyAmount, 'monthlyAmount')

  const grossPool = monthlyAmount * maxMembers
  assertPaise(grossPool, 'grossPool')

  const totalCollected = grossPool * durationMonths
  assertPaise(totalCollected, 'totalCollected')

  // Linear ramp from pool×(1−p) up to pool×(1+p).
  const spread = Math.round((grossPool * profitBps) / 10_000)
  const first = grossPool - spread
  const last = grossPool + spread
  const step = durationMonths > 1 ? (last - first) / (durationMonths - 1) : 0

  const lines: ScheduleLine[] = []
  let runningTotal = 0

  for (let index = 0; index < durationMonths; index += 1) {
    const monthNumber = index + 1
    const isFinal = monthNumber === durationMonths

    // The last month is the balancing figure so the schedule sums exactly.
    const rawAmount = durationMonths === 1 ? grossPool : Math.round(first + step * index)
    const plannedPayoutAmount = isFinal ? totalCollected - runningTotal : rawAmount

    assertPaise(plannedPayoutAmount, `payout for month ${monthNumber}`)
    runningTotal += plannedPayoutAmount

    lines.push({
      monthNumber,
      dueDate: dueDateForMonth(startDate, index, collectionDay),
      grossPool,
      plannedPayoutAmount,
      adjustment: plannedPayoutAmount - grossPool,
    })
  }

  return {
    lines,
    grossPool,
    totalCollected,
    totalPayout: runningTotal,
  }
}

/** True when the inputs are complete enough to render a live preview. */
export function canBuildSchedule(input: Partial<ScheduleInput>): input is ScheduleInput {
  return (
    Number.isInteger(input.maxMembers) &&
    (input.maxMembers ?? 0) >= 1 &&
    Number.isInteger(input.monthlyAmount) &&
    (input.monthlyAmount ?? 0) > 0 &&
    Number.isInteger(input.durationMonths) &&
    (input.durationMonths ?? 0) >= 1 &&
    typeof input.startDate === 'string' &&
    input.startDate.length === 10 &&
    Number.isInteger(input.collectionDay) &&
    Number.isInteger(input.profitBps) &&
    (input.profitBps ?? -1) >= 0
  )
}
