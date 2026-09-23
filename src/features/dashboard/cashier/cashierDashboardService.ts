import { membershipsRepository } from '@/repositories/membershipsRepository'
import { roundsRepository } from '@/repositories/roundsRepository'
import { displayStatus } from '@/repositories/paymentsRepository'
import { payoutsRepository } from '@/repositories/payoutsRepository'
import { peopleRepository } from '@/repositories/peopleRepository'
import { getSupabase } from '@/lib/supabase'
import { todayIso } from '@/lib/dates'
import { mapPayment, mapRound, mapScheme, throwIfError } from '@/lib/mappers'
import type { Paise } from '@/domain/money/money'
import type { Payment, PaymentStatus, Person, Payout, Round, Scheme, SchemeMember } from '@/types/entities'

export type CashierMonthCell = {
  round: Round
  payment?: Payment
  displayStatus: PaymentStatus | 'overdue'
  overdue: boolean
  advance: boolean
  canEdit: boolean
}

export type CashierCollectRow = {
  membership: SchemeMember
  person: Person
  scheme: Scheme
  months: CashierMonthCell[]
  overdue: boolean
}

export type CashierHandoverRow = {
  scheme: Scheme
  round: Round
  payout: Payout
  person: Person
}

export type CashierDashboard = {
  assignedCount: number
  collectedOpen: Paise
  pendingOpen: Paise
  overdueCount: number
  advanceCount: number
  handoverCount: number
  rows: CashierCollectRow[]
  handovers: CashierHandoverRow[]
}

export async function loadAdminCollectDashboard(): Promise<CashierDashboard> {
  return loadCollectDashboard(await membershipsRepository.listActive())
}

export async function loadCashierDashboard(cashierPersonId: string): Promise<CashierDashboard> {
  return loadCollectDashboard(await membershipsRepository.listAssignedTo(cashierPersonId))
}

async function loadCollectDashboard(memberships: SchemeMember[]): Promise<CashierDashboard> {
  await roundsRepository.openDueCollections()
  const schemeIds = [...new Set(memberships.map((row) => row.schemeId))]
  const emptyIds = ['00000000-0000-0000-0000-000000000000']
  const today = todayIso()

  const [schemeRows, roundRows, paymentRows, people] = await Promise.all([
    getSupabase()
      .from('schemes')
      .select('*')
      .in('id', schemeIds.length > 0 ? schemeIds : emptyIds),
    getSupabase()
      .from('rounds')
      .select('*')
      .in('scheme_id', schemeIds.length > 0 ? schemeIds : emptyIds)
      .order('month_number'),
    getSupabase()
      .from('payments')
      .select('*')
      .in('scheme_id', schemeIds.length > 0 ? schemeIds : emptyIds),
    peopleRepository.list(),
  ])
  throwIfError(schemeRows.error)
  throwIfError(roundRows.error)
  throwIfError(paymentRows.error)

  const schemeById = new Map((schemeRows.data ?? []).map((row) => mapScheme(row)).map((scheme) => [scheme.id, scheme]))
  const personById = new Map(people.map((person) => [person.id, person]))
  const rounds = (roundRows.data ?? []).map((row) => mapRound(row as Record<string, unknown>))
  const roundsByScheme = new Map<string, Round[]>()
  for (const round of rounds) {
    const list = roundsByScheme.get(round.schemeId) ?? []
    list.push(round)
    roundsByScheme.set(round.schemeId, list)
  }
  const payments = (paymentRows.data ?? []).map((row) => mapPayment(row as Record<string, unknown>))
  const paymentByKey = new Map(payments.map((payment) => [`${payment.roundId}:${payment.personId}`, payment]))

  const rows: CashierCollectRow[] = []
  let collectedOpen = 0
  let pendingOpen = 0
  let overdueCount = 0
  let advanceCount = 0

  for (const membership of memberships) {
    const person = personById.get(membership.personId)
    const scheme = schemeById.get(membership.schemeId)
    if (!person || !scheme) continue
    const months: CashierMonthCell[] = (roundsByScheme.get(membership.schemeId) ?? []).map((round) => {
      const payment = paymentByKey.get(`${round.id}:${membership.personId}`)
      const status = payment
        ? displayStatus(payment, round.dueDate, today)
        : round.dueDate < today
          ? 'overdue'
          : 'pending'
      const overdue = status === 'overdue'
      const paid = payment?.status === 'paid'
      const advance = paid && round.dueDate > today
      if (paid && (round.status === 'collection_open' || round.dueDate <= today)) {
        collectedOpen += payment?.amountPaid ?? 0
      }
      if (!paid && payment?.status !== 'waived' && (round.status === 'collection_open' || round.dueDate <= today)) {
        pendingOpen += payment ? payment.amountDue - payment.amountPaid : scheme.monthlyAmount
      }
      if (overdue) overdueCount += 1
      if (advance) advanceCount += 1
      return {
        round,
        payment,
        displayStatus: status,
        overdue,
        advance,
        canEdit: round.status !== 'closed',
      }
    })

    rows.push({
      membership,
      person,
      scheme,
      months,
      overdue: months.some((month) => month.overdue),
    })
  }

  rows.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
    return a.person.fullName.localeCompare(b.person.fullName)
  })

  const handovers: CashierHandoverRow[] = []
  const activeRounds = rounds.filter((round) =>
    ['collection_open', 'collection_complete', 'payout_pending'].includes(round.status),
  )
  for (const round of activeRounds) {
    const winners = await payoutsRepository.listForRound(round.id)
    for (const payout of winners) {
      const assigned = memberships.find(
        (row) => row.schemeId === round.schemeId && row.personId === payout.personId,
      )
      if (!assigned) continue
      const person = personById.get(payout.personId)
      const scheme = schemeById.get(round.schemeId)
      if (!person || !scheme) continue
      handovers.push({ scheme, round, payout, person })
    }
  }

  return {
    assignedCount: memberships.length,
    collectedOpen,
    pendingOpen,
    overdueCount,
    advanceCount,
    handoverCount: handovers.filter((row) => row.payout.status !== 'paid').length,
    rows,
    handovers,
  }
}
