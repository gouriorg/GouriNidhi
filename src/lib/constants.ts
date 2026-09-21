import type {
  DistributionMode,
  PaymentMethod,
  PaymentStatus,
  PayoutStatus,
  PersonStatus,
  RoundStatus,
  SchemeStatus,
} from '@/types/entities'

export const APP_NAME = 'GouriNidhi'
export const APP_TAGLINE = 'Chit Fund Management Made Simple'
export const DB_NAME = 'GouriNidhi'
export const SCHEMA_VERSION = 1

export const personStatusLabels: Record<PersonStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
}

export const schemeStatusLabels: Record<SchemeStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const roundStatusLabels: Record<RoundStatus, string> = {
  upcoming: 'Upcoming',
  collection_open: 'Collection open',
  collection_complete: 'Collection complete',
  payout_pending: 'Payout pending',
  payout_complete: 'Payout complete',
  closed: 'Closed',
}

export const roundStatusOrder: RoundStatus[] = [
  'upcoming',
  'collection_open',
  'collection_complete',
  'payout_pending',
  'payout_complete',
  'closed',
]

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  pending: 'Pending',
  partially_paid: 'Partially paid',
  paid: 'Paid',
  waived: 'Waived',
}

export const payoutStatusLabels: Record<PayoutStatus, string> = {
  pending: 'Pending',
  paid: 'Paid',
}

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank transfer',
  other: 'Other',
}

export const distributionModeLabels: Record<DistributionMode, string> = {
  fixed_profit: 'Fixed profit (auto schedule)',
  manual: 'Manual amounts',
  auction: 'Auction (coming later)',
  custom: 'Custom formula (coming later)',
}

/** Derived display status: payments become Overdue past their due date. */
export const OVERDUE_LABEL = 'Overdue'
