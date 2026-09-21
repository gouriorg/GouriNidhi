import { buildFixedProfitSchedule } from '@/domain/distribution/fixedProfitSchedule'
import { fromRupees } from '@/domain/money/money'
import { generateRoundsForScheme } from '@/domain/rounds/generateRounds'
import { nowIso, newId } from '@/lib/id'
import { paymentToRow, payoutToRow, roundToRow, schemeToRow, throwIfError } from '@/lib/mappers'
import { getSupabase } from '@/lib/supabase'
import { membershipsRepository } from '@/repositories/membershipsRepository'
import { peopleRepository } from '@/repositories/peopleRepository'
import { schemesRepository } from '@/repositories/schemesRepository'
import { auditService } from '@/services/audit'
import { notifyDataChanged } from '@/stores/dataVersion'
import type { Payment, Payout, Person } from '@/types/entities'

/** Canonical fixture from the plan: 20 members × ₹4,000 × 20 months at 10% profit. */
const FIXTURE = {
  maxMembers: 20,
  monthlyRupees: 4000,
  durationMonths: 20,
  profitBps: 1000,
  collectionDay: 1,
  settledMonths: 3,
} as const

const sampleNames = [
  'Ravi Kumar',
  'Lakshmi Devi',
  'Suresh Patil',
  'Anita Sharma',
  'Mahesh Rao',
  'Priya Nair',
  'Venkatesh Iyer',
  'Kavitha Reddy',
  'Ganesh Shetty',
  'Deepa Menon',
  'Arun Joshi',
  'Sunitha Gowda',
  'Manjunath Hegde',
  'Rekha Bhat',
  'Prakash Naik',
  'Shobha Kulkarni',
  'Vinod Desai',
  'Geetha Murthy',
  'Santhosh Pai',
  'Usha Kamath',
]

const sampleAddresses: Record<number, string> = {
  0: '12 MG Road, Bengaluru',
  1: '45 Gandhi Nagar, Mysuru',
  3: '7 Church Street, Bengaluru',
  6: '22 Temple Road, Udupi',
  11: '9 Lake View, Hubballi',
}

function firstOfThisMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

/**
 * Dev-only sample data. Creates real Auth users so members can log in with
 * mobile/mobile. Refuses to run unless there are no people yet.
 */
export async function loadSampleData(): Promise<{
  people: number
  schemes: number
  rounds: number
}> {
  const existing = await peopleRepository.count()
  if (existing > 0) {
    throw new Error('Sample data can only be loaded into an empty app.')
  }

  const timestamp = nowIso()
  const startDate = firstOfThisMonth()
  const monthlyAmount = fromRupees(FIXTURE.monthlyRupees)

  const people: Person[] = []
  for (let index = 0; index < sampleNames.length; index += 1) {
    people.push(
      await peopleRepository.create({
        fullName: sampleNames[index],
        mobile: String(9876543210 + index),
        address: sampleAddresses[index],
      }),
    )
  }

  const schedule = buildFixedProfitSchedule({
    maxMembers: FIXTURE.maxMembers,
    monthlyAmount,
    durationMonths: FIXTURE.durationMonths,
    startDate,
    collectionDay: FIXTURE.collectionDay,
    profitBps: FIXTURE.profitBps,
  })

  const scheme = await schemesRepository.create({
    code: 'GN-SAMPLE',
    name: 'Sample Family Chit',
    description: 'Dev sample data. Safe to delete from Settings.',
    monthlyAmount,
    maxMembers: FIXTURE.maxMembers,
    durationMonths: FIXTURE.durationMonths,
    startDate,
    collectionDay: FIXTURE.collectionDay,
    profitBps: FIXTURE.profitBps,
  })

  const { error: statusError } = await getSupabase()
    .from('schemes')
    .update(
      schemeToRow({
        ...scheme,
        scheduleSnapshot: schedule.lines,
        status: 'active',
        updatedAt: timestamp,
      }),
    )
    .eq('id', scheme.id)
  throwIfError(statusError)

  for (const person of people) {
    await membershipsRepository.add(scheme.id, person.id)
  }

  const activeScheme = { ...scheme, status: 'active' as const, scheduleSnapshot: schedule.lines }
  const rounds = generateRoundsForScheme(activeScheme)
  const payments: Payment[] = []
  const payouts: Payout[] = []

  rounds.forEach((round, roundIndex) => {
    const isSettled = roundIndex < FIXTURE.settledMonths
    const isOpen = roundIndex === FIXTURE.settledMonths
    if (!isSettled && !isOpen) return

    for (const person of people) {
      payments.push({
        id: newId(),
        schemeId: scheme.id,
        roundId: round.id,
        personId: person.id,
        amountDue: monthlyAmount,
        amountPaid: isSettled ? monthlyAmount : 0,
        paidDate: isSettled ? round.dueDate : undefined,
        method: isSettled ? 'upi' : undefined,
        status: isSettled ? 'paid' : 'pending',
        createdAt: timestamp,
        updatedAt: timestamp,
      })
    }

    const collected = isSettled ? monthlyAmount * people.length : 0
    const pending = isSettled ? 0 : monthlyAmount * people.length

    if (isSettled) {
      const winner = people[roundIndex]
      payouts.push({
        id: newId(),
        schemeId: scheme.id,
        roundId: round.id,
        personId: winner.id,
        grossPool: round.expectedCollection,
        adjustment: round.plannedPayoutAmount - round.expectedCollection,
        payoutAmount: round.plannedPayoutAmount,
        autoCalculated: true,
        paidDate: round.dueDate,
        method: 'bank_transfer',
        status: 'paid',
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      round.recipientPersonId = winner.id
      round.status = 'payout_complete'
    } else {
      round.status = 'collection_open'
    }

    round.actualCollection = collected
    round.pendingAmount = pending
  })

  const supabase = getSupabase()
  const { error: roundError } = await supabase.from('rounds').insert(rounds.map(roundToRow))
  throwIfError(roundError)
  if (payments.length > 0) {
    const { error } = await supabase.from('payments').insert(payments.map(paymentToRow))
    throwIfError(error)
  }
  if (payouts.length > 0) {
    const { error } = await supabase.from('payouts').insert(payouts.map(payoutToRow))
    throwIfError(error)
  }

  await auditService.record({
    action: 'settings.sample_data_loaded',
    entityType: 'settings',
    entityId: 'sample',
    summary: `Loaded sample data: ${people.length} members, 1 active scheme, ${rounds.length} rounds`,
  })
  notifyDataChanged()
  return { people: people.length, schemes: 1, rounds: rounds.length }
}
