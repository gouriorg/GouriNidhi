import { buildFixedProfitSchedule } from '@/domain/distribution/fixedProfitSchedule'
import { newId, nowIso } from '@/lib/id'
import type { Round, Scheme } from '@/types/entities'

/**
 * One round per month of the scheme, seeded from the saved payout schedule.
 * `plannedPayoutAmount` is copied straight from the schedule, so an admin never
 * has to type the winner's amount by hand.
 */
export function generateRoundsForScheme(scheme: Scheme): Round[] {
  const lines =
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

  const timestamp = nowIso()
  const expectedCollection = scheme.monthlyAmount * scheme.maxMembers

  return lines.map((line) => ({
    id: newId(),
    schemeId: scheme.id,
    monthNumber: line.monthNumber,
    dueDate: line.dueDate,
    expectedCollection,
    actualCollection: 0,
    // Nothing is owed until collection opens and obligations are created.
    pendingAmount: 0,
    plannedPayoutAmount: line.plannedPayoutAmount,
    status: 'upcoming' as const,
    createdAt: timestamp,
    updatedAt: timestamp,
  }))
}
