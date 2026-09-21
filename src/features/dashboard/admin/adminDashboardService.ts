import { todayIso } from '@/lib/dates'
import {
  mapAudit,
  mapMembership,
  mapPayment,
  mapPayout,
  mapPerson,
  mapRound,
  mapScheme,
  throwIfError,
} from '@/lib/mappers'
import { getSupabase } from '@/lib/supabase'
import type { Paise } from '@/domain/money/money'

export type AdminDashboard = {
  activeSchemes: number
  totalSchemes: number
  activeMembers: number
  totalMembers: number
  memberships: number
  expectedMonthly: Paise
  collectedAllTime: Paise
  pendingNow: Paise
  paidOutAllTime: Paise
  roundsCompleted: number
  roundsTotal: number
  overdueCount: number
  upcomingDues: {
    roundId: string
    schemeId: string
    schemeCode: string
    schemeName: string
    monthNumber: number
    dueDate: string
    expected: Paise
    pending: Paise
    isOpen: boolean
  }[]
  collectionByScheme: { code: string; collected: number; pending: number }[]
  recentActivity: { id: string; summary: string; createdAt: string; actorLabel: string }[]
}

async function all<T>(table: string, map: (row: Record<string, unknown>) => T): Promise<T[]> {
  const { data, error } = await getSupabase().from(table).select('*')
  throwIfError(error)
  return (data ?? []).map((row) => map(row as Record<string, unknown>))
}

/** Aggregates every scheme. Admin-only by construction. */
export async function loadAdminDashboard(): Promise<AdminDashboard> {
  const today = todayIso()

  const [people, schemes, memberships, rounds, payments, payouts, logs] = await Promise.all([
    all('people', mapPerson),
    all('schemes', mapScheme),
    all('scheme_members', mapMembership),
    all('rounds', mapRound),
    all('payments', mapPayment),
    all('payouts', mapPayout),
    (async () => {
      const { data, error } = await getSupabase()
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(8)
      throwIfError(error)
      return (data ?? []).map((row) => mapAudit(row as Record<string, unknown>))
    })(),
  ])

  const activeSchemes = schemes.filter((scheme) => scheme.status === 'active')
  const schemeById = new Map(schemes.map((scheme) => [scheme.id, scheme]))

  const expectedMonthly = activeSchemes.reduce(
    (sum, scheme) => sum + scheme.monthlyAmount * scheme.maxMembers,
    0,
  )

  const collectedAllTime = payments.reduce((sum, payment) => sum + payment.amountPaid, 0)
  const pendingNow = payments
    .filter((payment) => payment.status !== 'waived')
    .reduce((sum, payment) => sum + (payment.amountDue - payment.amountPaid), 0)
  const paidOutAllTime = payouts
    .filter((payout) => payout.status === 'paid')
    .reduce((sum, payout) => sum + payout.payoutAmount, 0)

  const roundById = new Map(rounds.map((round) => [round.id, round]))
  const overdueCount = payments.filter((payment) => {
    if (payment.status === 'paid' || payment.status === 'waived') return false
    const round = roundById.get(payment.roundId)
    return round ? round.dueDate < today : false
  }).length

  const upcomingDues = rounds
    .filter((round) => round.status === 'collection_open' || round.status === 'upcoming')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6)
    .map((round) => {
      const scheme = schemeById.get(round.schemeId)
      return {
        roundId: round.id,
        schemeId: round.schemeId,
        schemeCode: scheme?.code ?? '—',
        schemeName: scheme?.name ?? 'Unknown scheme',
        monthNumber: round.monthNumber,
        dueDate: round.dueDate,
        expected: round.expectedCollection,
        pending: round.pendingAmount,
        isOpen: round.status === 'collection_open',
      }
    })

  const collectionByScheme = activeSchemes.map((scheme) => {
    const schemePayments = payments.filter((payment) => payment.schemeId === scheme.id)
    return {
      code: scheme.code,
      collected: schemePayments.reduce((sum, payment) => sum + payment.amountPaid, 0) / 100,
      pending:
        schemePayments
          .filter((payment) => payment.status !== 'waived')
          .reduce((sum, payment) => sum + (payment.amountDue - payment.amountPaid), 0) / 100,
    }
  })

  return {
    activeSchemes: activeSchemes.length,
    totalSchemes: schemes.length,
    activeMembers: people.filter((person) => person.status === 'active').length,
    totalMembers: people.length,
    memberships: memberships.filter((membership) => membership.status === 'active').length,
    expectedMonthly,
    collectedAllTime,
    pendingNow,
    paidOutAllTime,
    roundsCompleted: rounds.filter(
      (round) => round.status === 'closed' || round.status === 'payout_complete',
    ).length,
    roundsTotal: rounds.length,
    overdueCount,
    upcomingDues,
    collectionByScheme,
    recentActivity: logs.map((log) => ({
      id: log.id,
      summary: log.summary,
      createdAt: log.createdAt,
      actorLabel: log.actorLabel,
    })),
  }
}
