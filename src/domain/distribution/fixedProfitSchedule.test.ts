import { describe, expect, it } from 'vitest'

import {
  buildFixedProfitSchedule,
  canBuildSchedule,
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

  it('pays the canonical fixture 72,000 first and 88,000 last', () => {
    const schedule = buildFixedProfitSchedule(canonical)
    expect(schedule.grossPool).toBe(fromRupees(80_000))
    expect(schedule.lines[0].plannedPayoutAmount).toBe(fromRupees(72_000))
    expect(schedule.lines[19].plannedPayoutAmount).toBe(fromRupees(88_000))
    expect(formatINR(schedule.lines[0].plannedPayoutAmount)).toBe('₹72,000')
    expect(formatINR(schedule.lines[19].plannedPayoutAmount)).toBe('₹88,000')
  })

  it('reaches about the pool in the middle month', () => {
    const schedule = buildFixedProfitSchedule(canonical)
    // Month 10 and 11 straddle the pool of 80,000.
    expect(schedule.lines[9].plannedPayoutAmount).toBeLessThanOrEqual(fromRupees(80_000))
    expect(schedule.lines[10].plannedPayoutAmount).toBeGreaterThanOrEqual(fromRupees(80_000))
    expect(Math.abs(schedule.lines[9].plannedPayoutAmount - fromRupees(80_000))).toBeLessThan(
      fromRupees(500),
    )
  })

  it('never invents money: total payout equals total collected', () => {
    const schedule = buildFixedProfitSchedule(canonical)
    const sum = schedule.lines.reduce((total, line) => total + line.plannedPayoutAmount, 0)
    expect(schedule.totalCollected).toBe(fromRupees(80_000) * 20)
    expect(sum).toBe(schedule.totalCollected)
    expect(schedule.totalPayout).toBe(schedule.totalCollected)
  })

  it('rises every month when profit is above zero', () => {
    const schedule = buildFixedProfitSchedule(canonical)
    for (let i = 1; i < schedule.lines.length; i += 1) {
      expect(schedule.lines[i].plannedPayoutAmount).toBeGreaterThan(
        schedule.lines[i - 1].plannedPayoutAmount,
      )
    }
  })

  it('is flat at zero profit', () => {
    const schedule = buildFixedProfitSchedule({ ...canonical, profitBps: 0 })
    for (const line of schedule.lines) {
      expect(line.plannedPayoutAmount).toBe(fromRupees(80_000))
      expect(line.adjustment).toBe(0)
    }
  })

  it('records adjustment as payout minus pool, negative early', () => {
    const schedule = buildFixedProfitSchedule(canonical)
    expect(schedule.lines[0].adjustment).toBe(fromRupees(-8000))
    expect(schedule.lines[19].adjustment).toBe(fromRupees(8000))
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
