import { todayIso } from '@/lib/dates'
import { nowIso } from '@/lib/id'
import { mapPayment, mapPerson, mapRound, paymentToRow, throwIfError } from '@/lib/mappers'
import { getSupabase } from '@/lib/supabase'
import { auditService } from '@/services/audit'
import { notifyDataChanged } from '@/stores/dataVersion'
import { RepositoryError } from '@/repositories/errors'
import { summarisePayments } from '@/repositories/roundsRepository'
import type { Paise } from '@/domain/money/money'
import type { DateOnly, Payment, PaymentMethod, PaymentStatus, Person } from '@/types/entities'

export type PaymentWithPerson = Payment & { person?: Person }

export type RecordPaymentInput = {
  paymentId: string
  amountPaid: Paise
  paidDate?: DateOnly
  method?: PaymentMethod
  reference?: string
  notes?: string
}

/** Paid when settled in full, Partially paid in between, otherwise Pending. */
export function deriveStatus(amountDue: Paise, amountPaid: Paise): PaymentStatus {
  if (amountPaid <= 0) return 'pending'
  if (amountPaid >= amountDue) return 'paid'
  return 'partially_paid'
}

/**
 * Display status. Overdue is derived rather than stored, so it stays correct
 * as days pass without a background job.
 */
export function displayStatus(
  payment: Payment,
  dueDate: DateOnly,
  today: DateOnly = todayIso(),
): PaymentStatus | 'overdue' {
  if (payment.status === 'paid' || payment.status === 'waived') return payment.status
  return dueDate < today ? 'overdue' : payment.status
}

async function getPayment(id: string): Promise<Payment | undefined> {
  const { data, error } = await getSupabase().from('payments').select('*').eq('id', id).maybeSingle()
  throwIfError(error)
  return data ? mapPayment(data) : undefined
}

async function getRound(id: string) {
  const { data, error } = await getSupabase().from('rounds').select('*').eq('id', id).maybeSingle()
  throwIfError(error)
  return data ? mapRound(data) : undefined
}

async function persistRoundTotals(roundId: string) {
  const round = await getRound(roundId)
  if (!round) return
  const { data, error } = await getSupabase().from('payments').select('*').eq('round_id', roundId)
  throwIfError(error)
  const totals = summarisePayments((data ?? []).map(mapPayment))
  const { error: updateError } = await getSupabase()
    .from('rounds')
    .update({
      actual_collection: totals.collected,
      pending_amount: totals.pending,
      updated_at: nowIso(),
    })
    .eq('id', roundId)
  throwIfError(updateError)
}

export const paymentsRepository = {
  async listForRound(roundId: string): Promise<Payment[]> {
    const { data, error } = await getSupabase().from('payments').select('*').eq('round_id', roundId)
    throwIfError(error)
    return (data ?? []).map(mapPayment)
  },

  async listForRoundWithPeople(roundId: string): Promise<PaymentWithPerson[]> {
    const payments = await paymentsRepository.listForRound(roundId)
    const people = await Promise.all(
      payments.map(async (payment) => {
        const { data, error } = await getSupabase()
          .from('people')
          .select('*')
          .eq('id', payment.personId)
          .maybeSingle()
        throwIfError(error)
        return data ? mapPerson(data) : undefined
      }),
    )
    return payments
      .map((payment, index) => ({ ...payment, person: people[index] }))
      .sort((a, b) => (a.person?.fullName ?? '').localeCompare(b.person?.fullName ?? ''))
  },

  async listForScheme(schemeId: string): Promise<Payment[]> {
    const { data, error } = await getSupabase().from('payments').select('*').eq('scheme_id', schemeId)
    throwIfError(error)
    return (data ?? []).map(mapPayment)
  },

  async listForPerson(personId: string): Promise<Payment[]> {
    const { data, error } = await getSupabase().from('payments').select('*').eq('person_id', personId)
    throwIfError(error)
    return (data ?? []).map(mapPayment)
  },

  async listAll(): Promise<Payment[]> {
    const { data, error } = await getSupabase().from('payments').select('*')
    throwIfError(error)
    return (data ?? []).map(mapPayment)
  },

  async record(input: RecordPaymentInput): Promise<Payment> {
    const before = await getPayment(input.paymentId)
    if (!before) throw new RepositoryError('Payment not found')

    const round = await getRound(before.roundId)
    if (!round) throw new RepositoryError('Round not found')
    if (round.status === 'closed') {
      throw new RepositoryError('This round is closed. Reopen it before editing payments.')
    }

    if (input.amountPaid < 0) {
      throw new RepositoryError('Amount cannot be negative.')
    }
    if (input.amountPaid > before.amountDue) {
      throw new RepositoryError(
        'Overpayment is not allowed. Enter at most the monthly contribution.',
      )
    }

    const status = deriveStatus(before.amountDue, input.amountPaid)
    const updated: Payment = {
      ...before,
      amountPaid: input.amountPaid,
      paidDate: input.amountPaid > 0 ? (input.paidDate ?? todayIso()) : undefined,
      method: input.amountPaid > 0 ? input.method : undefined,
      reference: input.reference?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      status,
      updatedAt: nowIso(),
    }

    const { error } = await getSupabase()
      .from('payments')
      .update(paymentToRow(updated))
      .eq('id', before.id)
    throwIfError(error)
    await persistRoundTotals(before.roundId)

    const { data: person } = await getSupabase()
      .from('people')
      .select('full_name')
      .eq('id', before.personId)
      .maybeSingle()
    await auditService.record({
      action: 'payment.recorded',
      entityType: 'payment',
      entityId: before.id,
      summary: `Recorded payment for ${person?.full_name ?? 'member'} — month ${round.monthNumber}`,
      before,
      after: updated,
    })
    notifyDataChanged()
    return updated
  },

  /**
   * Settles every outstanding contribution in one go. Most months everyone
   * pays in full, so this saves the admin twenty separate dialogs. Already
   * paid and waived rows are left untouched.
   */
  async recordAllOutstanding(
    roundId: string,
    options: { method?: PaymentMethod; paidDate?: DateOnly } = {},
  ): Promise<{ settled: number }> {
    const round = await getRound(roundId)
    if (!round) throw new RepositoryError('Round not found')
    if (round.status === 'closed') {
      throw new RepositoryError('This round is closed. Reopen it before editing payments.')
    }

    const payments = await paymentsRepository.listForRound(roundId)
    const outstanding = payments.filter(
      (payment) => payment.status !== 'paid' && payment.status !== 'waived',
    )
    if (outstanding.length === 0) {
      throw new RepositoryError('Every contribution for this month is already settled.')
    }

    const timestamp = nowIso()
    const paidDate = options.paidDate ?? todayIso()
    const updated: Payment[] = outstanding.map((payment) => ({
      ...payment,
      amountPaid: payment.amountDue,
      paidDate,
      method: options.method ?? payment.method,
      status: 'paid' as const,
      updatedAt: timestamp,
    }))

    for (const payment of updated) {
      const { error } = await getSupabase()
        .from('payments')
        .update(paymentToRow(payment))
        .eq('id', payment.id)
      throwIfError(error)
    }

    await persistRoundTotals(roundId)
    const { data: scheme } = await getSupabase()
      .from('schemes')
      .select('code')
      .eq('id', round.schemeId)
      .maybeSingle()
    await auditService.record({
      action: 'payment.bulk_recorded',
      entityType: 'round',
      entityId: roundId,
      summary: `Marked ${updated.length} contribution(s) paid for ${scheme?.code ?? 'scheme'} month ${round.monthNumber}`,
      after: { settled: updated.length },
    })
    notifyDataChanged()
    return { settled: updated.length }
  },

  /** Waived counts as settled but never adds to the collected total. */
  async waive(paymentId: string, notes?: string): Promise<void> {
    const before = await getPayment(paymentId)
    if (!before) throw new RepositoryError('Payment not found')
    const round = await getRound(before.roundId)
    if (!round) throw new RepositoryError('Round not found')
    if (round.status === 'closed') throw new RepositoryError('This round is closed.')

    const updated: Payment = {
      ...before,
      status: 'waived',
      amountPaid: 0,
      paidDate: undefined,
      method: undefined,
      notes: notes?.trim() || before.notes,
      updatedAt: nowIso(),
    }
    const { error } = await getSupabase()
      .from('payments')
      .update(paymentToRow(updated))
      .eq('id', paymentId)
    throwIfError(error)
    await persistRoundTotals(before.roundId)
    const { data: person } = await getSupabase()
      .from('people')
      .select('full_name')
      .eq('id', before.personId)
      .maybeSingle()
    await auditService.record({
      action: 'payment.waived',
      entityType: 'payment',
      entityId: paymentId,
      summary: `Waived contribution for ${person?.full_name ?? 'member'} — month ${round.monthNumber}`,
      before,
      after: updated,
    })
    notifyDataChanged()
  },

  /** Undo a waive or a recorded amount, back to Pending. */
  async reset(paymentId: string): Promise<void> {
    const before = await getPayment(paymentId)
    if (!before) throw new RepositoryError('Payment not found')
    const round = await getRound(before.roundId)
    if (!round) throw new RepositoryError('Round not found')
    if (round.status === 'closed') throw new RepositoryError('This round is closed.')

    const updated: Payment = {
      ...before,
      amountPaid: 0,
      paidDate: undefined,
      method: undefined,
      reference: undefined,
      status: 'pending',
      updatedAt: nowIso(),
    }
    const { error } = await getSupabase()
      .from('payments')
      .update(paymentToRow(updated))
      .eq('id', paymentId)
    throwIfError(error)
    await persistRoundTotals(before.roundId)
    await auditService.record({
      action: 'payment.reset',
      entityType: 'payment',
      entityId: paymentId,
      summary: `Reset contribution to pending — month ${round.monthNumber}`,
      before,
      after: updated,
    })
    notifyDataChanged()
  },
}
