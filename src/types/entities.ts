import type { Paise } from '@/domain/money/money'

/** ISO-8601 timestamp string. */
export type Timestamp = string
/** Calendar date as `yyyy-MM-dd`, timezone-free by design (Asia/Kolkata local). */
export type DateOnly = string

export type PersonStatus = 'active' | 'inactive'
export type PersonRole = 'member' | 'cashier' | 'admin'

/**
 * Every person record is a Member. A person can also be a cashier and/or admin.
 * `mobile` is the MVP username and password. At least one person must stay admin.
 */
export type Person = {
  id: string
  fullName: string
  mobile: string
  address?: string
  notes?: string
  status: PersonStatus
  /** Supabase Auth user id. Set when the member login is created. */
  authUserId?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type SchemeStatus = 'draft' | 'active' | 'completed' | 'cancelled'
export type DistributionMode = 'fixed_profit' | 'manual' | 'auction' | 'custom'

/** One line of the auto-calculated rotating payout schedule. */
export type ScheduleLine = {
  monthNumber: number
  dueDate: DateOnly
  grossPool: Paise
  plannedPayoutAmount: Paise
  /** plannedPayoutAmount − grossPool. Negative early, positive late. */
  adjustment: Paise
}

export type Scheme = {
  id: string
  code: string
  name: string
  description?: string
  monthlyAmount: Paise
  maxMembers: number
  durationMonths: number
  startDate: DateOnly
  /** Day of month 1–28 when contributions are due. */
  collectionDay: number
  /** Profit percentage in basis points. 10% === 1000. */
  profitBps: number
  distributionMode: DistributionMode
  /** Frozen copy of the schedule taken when the scheme was saved. */
  scheduleSnapshot?: ScheduleLine[]
  status: SchemeStatus
  notes?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type SchemeMemberStatus = 'active' | 'inactive'

export type SchemeMember = {
  id: string
  schemeId: string
  personId: string
  memberNumber: number
  status: SchemeMemberStatus
  joinedAt: DateOnly
  collectorPersonId?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type RoundStatus =
  | 'upcoming'
  | 'collection_open'
  | 'collection_complete'
  | 'payout_pending'
  | 'payout_complete'
  | 'closed'

export type Round = {
  id: string
  schemeId: string
  monthNumber: number
  dueDate: DateOnly
  /** monthlyAmount × maxMembers. */
  expectedCollection: Paise
  actualCollection: Paise
  pendingAmount: Paise
  /** Auto-calculated winner payout for this month. */
  plannedPayoutAmount: Paise
  recipientPersonId?: string
  status: RoundStatus
  notes?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type PaymentStatus = 'pending' | 'partially_paid' | 'paid' | 'waived'
export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'other'

export type Payment = {
  id: string
  schemeId: string
  roundId: string
  personId: string
  amountDue: Paise
  amountPaid: Paise
  paidDate?: DateOnly
  method?: PaymentMethod
  reference?: string
  status: PaymentStatus
  notes?: string
  recordedByPersonId?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type PayoutStatus = 'pending' | 'paid'

export type Payout = {
  id: string
  schemeId: string
  roundId: string
  personId: string
  grossPool: Paise
  /** payoutAmount − grossPool. */
  adjustment: Paise
  payoutAmount: Paise
  /** False when an admin overrode the scheduled amount. */
  autoCalculated: boolean
  paidDate?: DateOnly
  method?: PaymentMethod
  reference?: string
  status: PayoutStatus
  notes?: string
  recordedByPersonId?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type AuditEntityType =
  | 'person'
  | 'scheme'
  | 'schemeMember'
  | 'round'
  | 'payment'
  | 'payout'
  | 'settings'
  | 'backup'

export type AuditLog = {
  id: string
  action: string
  entityType: AuditEntityType
  entityId: string
  summary: string
  beforeJson?: string
  afterJson?: string
  /** Null for the hardcoded admin; set for member-initiated changes. */
  actorPersonId?: string
  actorLabel: string
  createdAt: Timestamp
}

export type SettingRecord = {
  key: string
  value: unknown
  updatedAt: Timestamp
}
