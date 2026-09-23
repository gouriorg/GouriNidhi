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

function splitPaise(total: Paise, parts: number): Paise[] {
  if (parts < 1) return []
  const base = Math.floor(total / parts)
  const remainder = total - base * parts
  return Array.from({ length: parts }, (_, index) => base + (index === parts - 1 ? remainder : 0))
}

export const payoutsRepository = {
  async listForRound(roundId: string): Promise<Payout[]> {
    const { data, error } = await getSupabase()
      .from('payouts')
      .select('*')
      .eq('round_id', roundId)
      .order('created_at')
    throwIfError(error)
    return (data ?? []).map(mapPayout)
  },

  async getForRound(roundId: string): Promise<Payout | undefined> {
    const rows = await payoutsRepository.listForRound(roundId)
    return rows[0]
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

    const { data: existingRow, error: existingError } = await getSupabase()
      .from('payouts')
      .select('*')
      .eq('round_id', input.roundId)
      .eq('person_id', input.personId)
      .maybeSingle()
    throwIfError(existingError)
    const existing = existingRow ? mapPayout(existingRow) : undefined
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
    await refreshRoundWinners(round.id)

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

  /** Replace this month’s pending winners. Paid winners are always kept. */
  async saveWinners(roundId: string, personIds: string[]): Promise<Payout[]> {
    const uniqueIds = [...new Set(personIds.filter(Boolean))]
    if (uniqueIds.length === 0) {
      throw new RepositoryError('Choose at least one member for this month.')
    }

    const { data: roundRow, error: roundError } = await getSupabase()
      .from('rounds')
      .select('*')
      .eq('id', roundId)
      .maybeSingle()
    throwIfError(roundError)
    if (!roundRow) throw new RepositoryError('Round not found')
    const round = mapRound(roundRow)
    if (round.status === 'closed') throw new RepositoryError('This round is closed.')

    const { data: memberRows, error: memberError } = await getSupabase()
      .from('scheme_members')
      .select('*')
      .eq('scheme_id', round.schemeId)
      .in('person_id', uniqueIds)
    throwIfError(memberError)
    const activeIds = new Set(
      (memberRows ?? [])
        .map(mapMembership)
        .filter((row) => row.status === 'active')
        .map((row) => row.personId),
    )
    const missing = uniqueIds.filter((id) => !activeIds.has(id))
    if (missing.length > 0) {
      throw new RepositoryError('Only active members of this scheme can be payout winners.')
    }

    const existing = await payoutsRepository.listForRound(roundId)
    const paidIds = existing.filter((row) => row.status === 'paid').map((row) => row.personId)
    for (const id of paidIds) {
      if (!uniqueIds.includes(id)) uniqueIds.push(id)
    }

    const pendingToRemove = existing.filter(
      (row) => row.status !== 'paid' && !uniqueIds.includes(row.personId),
    )
    for (const row of pendingToRemove) {
      const { error } = await getSupabase().from('payouts').delete().eq('id', row.id)
      throwIfError(error)
    }

    const shares = splitPaise(round.plannedPayoutAmount, uniqueIds.length)
    const timestamp = nowIso()
    const saved: Payout[] = []

    for (let index = 0; index < uniqueIds.length; index += 1) {
      const personId = uniqueIds[index]
      const amount = shares[index]
      const current = existing.find((row) => row.personId === personId)
      if (current?.status === 'paid') {
        saved.push(current)
        continue
      }
      const payout = payoutSchema.parse({
        id: current?.id ?? newId(),
        schemeId: round.schemeId,
        roundId,
        personId,
        grossPool: round.expectedCollection,
        adjustment: amount - round.expectedCollection,
        payoutAmount: amount,
        autoCalculated: true,
        paidDate: undefined,
        method: undefined,
        reference: current?.reference,
        status: 'pending',
        notes: current?.notes,
        createdAt: current?.createdAt ?? timestamp,
        updatedAt: timestamp,
      } satisfies Payout)
      const { error } = current
        ? await getSupabase().from('payouts').update(payoutToRow(payout)).eq('id', payout.id)
        : await getSupabase().from('payouts').insert(payoutToRow(payout))
      throwIfError(error)
      saved.push(payout)
    }

    await refreshRoundWinners(roundId)
    await auditService.record({
      action: 'payout.recorded',
      entityType: 'payout',
      entityId: roundId,
      summary: `Month ${round.monthNumber} winners saved (${uniqueIds.length})`,
    })
    notifyDataChanged()
    return saved
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

    if (payout.status === 'paid') {
      throw new RepositoryError('A paid winner cannot be removed.')
    }
    const { error: delError } = await getSupabase().from('payouts').delete().eq('id', payoutId)
    throwIfError(delError)
    if (round) await refreshRoundWinners(round.id)
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

async function refreshRoundWinners(roundId: string): Promise<void> {
  const { data: roundRow, error: roundError } = await getSupabase()
    .from('rounds')
    .select('*')
    .eq('id', roundId)
    .maybeSingle()
  throwIfError(roundError)
  if (!roundRow) return
  const round = mapRound(roundRow)
  const winners = await payoutsRepository.listForRound(roundId)
  const allPaid = winners.length > 0 && winners.every((row) => row.status === 'paid')
  let status = round.status
  if (round.status !== 'closed' && round.status !== 'upcoming' && round.status !== 'collection_open') {
    status = allPaid ? 'payout_complete' : winners.length > 0 ? 'payout_pending' : round.status === 'payout_complete' || round.status === 'payout_pending' ? 'collection_complete' : round.status
  } else if (winners.length > 0 && (round.status === 'collection_complete' || round.status === 'payout_pending')) {
    status = allPaid ? 'payout_complete' : 'payout_pending'
  }

  const { error } = await getSupabase()
    .from('rounds')
    .update(
      roundToRow({
        ...round,
        recipientPersonId: winners[0]?.personId,
        status,
        updatedAt: nowIso(),
      }),
    )
    .eq('id', roundId)
  throwIfError(error)
}
