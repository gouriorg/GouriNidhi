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
import { features } from '@/config/features'
import { getSupabase } from '@/lib/supabase'
import { roundsRepository } from '@/repositories/roundsRepository'
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
  cashierCount: number
  unassignedMembers: number
  byCashier: {
    personId: string
    name: string
    assignedCount: number
    dueOpen: Paise
    collectedOpen: Paise
    pendingOpen: Paise
  }[]
  callAlerts: {
    paymentId: string
    personName: string
    mobile: string
    schemeCode: string
    monthNumber: number
    dueDate: string
    pending: Paise
    cashierName: string | null
  }[]
}

async function all<T>(table: string, map: (row: Record<string, unknown>) => T): Promise<T[]> {
  const { data, error } = await getSupabase().from(table).select('*')
  throwIfError(error)
  return (data ?? []).map((row) => map(row as Record<string, unknown>))
}

/** Aggregates every scheme. Admin-only by construction. */
export async function loadAdminDashboard(): Promise<AdminDashboard> {
  await roundsRepository.openDueCollections()
  const today = todayIso()

  const [people, schemes, memberships, rounds, payments, payouts, logs, cashierRoles] = await Promise.all([
    all('people', mapPerson),
    all('schemes', mapScheme),
    all('scheme_members', mapMembership),
    all('rounds', mapRound),
    all('payments', mapPayment),
    all('payouts', mapPayout),
    features.auditLog
      ? (async () => {
          const { data, error } = await getSupabase()
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(8)
          throwIfError(error)
          return (data ?? []).map((row) => mapAudit(row as Record<string, unknown>))
        })()
      : Promise.resolve([]),
    (async () => {
      const { data, error } = await getSupabase().from('user_roles').select('user_id').eq('role', 'cashier')
      throwIfError(error)
      return data ?? []
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
    callAlerts: (() => {
      const peopleById = new Map(people.map((person) => [person.id, person]))
      return payments
        .flatMap((payment) => {
          if (payment.status === 'paid' || payment.status === 'waived') return []
          const round = roundById.get(payment.roundId)
          if (!round || round.dueDate >= today) return []
          const person = peopleById.get(payment.personId)
          const scheme = schemeById.get(payment.schemeId)
          const membership = memberships.find(
            (row) =>
              row.status === 'active' &&
              row.schemeId === payment.schemeId &&
              row.personId === payment.personId,
          )
          const cashier = membership?.collectorPersonId
            ? peopleById.get(membership.collectorPersonId)
            : undefined
          return [
            {
              paymentId: payment.id,
              personName: person?.fullName ?? 'Member',
              mobile: person?.mobile ?? '—',
              schemeCode: scheme?.code ?? '—',
              monthNumber: round.monthNumber,
              dueDate: round.dueDate,
              pending: payment.amountDue - payment.amountPaid,
              cashierName: cashier?.fullName ?? null,
            },
          ]
        })
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.personName.localeCompare(b.personName))
    })(),
    upcomingDues,
    collectionByScheme,
    cashierCount: cashierRoles.length,
    unassignedMembers: memberships.filter(
      (membership) => membership.status === 'active' && !membership.collectorPersonId,
    ).length,
    byCashier: (() => {
      const cashierUserIds = new Set(cashierRoles.map((row) => String(row.user_id)))
      const cashiers = people.filter((person) => person.authUserId && cashierUserIds.has(person.authUserId))
      const openRoundIds = new Set(
        rounds.filter((round) => round.status === 'collection_open').map((round) => round.id),
      )
      return cashiers
        .map((cashier) => {
          const assigned = memberships.filter(
            (membership) =>
              membership.status === 'active' && membership.collectorPersonId === cashier.id,
          )
          const assignedPeople = new Set(assigned.map((membership) => `${membership.schemeId}:${membership.personId}`))
          const openPayments = payments.filter(
            (payment) =>
              openRoundIds.has(payment.roundId) &&
              assignedPeople.has(`${payment.schemeId}:${payment.personId}`) &&
              payment.status !== 'waived',
          )
          const dueOpen = openPayments.reduce((sum, payment) => sum + payment.amountDue, 0)
          const collectedOpen = openPayments.reduce((sum, payment) => sum + payment.amountPaid, 0)
          return {
            personId: cashier.id,
            name: cashier.fullName,
            assignedCount: assigned.length,
            dueOpen,
            collectedOpen,
            pendingOpen: dueOpen - collectedOpen,
          }
        })
        .sort((a, b) => a.name.localeCompare(b.name))
    })(),
    recentActivity: logs.map((log) => ({
      id: log.id,
      summary: log.summary,
      createdAt: log.createdAt,
      actorLabel: log.actorLabel,
    })),
  }
}
