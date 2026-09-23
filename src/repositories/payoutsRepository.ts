import { payoutSchema } from '@/db/schema'
import { todayIso } from '@/lib/dates'
import { newId, nowIso } from '@/lib/id'
import { mapMembership, mapPayout, mapRound, payoutToRow, roundToRow, throwIfError } from '@/lib/mappers'
import { getSupabase } from '@/lib/supabase'
import { auditService } from '@/services/audit'
import { notifyDataChanged } from '@/stores/dataVersion'
import { RepositoryError } from '@/repositories/errors'
import type { Paise } from '@/domain/money/money'
import type { DateOnly, PaymentMethod, Payout } from '@/types/entities'

export type SavePayoutInput = {
  roundId: string
  personId: string
  payoutAmount: Paise
  autoCalculated: boolean
  paidDate?: DateOnly
  method?: PaymentMethod
  reference?: string
  notes?: string
  markPaid: boolean
}

export const payoutsRepository = {
  async getForRound(roundId: string): Promise<Payout | undefined> {
    const { data, error } = await getSupabase()
      .from('payouts')
      .select('*')
      .eq('round_id', roundId)
      .maybeSingle()
    throwIfError(error)
    return data ? mapPayout(data) : undefined
  },

  async listForScheme(schemeId: string): Promise<Payout[]> {
    const { data, error } = await getSupabase().from('payouts').select('*').eq('scheme_id', schemeId)
    throwIfError(error)
    return (data ?? []).map(mapPayout)
  },

  async listForPerson(personId: string): Promise<Payout[]> {
    const { data, error } = await getSupabase().from('payouts').select('*').eq('person_id', personId)
    throwIfError(error)
    return (data ?? []).map(mapPayout)
  },

  async listAll(): Promise<Payout[]> {
    const { data, error } = await getSupabase().from('payouts').select('*')
    throwIfError(error)
    return (data ?? []).map(mapPayout)
  },

  /** True when this person already won a month in this scheme. */
  async hasReceivedPayout(schemeId: string, personId: string, exceptRoundId?: string): Promise<boolean> {
    const { data, error } = await getSupabase()
      .from('payouts')
      .select('round_id')
      .eq('scheme_id', schemeId)
      .eq('person_id', personId)
    throwIfError(error)
    return (data ?? []).some((row) => row.round_id !== exceptRoundId)
  },

  /**
   * Records who withdrew this month. The amount defaults to the scheduled
   * figure, so the admin confirms rather than retypes it.
   */
  async save(input: SavePayoutInput): Promise<Payout> {
    const { data: roundRow, error: roundError } = await getSupabase()
      .from('rounds')
      .select('*')
      .eq('id', input.roundId)
      .maybeSingle()
    throwIfError(roundError)
    if (!roundRow) throw new RepositoryError('Round not found')
    const round = mapRound(roundRow)
    if (round.status === 'closed') throw new RepositoryError('This round is closed.')

    const { data: membershipRow, error: membershipError } = await getSupabase()
      .from('scheme_members')
      .select('*')
      .eq('scheme_id', round.schemeId)
      .eq('person_id', input.personId)
      .maybeSingle()
    throwIfError(membershipError)
    if (!membershipRow) {
      throw new RepositoryError('Only a member of this scheme can receive the payout.')
    }
    if (mapMembership(membershipRow).status !== 'active') {
      throw new RepositoryError('That membership is inactive.')
    }

    const existing = await payoutsRepository.getForRound(input.roundId)
    const timestamp = nowIso()
    const grossPool = round.expectedCollection

    const payout = payoutSchema.parse({
      id: existing?.id ?? newId(),
      schemeId: round.schemeId,
      roundId: input.roundId,
      personId: input.personId,
      grossPool,
      adjustment: input.payoutAmount - grossPool,
      payoutAmount: input.payoutAmount,
      autoCalculated: input.autoCalculated,
      paidDate: input.markPaid ? (input.paidDate ?? todayIso()) : undefined,
      method: input.markPaid ? input.method : undefined,
      reference: input.reference?.trim() || undefined,
      status: input.markPaid ? 'paid' : 'pending',
      notes: input.notes?.trim() || undefined,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    } satisfies Payout)

    const { error } = existing
      ? await getSupabase().from('payouts').update(payoutToRow(payout)).eq('id', payout.id)
      : await getSupabase().from('payouts').insert(payoutToRow(payout))
    throwIfError(error)

    const nextStatus =
      payout.status === 'paid'
        ? 'payout_complete'
        : round.status === 'collection_complete'
          ? 'payout_pending'
          : round.status

    const { error: roundUpdateError } = await getSupabase()
      .from('rounds')
      .update(
        roundToRow({
          ...round,
          recipientPersonId: input.personId,
          status: nextStatus,
          updatedAt: timestamp,
        }),
      )
      .eq('id', round.id)
    throwIfError(roundUpdateError)

    const { data: person } = await getSupabase()
      .from('people')
      .select('full_name')
      .eq('id', input.personId)
      .maybeSingle()
    await auditService.record({
      action: payout.status === 'paid' ? 'payout.paid' : 'payout.recorded',
      entityType: 'payout',
      entityId: payout.id,
      summary: `Month ${round.monthNumber} payout ${payout.status === 'paid' ? 'paid to' : 'assigned to'} ${person?.full_name ?? 'member'}${payout.autoCalculated ? '' : ' (manual amount)'}`,
      before: existing,
      after: payout,
    })
    notifyDataChanged()
    return payout
  },

  async markHandover(
    payoutId: string,
    input: { paidDate?: DateOnly; method?: PaymentMethod; reference?: string; notes?: string } = {},
  ): Promise<void> {
    const { error } = await getSupabase().rpc('cashier_mark_payout_paid', {
      p_payout_id: payoutId,
      p_paid_date: input.paidDate ?? todayIso(),
      p_method: input.method ?? 'cash',
      p_reference: input.reference ?? '',
      p_notes: input.notes ?? '',
    })
    throwIfError(error)
    notifyDataChanged()
  },

  async remove(payoutId: string): Promise<void> {
    const { data, error } = await getSupabase()
      .from('payouts')
      .select('*')
      .eq('id', payoutId)
      .maybeSingle()
    throwIfError(error)
    if (!data) throw new RepositoryError('Payout not found')
    const payout = mapPayout(data)

    const { data: roundRow } = await getSupabase()
      .from('rounds')
      .select('*')
      .eq('id', payout.roundId)
      .maybeSingle()
    const round = roundRow ? mapRound(roundRow) : undefined
    if (round?.status === 'closed') throw new RepositoryError('This round is closed.')

    const { error: delError } = await getSupabase().from('payouts').delete().eq('id', payoutId)
    throwIfError(delError)
    if (round) {
      const { error: roundError } = await getSupabase()
        .from('rounds')
        .update(
          roundToRow({
            ...round,
            recipientPersonId: undefined,
            status: round.status === 'payout_complete' ? 'collection_complete' : round.status,
            updatedAt: nowIso(),
          }),
        )
        .eq('id', round.id)
      throwIfError(roundError)
    }
    await auditService.record({
      action: 'payout.removed',
      entityType: 'payout',
      entityId: payoutId,
      summary: `Removed payout for month ${round?.monthNumber ?? '?'}`,
      before: payout,
    })
    notifyDataChanged()
  },
}
