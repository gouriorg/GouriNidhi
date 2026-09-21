import { RepositoryError } from '@/repositories/errors'
import type {
  AuditLog,
  Payment,
  Payout,
  Person,
  Round,
  Scheme,
  SchemeMember,
  SettingRecord,
} from '@/types/entities'

type Row = Record<string, unknown>

function str(row: Row, key: string): string {
  return String(row[key] ?? '')
}

function optStr(row: Row, key: string): string | undefined {
  const value = row[key]
  if (value === null || value === undefined || value === '') return undefined
  return String(value)
}

function num(row: Row, key: string): number {
  return Number(row[key] ?? 0)
}

export function mapPerson(row: Row): Person {
  return {
    id: str(row, 'id'),
    fullName: str(row, 'full_name'),
    mobile: str(row, 'mobile'),
    address: optStr(row, 'address'),
    notes: optStr(row, 'notes'),
    status: str(row, 'status') as Person['status'],
    authUserId: optStr(row, 'auth_user_id'),
    createdAt: str(row, 'created_at'),
    updatedAt: str(row, 'updated_at'),
  }
}

export function personToRow(person: Person) {
  return {
    id: person.id,
    full_name: person.fullName,
    mobile: person.mobile,
    address: person.address ?? null,
    notes: person.notes ?? null,
    status: person.status,
    auth_user_id: person.authUserId ?? null,
    created_at: person.createdAt,
    updated_at: person.updatedAt,
  }
}

export function mapScheme(row: Row): Scheme {
  return {
    id: str(row, 'id'),
    code: str(row, 'code'),
    name: str(row, 'name'),
    description: optStr(row, 'description'),
    monthlyAmount: num(row, 'monthly_amount'),
    maxMembers: num(row, 'max_members'),
    durationMonths: num(row, 'duration_months'),
    startDate: str(row, 'start_date'),
    collectionDay: num(row, 'collection_day'),
    profitBps: num(row, 'profit_bps'),
    distributionMode: str(row, 'distribution_mode') as Scheme['distributionMode'],
    scheduleSnapshot: (row.schedule_snapshot as Scheme['scheduleSnapshot']) ?? undefined,
    status: str(row, 'status') as Scheme['status'],
    notes: optStr(row, 'notes'),
    createdAt: str(row, 'created_at'),
    updatedAt: str(row, 'updated_at'),
  }
}

export function schemeToRow(scheme: Scheme) {
  return {
    id: scheme.id,
    code: scheme.code,
    name: scheme.name,
    description: scheme.description ?? null,
    monthly_amount: scheme.monthlyAmount,
    max_members: scheme.maxMembers,
    duration_months: scheme.durationMonths,
    start_date: scheme.startDate,
    collection_day: scheme.collectionDay,
    profit_bps: scheme.profitBps,
    distribution_mode: scheme.distributionMode,
    schedule_snapshot: scheme.scheduleSnapshot ?? null,
    status: scheme.status,
    notes: scheme.notes ?? null,
    created_at: scheme.createdAt,
    updated_at: scheme.updatedAt,
  }
}

export function mapMembership(row: Row): SchemeMember {
  return {
    id: str(row, 'id'),
    schemeId: str(row, 'scheme_id'),
    personId: str(row, 'person_id'),
    memberNumber: num(row, 'member_number'),
    status: str(row, 'status') as SchemeMember['status'],
    joinedAt: str(row, 'joined_at'),
    createdAt: str(row, 'created_at'),
    updatedAt: str(row, 'updated_at'),
  }
}

export function membershipToRow(row: SchemeMember) {
  return {
    id: row.id,
    scheme_id: row.schemeId,
    person_id: row.personId,
    member_number: row.memberNumber,
    status: row.status,
    joined_at: row.joinedAt,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

export function mapRound(row: Row): Round {
  return {
    id: str(row, 'id'),
    schemeId: str(row, 'scheme_id'),
    monthNumber: num(row, 'month_number'),
    dueDate: str(row, 'due_date'),
    expectedCollection: num(row, 'expected_collection'),
    actualCollection: num(row, 'actual_collection'),
    pendingAmount: num(row, 'pending_amount'),
    plannedPayoutAmount: num(row, 'planned_payout_amount'),
    recipientPersonId: optStr(row, 'recipient_person_id'),
    status: str(row, 'status') as Round['status'],
    notes: optStr(row, 'notes'),
    createdAt: str(row, 'created_at'),
    updatedAt: str(row, 'updated_at'),
  }
}

export function roundToRow(round: Round) {
  return {
    id: round.id,
    scheme_id: round.schemeId,
    month_number: round.monthNumber,
    due_date: round.dueDate,
    expected_collection: round.expectedCollection,
    actual_collection: round.actualCollection,
    pending_amount: round.pendingAmount,
    planned_payout_amount: round.plannedPayoutAmount,
    recipient_person_id: round.recipientPersonId ?? null,
    status: round.status,
    notes: round.notes ?? null,
    created_at: round.createdAt,
    updated_at: round.updatedAt,
  }
}

export function mapPayment(row: Row): Payment {
  return {
    id: str(row, 'id'),
    schemeId: str(row, 'scheme_id'),
    roundId: str(row, 'round_id'),
    personId: str(row, 'person_id'),
    amountDue: num(row, 'amount_due'),
    amountPaid: num(row, 'amount_paid'),
    paidDate: optStr(row, 'paid_date'),
    method: optStr(row, 'method') as Payment['method'],
    reference: optStr(row, 'reference'),
    status: str(row, 'status') as Payment['status'],
    notes: optStr(row, 'notes'),
    createdAt: str(row, 'created_at'),
    updatedAt: str(row, 'updated_at'),
  }
}

export function paymentToRow(payment: Payment) {
  return {
    id: payment.id,
    scheme_id: payment.schemeId,
    round_id: payment.roundId,
    person_id: payment.personId,
    amount_due: payment.amountDue,
    amount_paid: payment.amountPaid,
    paid_date: payment.paidDate ?? null,
    method: payment.method ?? null,
    reference: payment.reference ?? null,
    status: payment.status,
    notes: payment.notes ?? null,
    created_at: payment.createdAt,
    updated_at: payment.updatedAt,
  }
}

export function mapPayout(row: Row): Payout {
  return {
    id: str(row, 'id'),
    schemeId: str(row, 'scheme_id'),
    roundId: str(row, 'round_id'),
    personId: str(row, 'person_id'),
    grossPool: num(row, 'gross_pool'),
    adjustment: num(row, 'adjustment'),
    payoutAmount: num(row, 'payout_amount'),
    autoCalculated: Boolean(row.auto_calculated),
    paidDate: optStr(row, 'paid_date'),
    method: optStr(row, 'method') as Payout['method'],
    reference: optStr(row, 'reference'),
    status: str(row, 'status') as Payout['status'],
    notes: optStr(row, 'notes'),
    createdAt: str(row, 'created_at'),
    updatedAt: str(row, 'updated_at'),
  }
}

export function payoutToRow(payout: Payout) {
  return {
    id: payout.id,
    scheme_id: payout.schemeId,
    round_id: payout.roundId,
    person_id: payout.personId,
    gross_pool: payout.grossPool,
    adjustment: payout.adjustment,
    payout_amount: payout.payoutAmount,
    auto_calculated: payout.autoCalculated,
    paid_date: payout.paidDate ?? null,
    method: payout.method ?? null,
    reference: payout.reference ?? null,
    status: payout.status,
    notes: payout.notes ?? null,
    created_at: payout.createdAt,
    updated_at: payout.updatedAt,
  }
}

export function mapAudit(row: Row): AuditLog {
  return {
    id: str(row, 'id'),
    action: str(row, 'action'),
    entityType: str(row, 'entity_type') as AuditLog['entityType'],
    entityId: str(row, 'entity_id'),
    summary: str(row, 'summary'),
    beforeJson: optStr(row, 'before_json'),
    afterJson: optStr(row, 'after_json'),
    actorPersonId: optStr(row, 'actor_person_id'),
    actorLabel: str(row, 'actor_label'),
    createdAt: str(row, 'created_at'),
  }
}

export function auditToRow(log: AuditLog) {
  return {
    id: log.id,
    action: log.action,
    entity_type: log.entityType,
    entity_id: log.entityId,
    summary: log.summary,
    before_json: log.beforeJson ?? null,
    after_json: log.afterJson ?? null,
    actor_person_id: log.actorPersonId ?? null,
    actor_label: log.actorLabel,
    created_at: log.createdAt,
  }
}

export function mapSetting(row: Row): SettingRecord {
  return {
    key: str(row, 'key'),
    value: row.value,
    updatedAt: str(row, 'updated_at'),
  }
}

export function settingToRow(setting: SettingRecord) {
  return {
    key: setting.key,
    value: setting.value ?? null,
    updated_at: setting.updatedAt,
  }
}

export function throwIfError(error: { message: string } | null): void {
  if (error) throw new RepositoryError(error.message)
}
