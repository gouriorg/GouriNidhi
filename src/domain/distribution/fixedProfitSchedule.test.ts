import { describe, expect, it } from 'vitest'

import {
  buildFixedProfitSchedule,
  canBuildSchedule,
  chartRoundUnit,
  type ScheduleInput,
} from '@/domain/distribution/fixedProfitSchedule'
import { formatINR, fromRupees } from '@/domain/money/money'

/** The canonical fixture: 20 members × ₹4,000 × 20 months at 10% profit. */
const canonical: ScheduleInput = {
  maxMembers: 20,
  monthlyAmount: fromRupees(4000),
  durationMonths: 20,
  startDate: '2026-01-01',
  collectionDay: 1,
  profitBps: 1000,
}

describe('buildFixedProfitSchedule', () => {
  it('produces one line per month', () => {
    const schedule = buildFixedProfitSchedule(canonical)
    expect(schedule.lines).toHaveLength(20)
    expect(schedule.lines[0].monthNumber).toBe(1)
    expect(schedule.lines[19].monthNumber).toBe(20)
  })

  it('pays less than the pool first and more than the pool last', () => {
    const schedule = buildFixedProfitSchedule(canonical)
    expect(schedule.grossPool).toBe(canonical.monthlyAmount * canonical.maxMembers)
    expect(schedule.lines[0].plannedPayoutAmount).toBeLessThan(schedule.grossPool)
    expect(schedule.lines[schedule.lines.length - 1].plannedPayoutAmount).toBeGreaterThan(
      schedule.grossPool,
    )
    expect(formatINR(schedule.lines[0].plannedPayoutAmount).startsWith('₹')).toBe(true)
  })

  it('hits the monthly pool exactly once, then pays more the next month', () => {
    const schedule = buildFixedProfitSchedule(canonical)
    const poolMonths = schedule.lines.filter((line) => line.plannedPayoutAmount === schedule.grossPool)
    expect(poolMonths).toHaveLength(1)
    const index = schedule.lines.findIndex((line) => line.plannedPayoutAmount === schedule.grossPool)
    expect(index).toBeGreaterThanOrEqual(0)
    expect(index).toBeLessThan(schedule.lines.length - 1)
    expect(schedule.lines[index + 1].plannedPayoutAmount).toBeGreaterThan(schedule.grossPool)
  })

  it('never invents money: total payout equals total collected', () => {
    const schedule = buildFixedProfitSchedule(canonical)
    const sum = schedule.lines.reduce((total, line) => total + line.plannedPayoutAmount, 0)
    expect(schedule.totalCollected).toBe(schedule.grossPool * canonical.durationMonths)
    expect(sum).toBe(schedule.totalCollected)
    expect(schedule.totalPayout).toBe(schedule.totalCollected)
  })

  it('rounds Get Amount to the pool-derived step and rises every month', () => {
    const schedule = buildFixedProfitSchedule(canonical)
    const unit = chartRoundUnit(schedule.grossPool)
    for (const line of schedule.lines.slice(0, -1)) {
      expect(line.plannedPayoutAmount % unit).toBe(0)
    }
    for (let i = 1; i < schedule.lines.length; i += 1) {
      expect(schedule.lines[i].plannedPayoutAmount).toBeGreaterThan(
        schedule.lines[i - 1].plannedPayoutAmount,
      )
    }
  })

  it('is flat at zero profit', () => {
    const schedule = buildFixedProfitSchedule({ ...canonical, profitBps: 0 })
    for (const line of schedule.lines) {
      expect(line.plannedPayoutAmount).toBe(schedule.grossPool)
      expect(line.adjustment).toBe(0)
    }
  })

  it('records adjustment as payout minus pool, negative early', () => {
    const schedule = buildFixedProfitSchedule(canonical)
    expect(schedule.lines[0].adjustment).toBeLessThan(0)
    expect(schedule.lines[19].adjustment).toBeGreaterThan(0)
    const adjustmentSum = schedule.lines.reduce((total, line) => total + line.adjustment, 0)
    expect(adjustmentSum).toBe(0)
  })

  it('keeps every payout an integer number of paise', () => {
    // 7 members × ₹3,333.33 × 9 months at 7.5% is deliberately awkward.
    const schedule = buildFixedProfitSchedule({
      maxMembers: 7,
      monthlyAmount: fromRupees(3333.33),
      durationMonths: 9,
      startDate: '2026-03-15',
      collectionDay: 15,
      profitBps: 750,
    })
    for (const line of schedule.lines) {
      expect(Number.isInteger(line.plannedPayoutAmount)).toBe(true)
      expect(Number.isInteger(line.adjustment)).toBe(true)
    }
    const sum = schedule.lines.reduce((total, line) => total + line.plannedPayoutAmount, 0)
    expect(sum).toBe(schedule.totalCollected)
  })

  it('walks due dates forward month by month on the collection day', () => {
    const schedule = buildFixedProfitSchedule({ ...canonical, startDate: '2026-01-10', collectionDay: 10 })
    expect(schedule.lines[0].dueDate).toBe('2026-01-10')
    expect(schedule.lines[1].dueDate).toBe('2026-02-10')
    expect(schedule.lines[11].dueDate).toBe('2026-12-10')
    expect(schedule.lines[12].dueDate).toBe('2027-01-10')
  })

  it('handles a single-month scheme', () => {
    const schedule = buildFixedProfitSchedule({ ...canonical, durationMonths: 1 })
    expect(schedule.lines).toHaveLength(1)
    expect(schedule.lines[0].plannedPayoutAmount).toBe(schedule.grossPool)
  })

  it('rejects invalid inputs', () => {
    expect(() => buildFixedProfitSchedule({ ...canonical, maxMembers: 0 })).toThrow()
    expect(() => buildFixedProfitSchedule({ ...canonical, durationMonths: 0 })).toThrow()
    expect(() => buildFixedProfitSchedule({ ...canonical, profitBps: -1 })).toThrow()
    expect(() => buildFixedProfitSchedule({ ...canonical, monthlyAmount: 100.5 })).toThrow()
  })
})

describe('canBuildSchedule', () => {
  it('accepts a complete input', () => {
    expect(canBuildSchedule(canonical)).toBe(true)
  })

  it('rejects incomplete input', () => {
    expect(canBuildSchedule({})).toBe(false)
    expect(canBuildSchedule({ ...canonical, monthlyAmount: 0 })).toBe(false)
    expect(canBuildSchedule({ ...canonical, startDate: '' })).toBe(false)
  })
})
