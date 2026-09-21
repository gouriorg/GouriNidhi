import type { Paise } from '@/domain/money/money'
import type { DistributionMode } from '@/types/entities'

export type DistributionInput = {
  grossPool: Paise
  profitBps: number
  memberCount: number
  durationMonths: number
  monthNumber: number
  /** Present only when an admin overrides the scheduled amount. */
  overrideAmount?: Paise
}

export type DistributionResult = {
  payoutAmount: Paise
  /** payoutAmount − grossPool. Negative means an early, smaller withdrawal. */
  adjustment: Paise
  breakdown: { label: string; amount: Paise }[]
  autoCalculated: boolean
}

export interface DistributionStrategy {
  readonly mode: DistributionMode
  readonly label: string
  readonly enabled: boolean
  preview(input: DistributionInput): DistributionResult
  validate(input: DistributionInput): { ok: true } | { ok: false; message: string }
}

export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`${what} is not available yet in GouriNidhi.`)
    this.name = 'NotImplementedError'
  }
}
