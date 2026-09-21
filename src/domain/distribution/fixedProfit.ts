import { buildFixedProfitSchedule } from '@/domain/distribution/fixedProfitSchedule'
import type {
  DistributionInput,
  DistributionResult,
  DistributionStrategy,
} from '@/domain/distribution/types'

/**
 * Default strategy. Reuses the exact same schedule builder the create screen
 * shows, so the previewed amount and the recorded payout can never disagree.
 */
export class FixedProfitDistributionStrategy implements DistributionStrategy {
  readonly mode = 'fixed_profit' as const
  readonly label = 'Fixed profit (auto schedule)'
  readonly enabled = true

  preview(input: DistributionInput): DistributionResult {
    const monthlyAmount = Math.round(input.grossPool / input.memberCount)
    const schedule = buildFixedProfitSchedule({
      maxMembers: input.memberCount,
      monthlyAmount,
      durationMonths: input.durationMonths,
      startDate: '2000-01-01', // dates are irrelevant for a single-month preview
      collectionDay: 1,
      profitBps: input.profitBps,
    })

    const line = schedule.lines[input.monthNumber - 1]
    if (!line) {
      throw new Error(`Month ${input.monthNumber} is outside this scheme's duration`)
    }

    return {
      payoutAmount: line.plannedPayoutAmount,
      adjustment: line.adjustment,
      breakdown: [
        { label: 'Monthly pool', amount: line.grossPool },
        { label: line.adjustment < 0 ? 'Early withdrawal discount' : 'Late withdrawal bonus', amount: line.adjustment },
        { label: 'Payout to winner', amount: line.plannedPayoutAmount },
      ],
      autoCalculated: true,
    }
  }

  validate(input: DistributionInput) {
    if (input.monthNumber < 1 || input.monthNumber > input.durationMonths) {
      return { ok: false as const, message: 'Month is outside the scheme duration.' }
    }
    return { ok: true as const }
  }
}
