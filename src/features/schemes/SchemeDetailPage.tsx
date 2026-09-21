import { useLiveQuery } from '@/hooks/useLiveQuery'
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  BanIcon,
  CheckCircle2Icon,
  PencilIcon,
  PlayIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState, LoadingState } from '@/components/EmptyState'
import { MoneyText } from '@/components/MoneyText'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { SchemeStatusBadge } from '@/components/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toReadableError } from '@/repositories/errors'
import { membershipsRepository } from '@/repositories/membershipsRepository'
import { paymentsRepository } from '@/repositories/paymentsRepository'
import { payoutsRepository } from '@/repositories/payoutsRepository'
import { peopleRepository } from '@/repositories/peopleRepository'
import { roundsRepository } from '@/repositories/roundsRepository'
import { schemesRepository } from '@/repositories/schemesRepository'
import { buildFixedProfitSchedule } from '@/domain/distribution/fixedProfitSchedule'
import { SchemeMembersTab } from '@/features/memberships/SchemeMembersTab'
import { SchemeRoundsTab } from '@/features/rounds/SchemeRoundsTab'
import { PayoutScheduleChart } from '@/features/schemes/PayoutScheduleChart'
import {
  PayoutScheduleTable,
  type RecipientLookup,
} from '@/features/schemes/PayoutScheduleTable'
import { distributionModeLabels } from '@/lib/constants'
import { formatDisplayDate } from '@/lib/dates'

export function SchemeDetailPage() {
  const { schemeId = '' } = useParams()
  const [activateOpen, setActivateOpen] = useState(false)
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [reactivateOpen, setReactivateOpen] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)

  const scheme = useLiveQuery(() => schemesRepository.get(schemeId), [schemeId])

  const stats = useLiveQuery(async () => {
    if (!schemeId) return null
    const [memberCount, rounds, payments, payouts] = await Promise.all([
      membershipsRepository.countActive(schemeId),
      roundsRepository.listForScheme(schemeId),
      paymentsRepository.listForScheme(schemeId),
      payoutsRepository.listForScheme(schemeId),
    ])

    const recipientIds = rounds
      .map((round) => round.recipientPersonId)
      .filter((id): id is string => Boolean(id))
    const people = await Promise.all(recipientIds.map((id) => peopleRepository.get(id)))
    const nameById = new Map(people.filter(Boolean).map((p) => [p!.id, p!.fullName]))

    const recipients: RecipientLookup = {}
    for (const round of rounds) {
      if (!round.recipientPersonId) continue
      const payout = payouts.find((p) => p.roundId === round.id)
      recipients[round.monthNumber] = {
        name: nameById.get(round.recipientPersonId) ?? 'Unknown',
        paid: payout?.status === 'paid',
      }
    }

    return {
      memberCount,
      roundCount: rounds.length,
      collected: payments.reduce((sum, p) => sum + p.amountPaid, 0),
      pending: payments
        .filter((p) => p.status !== 'waived')
        .reduce((sum, p) => sum + (p.amountDue - p.amountPaid), 0),
      paidOut: payouts
        .filter((p) => p.status === 'paid')
        .reduce((sum, p) => sum + p.payoutAmount, 0),
      recipients,
    }
  }, [schemeId])

  if (scheme === undefined) return <LoadingState label="Loading scheme…" />
  if (!scheme) {
    return (
      <EmptyState
        title="Scheme not found"
        action={
          <Button asChild>
            <Link to="/schemes">Back to schemes</Link>
          </Button>
        }
      />
    )
  }

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

  const understaffed = (stats?.memberCount ?? 0) < scheme.maxMembers

  async function activate() {
    try {
      const { roundsCreated } = await schemesRepository.activate(scheme!.id)
      toast.success(`${scheme!.code} is active — ${roundsCreated} rounds created`)
    } catch (error) {
      toast.error(toReadableError(error, 'Could not activate this scheme.'))
    }
  }

  async function setStatus(status: 'completed') {
    try {
      await schemesRepository.setStatus(scheme!.id, status)
      toast.success(`Scheme marked ${status}`)
    } catch (error) {
      toast.error(toReadableError(error, 'Could not change the scheme status.'))
    }
  }

  async function deactivate() {
    try {
      await schemesRepository.deactivate(scheme!.id)
      toast.success(`${scheme!.code} is inactive. Nothing was deleted.`)
    } catch (error) {
      toast.error(toReadableError(error, 'Could not deactivate this scheme.'))
    }
  }

  async function reactivate() {
    try {
      const status = await schemesRepository.reactivate(scheme!.id)
      toast.success(
        status === 'draft' ? `${scheme!.code} is a draft again` : `${scheme!.code} is active again`,
      )
    } catch (error) {
      toast.error(toReadableError(error, 'Could not reactivate this scheme.'))
    }
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/schemes">
          <ArrowLeftIcon /> All schemes
        </Link>
      </Button>

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span>{scheme.name}</span>
            <Badge variant="secondary" className="tabular">
              {scheme.code}
            </Badge>
          </span>
        }
        description={`${scheme.maxMembers} members · ${scheme.durationMonths} months · ${scheme.profitBps / 100}% profit`}
        actions={
          <>
            <SchemeStatusBadge status={scheme.status} />
            {scheme.status !== 'completed' && scheme.status !== 'cancelled' && (
              <Button asChild variant="outline">
                <Link to={`/schemes/${scheme.id}/edit`}>
                  <PencilIcon /> Edit
                </Link>
              </Button>
            )}
            {scheme.status === 'draft' && (
              <Button onClick={() => setActivateOpen(true)}>
                <PlayIcon /> Activate
              </Button>
            )}
            {scheme.status === 'active' && (
              <Button variant="outline" onClick={() => setCompleteOpen(true)}>
                <CheckCircle2Icon /> Complete
              </Button>
            )}
            {(scheme.status === 'draft' || scheme.status === 'active') && (
              <Button variant="outline" onClick={() => setDeactivateOpen(true)}>
                <BanIcon /> Deactivate
              </Button>
            )}
            {scheme.status === 'cancelled' && (
              <Button onClick={() => setReactivateOpen(true)}>
                <PlayIcon /> Reactivate
              </Button>
            )}
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Monthly contribution"
          value={<MoneyText amount={scheme.monthlyAmount} />}
          hint="Paid by every member"
        />
        <StatCard
          label="Monthly pool"
          value={<MoneyText amount={scheme.monthlyAmount * scheme.maxMembers} />}
          hint="Collected each month"
        />
        <StatCard
          label="Collected so far"
          value={<MoneyText amount={stats?.collected ?? 0} />}
          tone="success"
        />
        <StatCard
          label="Paid out"
          value={<MoneyText amount={stats?.paidOut ?? 0} />}
          hint={`${stats?.memberCount ?? 0}/${scheme.maxMembers} members assigned`}
        />
      </div>

      <Tabs defaultValue="schedule">
        <TabsList>
          <TabsTrigger value="schedule">Payout schedule</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="rounds">Rounds</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="grid gap-4">
          <Card className="gap-4">
            <CardHeader>
              <CardTitle>Monthly payouts</CardTitle>
              <CardDescription>
                One member is paid each month. Whoever withdraws earlier receives less; the last
                month receives the most. Everyone still contributes{' '}
                <MoneyText amount={scheme.monthlyAmount} /> every month.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PayoutScheduleChart lines={schedule} />
            </CardContent>
          </Card>
          <PayoutScheduleTable lines={schedule} recipients={stats?.recipients} />
        </TabsContent>

        <TabsContent value="members">
          <SchemeMembersTab scheme={scheme} />
        </TabsContent>

        <TabsContent value="rounds">
          <SchemeRoundsTab scheme={scheme} />
        </TabsContent>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Scheme details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Detail label="Code" value={scheme.code} />
              <Detail label="Status" value={<SchemeStatusBadge status={scheme.status} />} />
              <Detail label="Start date" value={formatDisplayDate(scheme.startDate)} />
              <Detail label="Collection day" value={`Day ${scheme.collectionDay} of each month`} />
              <Detail label="Members" value={String(scheme.maxMembers)} />
              <Detail label="Duration" value={`${scheme.durationMonths} months`} />
              <Detail label="Profit" value={`${scheme.profitBps / 100}%`} />
              <Detail
                label="Distribution"
                value={distributionModeLabels[scheme.distributionMode]}
              />
              <Detail label="Description" value={scheme.description || '—'} />
              <Detail label="Notes" value={scheme.notes || '—'} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={activateOpen}
        onOpenChange={setActivateOpen}
        title={`Activate ${scheme.code}?`}
        description={
          <span className="grid gap-2">
            <span>
              This creates all {scheme.durationMonths} monthly rounds from the payout schedule and
              locks the financial inputs: member count, monthly contribution, duration, start date
              and profit can no longer change.
            </span>
            {understaffed && (
              <span className="text-warning-foreground flex gap-2">
                <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
                Only {stats?.memberCount ?? 0} of {scheme.maxMembers} members are assigned. The
                schedule still uses the planned {scheme.maxMembers}.
              </span>
            )}
          </span>
        }
        confirmLabel="Activate scheme"
        onConfirm={activate}
      />

      <ConfirmDialog
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        title={`Mark ${scheme.code} completed?`}
        description="Every round must already be closed. A completed scheme becomes read-only."
        confirmLabel="Mark completed"
        onConfirm={() => setStatus('completed')}
      />

      <ConfirmDialog
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        title={`Deactivate ${scheme.code}?`}
        description="The scheme stays in GouriNidhi as Inactive. Members, rounds, payments and payouts are kept. Nothing is deleted."
        confirmLabel="Deactivate scheme"
        onConfirm={deactivate}
      />

      <ConfirmDialog
        open={reactivateOpen}
        onOpenChange={setReactivateOpen}
        title={`Reactivate ${scheme.code}?`}
        description="If this scheme already has rounds it becomes Active again. If it never ran it returns to Draft."
        confirmLabel="Reactivate scheme"
        onConfirm={reactivate}
      />
    </>
  )
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  )
}
