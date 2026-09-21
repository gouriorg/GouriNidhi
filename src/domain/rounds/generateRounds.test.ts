import { describe, expect, it } from 'vitest'

import { buildFixedProfitSchedule } from '@/domain/distribution/fixedProfitSchedule'
import { fromRupees } from '@/domain/money/money'
import { generateRoundsForScheme } from '@/domain/rounds/generateRounds'
import type { Scheme } from '@/types/entities'

function makeScheme(overrides: Partial<Scheme> = {}): Scheme {
  const base = {
    maxMembers: 20,
    monthlyAmount: fromRupees(4000),
    durationMonths: 20,
    startDate: '2026-01-01',
    collectionDay: 1,
    profitBps: 1000,
  }

  return {
    id: 'scheme-1',
    code: 'GN-001',
    name: 'Test scheme',
    ...base,
    distributionMode: 'fixed_profit',
    scheduleSnapshot: buildFixedProfitSchedule(base).lines,
    status: 'draft',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('generateRoundsForScheme', () => {
  it('creates one round per month of the scheme', () => {
    const rounds = generateRoundsForScheme(makeScheme())

    expect(rounds).toHaveLength(20)
    expect(rounds.map((round) => round.monthNumber)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    )
  })

  it('sets expected collection to the full planned pool, not the current roster', () => {
    const rounds = generateRoundsForScheme(makeScheme())

    // 20 members x Rs 4,000 = Rs 80,000 every month.
    for (const round of rounds) {
      expect(round.expectedCollection).toBe(fromRupees(80_000))
    }
  })

  it('starts every round with nothing collected and nothing owed', () => {
    const rounds = generateRoundsForScheme(makeScheme())

    for (const round of rounds) {
      expect(round.status).toBe('upcoming')
      expect(round.actualCollection).toBe(0)
      // Obligations only exist once collection opens.
      expect(round.pendingAmount).toBe(0)
    }
  })

  it('copies the planned payout from the saved schedule', () => {
    const scheme = makeScheme()
    const rounds = generateRoundsForScheme(scheme)

    expect(rounds[0].plannedPayoutAmount).toBe(scheme.scheduleSnapshot![0].plannedPayoutAmount)
    expect(rounds[19].plannedPayoutAmount).toBe(scheme.scheduleSnapshot![19].plannedPayoutAmount)
    // Early months pay less than the pool, later months pay more.
    expect(rounds[0].plannedPayoutAmount).toBeLessThan(rounds[0].expectedCollection)
    expect(rounds[19].plannedPayoutAmount).toBeGreaterThan(rounds[19].expectedCollection)
  })

  it('rebuilds the schedule when a scheme has no snapshot', () => {
    const rounds = generateRoundsForScheme(makeScheme({ scheduleSnapshot: undefined }))

    expect(rounds).toHaveLength(20)
    expect(rounds[0].plannedPayoutAmount).toBe(fromRupees(72_000))
  })

  it('pays out exactly what it collects across the whole scheme', () => {
    const rounds = generateRoundsForScheme(makeScheme())

    const collected = rounds.reduce((sum, round) => sum + round.expectedCollection, 0)
    const paidOut = rounds.reduce((sum, round) => sum + round.plannedPayoutAmount, 0)

    expect(paidOut).toBe(collected)
  })
})
