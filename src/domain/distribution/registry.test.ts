import { describe, expect, it } from 'vitest'

import {
  DEFAULT_DISTRIBUTION_MODE,
  getDistributionStrategy,
  listDistributionStrategies,
} from '@/domain/distribution/registry'
import { NotImplementedError, type DistributionInput } from '@/domain/distribution/types'
import { fromRupees } from '@/domain/money/money'

const input: DistributionInput = {
  grossPool: fromRupees(80_000),
  profitBps: 1000,
  memberCount: 20,
  durationMonths: 20,
  monthNumber: 1,
}

describe('distribution registry', () => {
  it('defaults to fixed profit', () => {
    expect(DEFAULT_DISTRIBUTION_MODE).toBe('fixed_profit')
    expect(getDistributionStrategy('fixed_profit').enabled).toBe(true)
  })

  it('falls back to fixed profit for an unknown mode', () => {
    expect(getDistributionStrategy('nonsense' as never).mode).toBe('fixed_profit')
  })

  it('previews the same amounts as the schedule builder', () => {
    const strategy = getDistributionStrategy('fixed_profit')
    expect(strategy.preview(input).payoutAmount).toBe(fromRupees(72_000))
    expect(strategy.preview({ ...input, monthNumber: 20 }).payoutAmount).toBe(fromRupees(88_000))
    expect(strategy.preview(input).autoCalculated).toBe(true)
  })

  it('rejects a month outside the duration', () => {
    const strategy = getDistributionStrategy('fixed_profit')
    expect(strategy.validate({ ...input, monthNumber: 21 }).ok).toBe(false)
  })

  it('uses the override amount in manual mode without touching other months', () => {
    const strategy = getDistributionStrategy('manual')
    const result = strategy.preview({ ...input, overrideAmount: fromRupees(75_000) })
    expect(result.payoutAmount).toBe(fromRupees(75_000))
    expect(result.adjustment).toBe(fromRupees(-5000))
    expect(result.autoCalculated).toBe(false)

    // The fixed-profit schedule for other months is unchanged.
    const fixed = getDistributionStrategy('fixed_profit')
    expect(fixed.preview({ ...input, monthNumber: 20 }).payoutAmount).toBe(fromRupees(88_000))
  })

  it('requires an amount in manual mode', () => {
    expect(getDistributionStrategy('manual').validate(input).ok).toBe(false)
  })

  it('keeps auction and custom as disabled stubs', () => {
    for (const mode of ['auction', 'custom'] as const) {
      const strategy = getDistributionStrategy(mode)
      expect(strategy.enabled).toBe(false)
      expect(() => strategy.preview(input)).toThrow(NotImplementedError)
      expect(strategy.validate(input).ok).toBe(false)
    }
  })

  it('lists every registered strategy', () => {
    expect(listDistributionStrategies().map((s) => s.mode)).toEqual([
      'fixed_profit',
      'manual',
      'auction',
      'custom',
    ])
  })
})
