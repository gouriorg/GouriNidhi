import { buildFixedProfitSchedule } from '@/domain/distribution/fixedProfitSchedule'
import { todayIso } from '@/lib/dates'
import { mapPayment, mapPayout, mapRound, mapScheme, throwIfError } from '@/lib/mappers'
import { getSupabase } from '@/lib/supabase'
import { peopleRepository } from '@/repositories/peopleRepository'
import { membershipsRepository } from '@/repositories/membershipsRepository'
import type { Paise } from '@/domain/money/money'
import type {
  DateOnly,
  PaymentMethod,
  PaymentStatus,
  Person,
  PayoutStatus,
  ScheduleLine,
  SchemeStatus,
} from '@/types/entities'

export type MemberSchemeView = {
  schemeId: string
  code: string
  name: string
  status: SchemeStatus
  monthlyAmount: Paise
  durationMonths: number
  startDate: DateOnly
  memberNumber: number
  membershipActive: boolean
  myMonth?: number
  schedule: ScheduleLine[]
  paid: Paise
  pending: Paise
}

export type MemberPaymentView = {
  id: string
  schemeCode: string
  monthNumber: number
  dueDate: DateOnly
  amountDue: Paise
  amountPaid: Paise
  status: PaymentStatus | 'overdue'
  method?: PaymentMethod
  paidDate?: DateOnly
}

export type MemberPayoutView = {
  id: string
  schemeCode: string
  schemeName: string
  monthNumber: number
  dueDate: DateOnly
  payoutAmount: Paise
  status: PayoutStatus
  paidDate?: DateOnly
}

export type MemberHome = {
  person: Person
  totalPaid: Paise
  totalPending: Paise
  totalReceived: Paise
  overdueCount: number
  schemes: MemberSchemeView[]
  payments: MemberPaymentView[]
  payouts: MemberPayoutView[]
  upcomingDues: MemberPaymentView[]
}

/**
 * Everything the signed-in member may see — and nothing else.
 * Queries are filtered by personId; RLS also hides other members' rows.
 */
export async function loadMemberHome(personId: string): Promise<MemberHome | null> {
  const person = await peopleRepository.get(personId)
  if (!person) return null

  const today = todayIso()
  const supabase = getSupabase()

  const [memberships, myPayments, myPayouts] = await Promise.all([
    membershipsRepository.listForPerson(personId),
    (async () => {
      const { data, error } = await supabase.from('payments').select('*').eq('person_id', personId)
      throwIfError(error)
      return (data ?? []).map(mapPayment)
    })(),
    (async () => {
      const { data, error } = await supabase.from('payouts').select('*').eq('person_id', personId)
      throwIfError(error)
      return (data ?? []).map(mapPayout)
    })(),
  ])

  const schemeIds = [...new Set(memberships.map((membership) => membership.schemeId))]
  const schemes = await Promise.all(
    schemeIds.map(async (id) => {
      const { data, error } = await supabase.from('schemes').select('*').eq('id', id).maybeSingle()
      throwIfError(error)
      return data ? mapScheme(data) : undefined
    }),
  )
  const schemeById = new Map(
    schemes.filter(Boolean).map((scheme) => [scheme!.id, scheme!]),
  )

  const roundIds = [
    ...new Set([...myPayments.map((p) => p.roundId), ...myPayouts.map((p) => p.roundId)]),
  ]
  const rounds = await Promise.all(
    roundIds.map(async (id) => {
      const { data, error } = await supabase.from('rounds').select('*').eq('id', id).maybeSingle()
      throwIfError(error)
      return data ? mapRound(data) : undefined
    }),
  )
  const roundById = new Map(rounds.filter(Boolean).map((round) => [round!.id, round!]))

  const paymentViews: MemberPaymentView[] = myPayments
    .map((payment) => {
      const round = roundById.get(payment.roundId)
      const scheme = schemeById.get(payment.schemeId)
      const dueDate = round?.dueDate ?? ''
      const overdue =
        payment.status !== 'paid' && payment.status !== 'waived' && dueDate !== '' && dueDate < today
      return {
        id: payment.id,
        schemeCode: scheme?.code ?? '—',
        monthNumber: round?.monthNumber ?? 0,
        dueDate,
        amountDue: payment.amountDue,
        amountPaid: payment.amountPaid,
        status: (overdue ? 'overdue' : payment.status) as PaymentStatus | 'overdue',
        method: payment.method,
        paidDate: payment.paidDate,
      }
    })
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate) || b.monthNumber - a.monthNumber)

  const payoutViews: MemberPayoutView[] = myPayouts
    .map((payout) => {
      const round = roundById.get(payout.roundId)
      const scheme = schemeById.get(payout.schemeId)
      return {
        id: payout.id,
        schemeCode: scheme?.code ?? '—',
        schemeName: scheme?.name ?? 'Scheme',
        monthNumber: round?.monthNumber ?? 0,
        dueDate: round?.dueDate ?? '',
        payoutAmount: payout.payoutAmount,
        status: payout.status,
        paidDate: payout.paidDate,
      }
    })
    .sort((a, b) => a.monthNumber - b.monthNumber)

  const schemeViews: MemberSchemeView[] = memberships
    .map((membership): MemberSchemeView | null => {
      const scheme = schemeById.get(membership.schemeId)
      if (!scheme) return null

      const schedule =
        scheme.scheduleSnapshot && scheme.scheduleSnapshot.length > 0
          ? scheme.scheduleSnapshot
          : buildFixedProfitSchedule({
              maxMembers: scheme.maxMembers,
              monthlyAmount: scheme.monthlyAmount,
              durationMonths: scheme.durationMonths,
              startDate: scheme.startDate,
              collectionDay: scheme.collectionDay,
              profitBps: scheme.profitBps,
            }).lines

      const schemePayments = myPayments.filter((p) => p.schemeId === scheme.id)
      const myPayout = myPayouts.find((p) => p.schemeId === scheme.id)

      return {
        schemeId: scheme.id,
        code: scheme.code,
        name: scheme.name,
        status: scheme.status,
        monthlyAmount: scheme.monthlyAmount,
        durationMonths: scheme.durationMonths,
        startDate: scheme.startDate,
        memberNumber: membership.memberNumber,
        membershipActive: membership.status === 'active',
        myMonth: myPayout ? roundById.get(myPayout.roundId)?.monthNumber : undefined,
        schedule,
        paid: schemePayments.reduce((sum, p) => sum + p.amountPaid, 0),
        pending: schemePayments
          .filter((p) => p.status !== 'waived')
          .reduce((sum, p) => sum + (p.amountDue - p.amountPaid), 0),
      }
    })
    .filter((view): view is MemberSchemeView => view !== null)
    .sort((a, b) => a.code.localeCompare(b.code))

  return {
    person,
    totalPaid: myPayments.reduce((sum, p) => sum + p.amountPaid, 0),
    totalPending: myPayments
      .filter((p) => p.status !== 'waived')
      .reduce((sum, p) => sum + (p.amountDue - p.amountPaid), 0),
    totalReceived: myPayouts
      .filter((p) => p.status === 'paid')
      .reduce((sum, p) => sum + p.payoutAmount, 0),
    overdueCount: paymentViews.filter((p) => p.status === 'overdue').length,
    schemes: schemeViews,
    payments: paymentViews,
    payouts: payoutViews,
    upcomingDues: paymentViews
      .filter((p) => p.status !== 'paid' && p.status !== 'waived')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
  }
}
