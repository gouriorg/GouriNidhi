import { AuctionDistributionStrategy } from '@/domain/distribution/auction'
import { CustomDistributionStrategy } from '@/domain/distribution/custom'
import { FixedProfitDistributionStrategy } from '@/domain/distribution/fixedProfit'
import { ManualDistributionStrategy } from '@/domain/distribution/manual'
import type { DistributionStrategy } from '@/domain/distribution/types'
import type { DistributionMode } from '@/types/entities'

const strategies: Record<DistributionMode, DistributionStrategy> = {
  fixed_profit: new FixedProfitDistributionStrategy(),
  manual: new ManualDistributionStrategy(),
  auction: new AuctionDistributionStrategy(),
  custom: new CustomDistributionStrategy(),
}

export const DEFAULT_DISTRIBUTION_MODE: DistributionMode = 'fixed_profit'

export function getDistributionStrategy(mode: DistributionMode): DistributionStrategy {
  return strategies[mode] ?? strategies[DEFAULT_DISTRIBUTION_MODE]
}

export function listDistributionStrategies(): DistributionStrategy[] {
  return Object.values(strategies)
}
