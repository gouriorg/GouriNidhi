import { formatRupeesPlain } from '@/domain/money/money'
import { todayIso } from '@/lib/dates'
import { paymentMethodLabels, paymentStatusLabels, payoutStatusLabels } from '@/lib/constants'
import {
  mapPayment,
  mapPayout,
  mapPerson,
  mapRound,
  mapScheme,
  throwIfError,
} from '@/lib/mappers'
import { getSupabase } from '@/lib/supabase'
import type { Paise } from '@/domain/money/money'
import type { Payment, Payout, Person, Round, Scheme } from '@/types/entities'

async function loadCore(): Promise<{
  payments: Payment[]
  payouts: Payout[]
  rounds: Round[]
  schemes: Scheme[]
  people: Person[]
}> {
  const supabase = getSupabase()
  const [payments, payouts, rounds, schemes, people] = await Promise.all([
    supabase.from('payments').select('*'),
    supabase.from('payouts').select('*'),
    supabase.from('rounds').select('*'),
    supabase.from('schemes').select('*'),
    supabase.from('people').select('*'),
  ])
  throwIfError(payments.error)
  throwIfError(payouts.error)
  throwIfError(rounds.error)
  throwIfError(schemes.error)
  throwIfError(people.error)
  return {
    payments: (payments.data ?? []).map(mapPayment),
    payouts: (payouts.data ?? []).map(mapPayout),
    rounds: (rounds.data ?? []).map(mapRound),
    schemes: (schemes.data ?? []).map(mapScheme),
    people: (people.data ?? []).map(mapPerson),
  }
}

export type ReportFilters = {
  schemeId?: string
  personId?: string
  from?: string
  to?: string
  status?: string
}

export type ReportRow = Record<string, string | number>

export type ReportResult = {
  columns: { key: string; label: string; numeric?: boolean }[]
  rows: ReportRow[]
  totals: { label: string; amount: Paise }[]
}

function inRange(date: string | undefined, filters: ReportFilters): boolean {
  if (!date) return !filters.from && !filters.to
  if (filters.from && date < filters.from) return false
  if (filters.to && date > filters.to) return false
  return true
}

/** Every contribution obligation, one row per member per month. */
export async function collectionReport(filters: ReportFilters): Promise<ReportResult> {
  const today = todayIso()
  const { payments, rounds, schemes, people } = await loadCore()

  const roundById = new Map(rounds.map((r) => [r.id, r]))
  const schemeById = new Map(schemes.map((s) => [s.id, s]))
  const personById = new Map(people.map((p) => [p.id, p]))

  const filtered = payments.filter((payment) => {
    if (filters.schemeId && payment.schemeId !== filters.schemeId) return false
    if (filters.personId && payment.personId !== filters.personId) return false
    const round = roundById.get(payment.roundId)
    if (!inRange(round?.dueDate, filters)) return false
    if (filters.status && filters.status !== 'all') {
      const overdue =
        payment.status !== 'paid' &&
        payment.status !== 'waived' &&
        (round?.dueDate ?? '') < today
      const effective = overdue ? 'overdue' : payment.status
      if (effective !== filters.status) return false
    }
    return true
  })

  const rows: ReportRow[] = filtered
    .map((payment) => {
      const round = roundById.get(payment.roundId)
      const scheme = schemeById.get(payment.schemeId)
      const person = personById.get(payment.personId)
      const overdue =
        payment.status !== 'paid' && payment.status !== 'waived' && (round?.dueDate ?? '') < today
      return {
        scheme: scheme?.code ?? '—',
        month: round?.monthNumber ?? 0,
        dueDate: round?.dueDate ?? '',
        member: person?.fullName ?? '—',
        mobile: person?.mobile ?? '',
        amountDue: formatRupeesPlain(payment.amountDue),
        amountPaid: formatRupeesPlain(payment.amountPaid),
        amountDuePaise: payment.amountDue,
        amountPaidPaise: payment.amountPaid,
        method: payment.method ? paymentMethodLabels[payment.method] : '',
        paidDate: payment.paidDate ?? '',
        status: overdue ? 'Overdue' : paymentStatusLabels[payment.status],
      }
    })
    .sort(
      (a, b) =>
        String(a.scheme).localeCompare(String(b.scheme)) ||
        Number(a.month) - Number(b.month) ||
        String(a.member).localeCompare(String(b.member)),
    )

  const collected = filtered.reduce((sum, p) => sum + p.amountPaid, 0)
  const due = filtered
    .filter((p) => p.status !== 'waived')
    .reduce((sum, p) => sum + p.amountDue, 0)

  return {
    columns: [
      { key: 'scheme', label: 'Scheme' },
      { key: 'month', label: 'Month', numeric: true },
      { key: 'dueDate', label: 'Due date' },
      { key: 'member', label: 'Member' },
      { key: 'mobile', label: 'Mobile' },
      { key: 'amountDue', label: 'Due (₹)', numeric: true },
      { key: 'amountPaid', label: 'Paid (₹)', numeric: true },
      { key: 'amountDuePaise', label: 'Due (paise)', numeric: true },
      { key: 'amountPaidPaise', label: 'Paid (paise)', numeric: true },
      { key: 'method', label: 'Method' },
      { key: 'paidDate', label: 'Paid on' },
      { key: 'status', label: 'Status' },
    ],
    rows,
    totals: [
      { label: 'Total due', amount: due },
      { label: 'Total collected', amount: collected },
      { label: 'Outstanding', amount: due - collected },
    ],
  }
}

/** One row per recorded payout. */
export async function payoutReport(filters: ReportFilters): Promise<ReportResult> {
  const { payouts, rounds, schemes, people } = await loadCore()

  const roundById = new Map(rounds.map((r) => [r.id, r]))
  const schemeById = new Map(schemes.map((s) => [s.id, s]))
  const personById = new Map(people.map((p) => [p.id, p]))

  const filtered = payouts.filter((payout) => {
    if (filters.schemeId && payout.schemeId !== filters.schemeId) return false
    if (filters.personId && payout.personId !== filters.personId) return false
    const round = roundById.get(payout.roundId)
    if (!inRange(round?.dueDate, filters)) return false
    if (filters.status && filters.status !== 'all' && payout.status !== filters.status) return false
    return true
  })

  const rows: ReportRow[] = filtered
    .map((payout) => {
      const round = roundById.get(payout.roundId)
      const scheme = schemeById.get(payout.schemeId)
      const person = personById.get(payout.personId)
      return {
        scheme: scheme?.code ?? '—',
        month: round?.monthNumber ?? 0,
        dueDate: round?.dueDate ?? '',
        member: person?.fullName ?? '—',
        pool: formatRupeesPlain(payout.grossPool),
        adjustment: formatRupeesPlain(payout.adjustment),
        payout: formatRupeesPlain(payout.payoutAmount),
        payoutPaise: payout.payoutAmount,
        calculation: payout.autoCalculated ? 'Auto schedule' : 'Manual override',
        paidDate: payout.paidDate ?? '',
        status: payoutStatusLabels[payout.status],
      }
    })
    .sort(
      (a, b) =>
        String(a.scheme).localeCompare(String(b.scheme)) || Number(a.month) - Number(b.month),
    )

  const paid = filtered
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.payoutAmount, 0)
  const planned = filtered.reduce((sum, p) => sum + p.payoutAmount, 0)

  return {
    columns: [
      { key: 'scheme', label: 'Scheme' },
      { key: 'month', label: 'Month', numeric: true },
      { key: 'dueDate', label: 'Due date' },
      { key: 'member', label: 'Recipient' },
      { key: 'pool', label: 'Pool (₹)', numeric: true },
      { key: 'adjustment', label: 'Adjustment (₹)', numeric: true },
      { key: 'payout', label: 'Payout (₹)', numeric: true },
      { key: 'payoutPaise', label: 'Payout (paise)', numeric: true },
      { key: 'calculation', label: 'Calculation' },
      { key: 'paidDate', label: 'Paid on' },
      { key: 'status', label: 'Status' },
    ],
    rows,
    totals: [
      { label: 'Recorded payouts', amount: planned },
      { label: 'Actually paid', amount: paid },
    ],
  }
}

/** Month-by-month statement of one scheme. */
export async function schemeStatement(filters: ReportFilters): Promise<ReportResult> {
  if (!filters.schemeId) {
    return { columns: [{ key: 'info', label: 'Info' }], rows: [], totals: [] }
  }

  const core = await loadCore()
  const rounds = core.rounds.filter((round) => round.schemeId === filters.schemeId)
  const payments = core.payments.filter((payment) => payment.schemeId === filters.schemeId)
  const payouts = core.payouts.filter((payout) => payout.schemeId === filters.schemeId)
  const people = core.people

  const personById = new Map(people.map((p) => [p.id, p]))

  const rows: ReportRow[] = rounds
    .filter((round) => inRange(round.dueDate, filters))
    .sort((a, b) => a.monthNumber - b.monthNumber)
    .map((round) => {
      const roundPayments = payments.filter((p) => p.roundId === round.id)
      const payout = payouts.find((p) => p.roundId === round.id)
      const collected = roundPayments.reduce((sum, p) => sum + p.amountPaid, 0)
      const pending = roundPayments
        .filter((p) => p.status !== 'waived')
        .reduce((sum, p) => sum + (p.amountDue - p.amountPaid), 0)

      return {
        month: round.monthNumber,
        dueDate: round.dueDate,
        expected: formatRupeesPlain(round.expectedCollection),
        collected: formatRupeesPlain(collected),
        pending: formatRupeesPlain(pending),
        plannedPayout: formatRupeesPlain(round.plannedPayoutAmount),
        actualPayout: payout ? formatRupeesPlain(payout.payoutAmount) : '',
        recipient: payout ? (personById.get(payout.personId)?.fullName ?? '—') : '',
        status: round.status.replace(/_/g, ' '),
      }
    })

  return {
    columns: [
      { key: 'month', label: 'Month', numeric: true },
      { key: 'dueDate', label: 'Due date' },
      { key: 'expected', label: 'Expected (₹)', numeric: true },
      { key: 'collected', label: 'Collected (₹)', numeric: true },
      { key: 'pending', label: 'Pending (₹)', numeric: true },
      { key: 'plannedPayout', label: 'Scheduled payout (₹)', numeric: true },
      { key: 'actualPayout', label: 'Actual payout (₹)', numeric: true },
      { key: 'recipient', label: 'Recipient' },
      { key: 'status', label: 'Status' },
    ],
    rows,
    totals: [
      { label: 'Collected', amount: payments.reduce((sum, p) => sum + p.amountPaid, 0) },
      {
        label: 'Paid out',
        amount: payouts
          .filter((p) => p.status === 'paid')
          .reduce((sum, p) => sum + p.payoutAmount, 0),
      },
    ],
  }
}

/** A single member's position across every scheme. */
export async function memberStatement(filters: ReportFilters): Promise<ReportResult> {
  if (!filters.personId) {
    return { columns: [{ key: 'info', label: 'Info' }], rows: [], totals: [] }
  }

  const core = await loadCore()
  const payments = core.payments.filter((payment) => payment.personId === filters.personId)
  const payouts = core.payouts.filter((payout) => payout.personId === filters.personId)
  const rounds = core.rounds
  const schemes = core.schemes

  const roundById = new Map(rounds.map((r) => [r.id, r]))
  const schemeById = new Map(schemes.map((s) => [s.id, s]))

  const rows: ReportRow[] = payments
    .filter((payment) => {
      if (filters.schemeId && payment.schemeId !== filters.schemeId) return false
      return inRange(roundById.get(payment.roundId)?.dueDate, filters)
    })
    .map((payment) => {
      const round = roundById.get(payment.roundId)
      const payout = payouts.find((p) => p.roundId === payment.roundId)
      return {
        scheme: schemeById.get(payment.schemeId)?.code ?? '—',
        month: round?.monthNumber ?? 0,
        dueDate: round?.dueDate ?? '',
        contributionDue: formatRupeesPlain(payment.amountDue),
        contributionPaid: formatRupeesPlain(payment.amountPaid),
        status: paymentStatusLabels[payment.status],
        payoutReceived: payout ? formatRupeesPlain(payout.payoutAmount) : '',
      }
    })
    .sort(
      (a, b) =>
        String(a.scheme).localeCompare(String(b.scheme)) || Number(a.month) - Number(b.month),
    )

  return {
    columns: [
      { key: 'scheme', label: 'Scheme' },
      { key: 'month', label: 'Month', numeric: true },
      { key: 'dueDate', label: 'Due date' },
      { key: 'contributionDue', label: 'Due (₹)', numeric: true },
      { key: 'contributionPaid', label: 'Paid (₹)', numeric: true },
      { key: 'status', label: 'Status' },
      { key: 'payoutReceived', label: 'Payout received (₹)', numeric: true },
    ],
    rows,
    totals: [
      { label: 'Total paid', amount: payments.reduce((sum, p) => sum + p.amountPaid, 0) },
      {
        label: 'Total received',
        amount: payouts
          .filter((p) => p.status === 'paid')
          .reduce((sum, p) => sum + p.payoutAmount, 0),
      },
    ],
  }
}
