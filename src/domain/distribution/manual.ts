import type {
  DistributionInput,
  DistributionResult,
  DistributionStrategy,
} from '@/domain/distribution/types'

/**
 * Per-round override. Changing one month does not rewrite the rest of the
 * schedule — the other months keep their auto-calculated amounts.
 */
export class ManualDistributionStrategy implements DistributionStrategy {
  readonly mode = 'manual' as const
  readonly label = 'Manual amount'
  readonly enabled = true

  preview(input: DistributionInput): DistributionResult {
    const payoutAmount = input.overrideAmount ?? input.grossPool
    const adjustment = payoutAmount - input.grossPool

    return {
      payoutAmount,
      adjustment,
      breakdown: [
        { label: 'Monthly pool', amount: input.grossPool },
        { label: 'Manual adjustment', amount: adjustment },
        { label: 'Payout to winner', amount: payoutAmount },
      ],
      autoCalculated: false,
    }
  }

  validate(input: DistributionInput) {
    const amount = input.overrideAmount
    if (amount === undefined) {
      return { ok: false as const, message: 'Enter the payout amount.' }
    }
    if (!Number.isInteger(amount) || amount < 0) {
      return { ok: false as const, message: 'Enter a valid amount.' }
    }
    return { ok: true as const }
  }
}
