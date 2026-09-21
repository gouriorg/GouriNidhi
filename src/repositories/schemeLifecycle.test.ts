import { describe, expect, it } from 'vitest'

import { buildFixedProfitSchedule } from '@/domain/distribution/fixedProfitSchedule'
import { fromRupees } from '@/domain/money/money'
import { generateRoundsForScheme } from '@/domain/rounds/generateRounds'
import { deriveStatus } from '@/repositories/paymentsRepository'
import { canTransition, summarisePayments } from '@/repositories/roundsRepository'
import type { Payment, Scheme } from '@/types/entities'

const FIXTURE = {
  maxMembers: 20,
  monthlyAmount: fromRupees(4000),
  durationMonths: 20,
  startDate: '2026-01-01',
  collectionDay: 1,
  profitBps: 1000,
}

function sampleScheme(): Scheme {
  const schedule = buildFixedProfitSchedule(FIXTURE)
  return {
    id: '00000000-0000-4000-8000-000000000001',
    code: 'GN-TEST',
    name: 'Test chit',
    monthlyAmount: FIXTURE.monthlyAmount,
    maxMembers: FIXTURE.maxMembers,
    durationMonths: FIXTURE.durationMonths,
    startDate: FIXTURE.startDate,
    collectionDay: FIXTURE.collectionDay,
    profitBps: FIXTURE.profitBps,
    distributionMode: 'fixed_profit',
    scheduleSnapshot: schedule.lines,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('scheme schedule', () => {
  it('generates one round per month when the scheme is activated', () => {
    const rounds = generateRoundsForScheme(sampleScheme())
    expect(rounds).toHaveLength(20)
    expect(rounds[0].status).toBe('upcoming')
    expect(rounds[0].dueDate).toBe('2026-01-01')
    expect(rounds[19].dueDate).toBe('2027-08-01')
  })

  it('pays out exactly what the scheme collects over its full term', () => {
    const rounds = generateRoundsForScheme(sampleScheme())
    const totalIn = rounds.reduce((sum, round) => sum + round.expectedCollection, 0)
    const totalOut = rounds.reduce((sum, round) => sum + round.plannedPayoutAmount, 0)
    expect(totalIn).toBe(fromRupees(16_00_000))
    expect(totalOut).toBe(totalIn)
  })

  it('rebuilds the schedule when profit bps changes', () => {
    const first = buildFixedProfitSchedule(FIXTURE)
    expect(first.lines[0].plannedPayoutAmount).toBe(fromRupees(72_000))
    const wider = buildFixedProfitSchedule({ ...FIXTURE, profitBps: 2000 })
    expect(wider.lines[0].plannedPayoutAmount).toBeLessThan(fromRupees(72_000))
    expect(wider.lines).toHaveLength(20)
  })
})

describe('collection totals', () => {
  it('derives payment status from amounts', () => {
    expect(deriveStatus(400000, 0)).toBe('pending')
    expect(deriveStatus(400000, 150000)).toBe('partially_paid')
    expect(deriveStatus(400000, 400000)).toBe('paid')
  })

  it('leaves waived contributions out of the collected total', () => {
    const payments = [
      { status: 'paid', amountDue: 400000, amountPaid: 400000 },
      { status: 'waived', amountDue: 400000, amountPaid: 0 },
      { status: 'pending', amountDue: 400000, amountPaid: 0 },
    ] as Payment[]
    expect(summarisePayments(payments)).toEqual({
      collected: 400000,
      pending: 400000,
      waived: 400000,
    })
  })

  it('only allows legal round status transitions', () => {
    expect(canTransition('upcoming', 'collection_open')).toBe(true)
    expect(canTransition('upcoming', 'closed')).toBe(false)
    expect(canTransition('closed', 'upcoming')).toBe(false)
  })
})
