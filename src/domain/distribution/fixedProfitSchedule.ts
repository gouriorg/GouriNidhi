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
 * All amounts come from the scheme inputs (members, monthly contribution,
 * duration, profit %). Nothing is looked up from a printed table. Get Amount
 * is rounded to a step derived from the monthly pool. When profit is above
 * zero each month pays more than the previous, one month equals the pool, and
 * the other months are adjusted so the term pays out exactly what was collected.
 * Create and edit both call this builder, so new schemes get the same chart.
 */
/** Rounding step from the monthly pool: 1–2–5 rupees at about 0.5% of the pool. */
export function chartRoundUnit(grossPool: Paise): Paise {
  assertPaise(grossPool, 'grossPool')
  const poolRupees = grossPool / 100
  const raw = Math.max(poolRupees * 0.005, 1)
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const mantissa = raw / magnitude
  const nice = mantissa >= 5 ? 5 : mantissa >= 2 ? 2 : 1
  const unit = nice * magnitude * 100
  assertPaise(unit, 'chartRoundUnit')
  return unit
}

export function roundToChartUnit(amount: Paise, unit: Paise): Paise {
  assertPaise(amount)
  assertPaise(unit, 'round unit')
  if (unit <= 0) throw new Error('round unit must be positive')
  return Math.round(amount / unit) * unit
}

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

  const spread = Math.round((grossPool * profitBps) / 10_000)
  const payouts = buildChartPayouts({
    durationMonths,
    grossPool,
    first: grossPool - spread,
    last: grossPool + spread,
    totalCollected,
    profitBps,
  })

  const lines: ScheduleLine[] = []
  let runningTotal = 0

  for (let index = 0; index < durationMonths; index += 1) {
    const plannedPayoutAmount = payouts[index]
    assertPaise(plannedPayoutAmount, `payout for month ${index + 1}`)
    runningTotal += plannedPayoutAmount

    lines.push({
      monthNumber: index + 1,
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

function buildChartPayouts(input: {
  durationMonths: number
  grossPool: Paise
  first: Paise
  last: Paise
  totalCollected: Paise
  profitBps: number
}): Paise[] {
  const { durationMonths: months, grossPool, first, last, totalCollected, profitBps } = input

  if (months === 1 || profitBps === 0) {
    return Array.from({ length: months }, () => grossPool)
  }

  const unit = chartRoundUnit(grossPool)
  const firstRounded = roundToChartUnit(first, unit)
  const lastRounded = roundToChartUnit(last, unit)
  const step = (lastRounded - firstRounded) / (months - 1)
  const amounts = Array.from({ length: months }, (_, index) =>
    roundToChartUnit(Math.round(firstRounded + step * index), unit),
  )

  const poolMonth = poolMonthIndex(months, firstRounded, lastRounded, grossPool)
  amounts[poolMonth] = grossPool

  for (let index = poolMonth - 1; index >= 0; index -= 1) {
    amounts[index] = Math.min(amounts[index], amounts[index + 1] - unit)
  }
  for (let index = poolMonth + 1; index < months; index += 1) {
    amounts[index] = Math.max(amounts[index], amounts[index - 1] + unit)
  }

  fillToTotal(amounts, totalCollected, unit, poolMonth)

  const leftover = totalCollected - sumPaise(amounts)
  if (leftover !== 0) amounts[months - 1] += leftover

  return amounts
}

function sumPaise(amounts: Paise[]): Paise {
  return amounts.reduce((total, amount) => total + amount, 0)
}

/** Month where the linear ramp crosses the pool — never the first or last when there is room. */
function poolMonthIndex(months: number, first: Paise, last: Paise, pool: Paise): number {
  if (months <= 2) return 0
  if (last === first) return Math.floor((months - 1) / 2)
  const ratio = (pool - first) / (last - first)
  const index = Math.round(ratio * (months - 1))
  return Math.min(months - 2, Math.max(1, index))
}

function fillToTotal(amounts: Paise[], total: Paise, unit: Paise, poolMonth: number): void {
  const last = amounts.length - 1

  const raiseSuffix = (from: number) => {
    for (let index = from; index <= last; index += 1) amounts[index] += unit
  }

  const lowerPrefix = (through: number) => {
    for (let index = 0; index <= through; index += 1) amounts[index] -= unit
  }

  for (let step = 0; step < 20_000; step += 1) {
    const diff = total - sumPaise(amounts)
    if (Math.abs(diff) < unit) return

    if (diff > 0) {
      const needed = Math.floor(diff / unit)
      let raised = false
      for (let width = Math.min(needed, last - poolMonth); width >= 1; width -= 1) {
        const from = last - width + 1
        if (from > poolMonth) {
          raiseSuffix(from)
          raised = true
          break
        }
      }
      if (!raised) amounts[last] += unit
      continue
    }

    const excess = Math.floor(-diff / unit)
    let lowered = false
    for (let width = Math.min(excess, poolMonth); width >= 1; width -= 1) {
      if (amounts[0] - unit > 0 && amounts[width - 1] - unit < amounts[width]) {
        lowerPrefix(width - 1)
        lowered = true
        break
      }
    }
    if (!lowered) return
  }
}

/**
 * Profit % implied by a printed chart: half the gap between first and last
 * payout, as a share of the monthly pool. Matches the linear ramp used for
 * new schemes (first = pool − spread, last = pool + spread).
 */
export function profitBpsFromChart(grossPool: Paise, firstPayout: Paise, lastPayout: Paise): number {
  if (!Number.isInteger(grossPool) || grossPool <= 0) return 0
  const spread = (lastPayout - firstPayout) / 2
  return Math.max(0, Math.round((spread / grossPool) * 10_000))
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
