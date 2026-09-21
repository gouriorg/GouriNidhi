import {
  NotImplementedError,
  type DistributionInput,
  type DistributionResult,
  type DistributionStrategy,
} from '@/domain/distribution/types'

/** Placeholder for a future admin-authored formula. */
export class CustomDistributionStrategy implements DistributionStrategy {
  readonly mode = 'custom' as const
  readonly label = 'Custom formula (coming later)'
  readonly enabled = false

  preview(_input: DistributionInput): DistributionResult {
    throw new NotImplementedError('Custom distribution')
  }

  validate(_input: DistributionInput) {
    return { ok: false as const, message: 'Custom distribution is not available yet.' }
  }
}
