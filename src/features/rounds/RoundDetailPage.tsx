import { useLiveQuery } from '@/hooks/useLiveQuery'
import { ArrowLeftIcon } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'

import { Callout } from '@/components/Callout'
import { EmptyState, LoadingState } from '@/components/EmptyState'
import { MoneyText } from '@/components/MoneyText'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { RoundStatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RoundPaymentsTab } from '@/features/payments/RoundPaymentsTab'
import { RoundPayoutTab } from '@/features/payouts/RoundPayoutTab'
import { roundStatusLabels } from '@/lib/constants'
import { formatDisplayDate, formatShortMonth } from '@/lib/dates'
import { formatINR } from '@/domain/money/money'
import { toReadableError } from '@/repositories/errors'
import { membershipsRepository } from '@/repositories/membershipsRepository'
import { nextStatus, roundsRepository } from '@/repositories/roundsRepository'
import { schemesRepository } from '@/repositories/schemesRepository'
import type { RoundStatus } from '@/types/entities'

export function RoundDetailPage() {
  const { schemeId = '', roundId = '' } = useParams()

  const round = useLiveQuery(() => roundsRepository.get(roundId), [roundId])
  const scheme = useLiveQuery(() => schemesRepository.get(schemeId), [schemeId])
  const activeMembers = useLiveQuery(() => membershipsRepository.countActive(schemeId), [schemeId])

  if (round === undefined || scheme === undefined) return <LoadingState label="Loading round…" />
  if (!round || !scheme) {
    return (
      <EmptyState
        title="Round not found"
        action={
          <Button asChild>
            <Link to={`/schemes/${schemeId}`}>Back to scheme</Link>
          </Button>
        }
      />
    )
  }

  const advance = nextStatus(round.status)
  // Fall back to a full roster while loading so the warning never flashes.
  const activeCount = activeMembers ?? scheme.maxMembers
  const shortfall = activeCount < scheme.maxMembers

  async function moveTo(status: RoundStatus) {
    try {
      if (status === 'collection_open') {
        const { obligationsCreated } = await roundsRepository.openCollection(round!.id)
        toast.success(`Collection open — ${obligationsCreated} contributions due`)
        return
      }
      await roundsRepository.setStatus(round!.id, status)
      toast.success(`Round marked ${roundStatusLabels[status].toLowerCase()}`)
    } catch (error) {
      toast.error(toReadableError(error, 'Could not update this round.'))
    }
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to={`/schemes/${schemeId}`}>
          <ArrowLeftIcon /> {scheme.name}
        </Link>
      </Button>

      <PageHeader
        title={formatShortMonth(round.dueDate)}
        description={`${scheme.code} · due ${formatDisplayDate(round.dueDate)}`}
        actions={
          <>
            <RoundStatusBadge status={round.status} />
            {advance && (
              <Button onClick={() => moveTo(advance)}>
                Move to {roundStatusLabels[advance].toLowerCase()}
              </Button>
            )}
          </>
        }
      />

      {shortfall && (
        <Callout tone="warning" className="mb-6">
          Only {activeCount} of {scheme.maxMembers} seats are filled, so this month collects{' '}
          <MoneyText amount={activeCount * scheme.monthlyAmount} /> instead of the{' '}
          <MoneyText amount={round.expectedCollection} /> pool the payout schedule assumes. Assign
          the remaining members to keep the schedule funded.
        </Callout>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Expected pool"
          value={<MoneyText amount={round.expectedCollection} />}
          hint={`${scheme.maxMembers} members × ${formatINR(scheme.monthlyAmount)}`}
        />
        <StatCard
          label="Collected"
          value={<MoneyText amount={round.actualCollection} />}
          tone="success"
        />
        <StatCard
          label="Pending"
          value={<MoneyText amount={round.pendingAmount} />}
          tone="warning"
        />
        <StatCard
          label="Scheduled payout"
          value={<MoneyText amount={round.plannedPayoutAmount} />}
          hint={
            round.plannedPayoutAmount < round.expectedCollection
              ? 'Early withdrawal — lower amount'
              : round.plannedPayoutAmount > round.expectedCollection
                ? 'Later withdrawal — higher amount'
                : 'Equal to the pool'
          }
        />
      </div>

      <Tabs defaultValue="payments">
        <TabsList>
          <TabsTrigger value="payments">Contributions</TabsTrigger>
          <TabsTrigger value="payout">Payout</TabsTrigger>
        </TabsList>

        <TabsContent value="payments">
          <RoundPaymentsTab round={round} />
        </TabsContent>

        <TabsContent value="payout">
          <RoundPayoutTab round={round} scheme={scheme} />
        </TabsContent>
      </Tabs>
    </>
  )
}
