import {
  NotImplementedError,
  type DistributionInput,
  type DistributionResult,
  type DistributionStrategy,
} from '@/domain/distribution/types'

/**
 * Future home of real chit auctions: members bid a discount, the lowest bid
 * wins, the foreman takes a commission and the remainder is a dividend shared
 * by everyone else. Out of scope for the MVP — swapping it in later means
 * implementing this class, not rewriting the payout screens.
 */
export class AuctionDistributionStrategy implements DistributionStrategy {
  readonly mode = 'auction' as const
  readonly label = 'Auction (coming later)'
  readonly enabled = false

  preview(_input: DistributionInput): DistributionResult {
    throw new NotImplementedError('Auction distribution')
  }

  validate(_input: DistributionInput) {
    return { ok: false as const, message: 'Auction distribution is not available yet.' }
  }
}
