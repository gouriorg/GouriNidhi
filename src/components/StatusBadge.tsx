import { Badge } from '@/components/ui/badge'
import {
  paymentStatusLabels,
  payoutStatusLabels,
  personStatusLabels,
  roundStatusLabels,
  schemeStatusLabels,
} from '@/lib/constants'
import type {
  PaymentStatus,
  PayoutStatus,
  PersonStatus,
  RoundStatus,
  SchemeStatus,
} from '@/types/entities'

type Variant = 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'outline' | 'muted'

const personVariants: Record<PersonStatus, Variant> = {
  active: 'success',
  inactive: 'muted',
}

const schemeVariants: Record<SchemeStatus, Variant> = {
  draft: 'warning',
  active: 'success',
  completed: 'secondary',
  cancelled: 'muted',
}

const roundVariants: Record<RoundStatus, Variant> = {
  upcoming: 'muted',
  collection_open: 'warning',
  collection_complete: 'default',
  payout_pending: 'warning',
  payout_complete: 'success',
  closed: 'secondary',
}

const paymentVariants: Record<PaymentStatus | 'overdue', Variant> = {
  pending: 'muted',
  partially_paid: 'warning',
  paid: 'success',
  waived: 'secondary',
  overdue: 'destructive',
}

const payoutVariants: Record<PayoutStatus, Variant> = {
  pending: 'warning',
  paid: 'success',
}

export function PersonStatusBadge({ status }: { status: PersonStatus }) {
  return <Badge variant={personVariants[status]}>{personStatusLabels[status]}</Badge>
}

export function SchemeStatusBadge({ status }: { status: SchemeStatus }) {
  return <Badge variant={schemeVariants[status]}>{schemeStatusLabels[status]}</Badge>
}

export function RoundStatusBadge({ status }: { status: RoundStatus }) {
  return <Badge variant={roundVariants[status]}>{roundStatusLabels[status]}</Badge>
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus | 'overdue' }) {
  const label = status === 'overdue' ? 'Overdue' : paymentStatusLabels[status]
  return <Badge variant={paymentVariants[status]}>{label}</Badge>
}

export function PayoutStatusBadge({ status }: { status: PayoutStatus }) {
  return <Badge variant={payoutVariants[status]}>{payoutStatusLabels[status]}</Badge>
}
