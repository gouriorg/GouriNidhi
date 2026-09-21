import { paymentSchema } from '@/db/schema'
import { newId, nowIso } from '@/lib/id'
import { mapMembership, mapPayment, mapRound, paymentToRow, roundToRow, throwIfError } from '@/lib/mappers'
import { getSupabase } from '@/lib/supabase'
import { auditService } from '@/services/audit'
import { notifyDataChanged } from '@/stores/dataVersion'
import { RepositoryError } from '@/repositories/errors'
import { schemesRepository } from '@/repositories/schemesRepository'
import type { Payment, Round, RoundStatus } from '@/types/entities'

const transitions: Record<RoundStatus, RoundStatus[]> = {
  upcoming: ['collection_open'],
  collection_open: ['collection_complete', 'upcoming'],
  collection_complete: ['payout_pending', 'collection_open'],
  payout_pending: ['payout_complete', 'collection_complete'],
  payout_complete: ['closed', 'payout_pending'],
  closed: [],
}

export function canTransition(from: RoundStatus, to: RoundStatus): boolean {
  return transitions[from].includes(to)
}

export function nextStatus(status: RoundStatus): RoundStatus | undefined {
  return transitions[status][0]
}

export function summarisePayments(payments: Payment[]) {
  let collected = 0
  let pending = 0
  let waived = 0
  for (const payment of payments) {
    if (payment.status === 'waived') {
      waived += payment.amountDue
      continue
    }
    collected += payment.amountPaid
    pending += payment.amountDue - payment.amountPaid
  }
  return { collected, pending, waived }
}

async function getRound(id: string): Promise<Round | undefined> {
  const { data, error } = await getSupabase().from('rounds').select('*').eq('id', id).maybeSingle()
  throwIfError(error)
  return data ? mapRound(data) : undefined
}

export const roundsRepository = {
  async listForScheme(schemeId: string): Promise<Round[]> {
    const { data, error } = await getSupabase()
      .from('rounds')
      .select('*')
      .eq('scheme_id', schemeId)
      .order('month_number')
    throwIfError(error)
    return (data ?? []).map(mapRound)
  },

  async get(id: string): Promise<Round | undefined> {
    return getRound(id)
  },

  async openCollection(roundId: string): Promise<{ obligationsCreated: number }> {
    const round = await getRound(roundId)
    if (!round) throw new RepositoryError('Round not found')
    if (round.status !== 'upcoming') {
      throw new RepositoryError('Collection can only be opened on an Upcoming round.')
    }
    const scheme = await schemesRepository.get(round.schemeId)
    if (!scheme) throw new RepositoryError('Scheme not found')
    if (scheme.status !== 'active') {
      throw new RepositoryError('Activate the scheme before opening collection.')
    }

    const { data: memberRows, error: memberError } = await getSupabase()
      .from('scheme_members')
      .select('*')
      .eq('scheme_id', round.schemeId)
      .eq('status', 'active')
    throwIfError(memberError)
    const members = (memberRows ?? []).map(mapMembership)
    if (members.length === 0) {
      throw new RepositoryError(
        'This scheme has no active members yet. Assign members before opening collection.',
      )
    }

    const { data: existingRows } = await getSupabase().from('payments').select('*').eq('round_id', roundId)
    const existing = (existingRows ?? []).map(mapPayment)
    const existingPersonIds = new Set(existing.map((payment) => payment.personId))
    const timestamp = nowIso()
    const newPayments: Payment[] = members
      .filter((member) => !existingPersonIds.has(member.personId))
      .map((member) =>
        paymentSchema.parse({
          id: newId(),
          schemeId: round.schemeId,
          roundId,
          personId: member.personId,
          amountDue: scheme.monthlyAmount,
          amountPaid: 0,
          status: 'pending',
          createdAt: timestamp,
          updatedAt: timestamp,
        } satisfies Payment),
      )

    if (newPayments.length > 0) {
      const { error } = await getSupabase().from('payments').insert(newPayments.map(paymentToRow))
      throwIfError(error)
    }

    const totals = summarisePayments([...existing, ...newPayments])
    const updated: Round = {
      ...round,
      status: 'collection_open',
      actualCollection: totals.collected,
      pendingAmount: totals.pending,
      updatedAt: timestamp,
    }
    const { error } = await getSupabase().from('rounds').update(roundToRow(updated)).eq('id', roundId)
    throwIfError(error)
    await auditService.record({
      action: 'round.collection_opened',
      entityType: 'round',
      entityId: roundId,
      summary: `Opened collection for ${scheme.code} month ${round.monthNumber} (${newPayments.length} obligations)`,
      before: round,
      after: updated,
    })
    notifyDataChanged()
    return { obligationsCreated: newPayments.length }
  },

  async setStatus(roundId: string, status: RoundStatus): Promise<void> {
    const round = await getRound(roundId)
    if (!round) throw new RepositoryError('Round not found')
    if (!canTransition(round.status, status)) {
      throw new RepositoryError(`A round cannot move from ${round.status} to ${status}.`)
    }
    const scheme = await schemesRepository.get(round.schemeId)

    if (status === 'collection_complete') {
      const { data } = await getSupabase().from('payments').select('status').eq('round_id', roundId)
      const outstanding = (data ?? []).filter((row) => row.status !== 'paid' && row.status !== 'waived')
        .length
      if (outstanding > 0) {
        throw new RepositoryError(
          `${outstanding} contribution(s) are still unpaid. Record or waive them first.`,
        )
      }
    }

    if (status === 'payout_complete') {
      const { data: payout } = await getSupabase()
        .from('payouts')
        .select('status')
        .eq('scheme_id', round.schemeId)
        .eq('round_id', roundId)
        .maybeSingle()
      if (!payout || payout.status !== 'paid') {
        throw new RepositoryError('Record the payout as Paid before completing this round.')
      }
    }

    const updated: Round = { ...round, status, updatedAt: nowIso() }
    const { error } = await getSupabase().from('rounds').update(roundToRow(updated)).eq('id', roundId)
    throwIfError(error)
    await auditService.record({
      action: `round.${status}`,
      entityType: 'round',
      entityId: roundId,
      summary: `${scheme?.code ?? 'Scheme'} month ${round.monthNumber} marked ${status.replace(/_/g, ' ')}`,
      before: round,
      after: updated,
    })
    notifyDataChanged()
  },

  async updateNotes(roundId: string, notes: string): Promise<void> {
    const round = await getRound(roundId)
    if (!round) throw new RepositoryError('Round not found')
    const { error } = await getSupabase()
      .from('rounds')
      .update(roundToRow({ ...round, notes: notes.trim() || undefined, updatedAt: nowIso() }))
      .eq('id', roundId)
    throwIfError(error)
    notifyDataChanged()
  },

  async recalculateTotals(roundId: string): Promise<void> {
    const round = await getRound(roundId)
    if (!round) return
    const { data } = await getSupabase().from('payments').select('*').eq('round_id', roundId)
    const totals = summarisePayments((data ?? []).map(mapPayment))
    const { error } = await getSupabase()
      .from('rounds')
      .update(
        roundToRow({
          ...round,
          actualCollection: totals.collected,
          pendingAmount: totals.pending,
          updatedAt: nowIso(),
        }),
      )
      .eq('id', roundId)
    throwIfError(error)
  },
}
