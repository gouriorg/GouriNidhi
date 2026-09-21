import { useLiveQuery } from '@/hooks/useLiveQuery'
import { CalendarClockIcon, ChevronRightIcon } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { EmptyState, LoadingState } from '@/components/EmptyState'
import { MoneyText } from '@/components/MoneyText'
import { RoundStatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { peopleRepository } from '@/repositories/peopleRepository'
import { roundsRepository } from '@/repositories/roundsRepository'
import { formatDisplayDate } from '@/lib/dates'
import { toReadableError } from '@/repositories/errors'
import { schemesRepository } from '@/repositories/schemesRepository'
import type { Scheme } from '@/types/entities'

export function SchemeRoundsTab({ scheme }: { scheme: Scheme }) {
  const rounds = useLiveQuery(async () => {
    const rows = await roundsRepository.listForScheme(scheme.id)
    const ids = rows.map((round) => round.recipientPersonId).filter((id): id is string => Boolean(id))
    const people = await Promise.all(ids.map((id) => peopleRepository.get(id)))
    const nameById = new Map(people.filter(Boolean).map((person) => [person!.id, person!.fullName]))
    return rows.map((round) => ({
      ...round,
      recipientName: round.recipientPersonId
        ? (nameById.get(round.recipientPersonId) ?? 'Unknown')
        : undefined,
    }))
  }, [scheme.id])

  async function generate() {
    try {
      const created = await schemesRepository.generateMissingRounds(scheme.id)
      toast.success(`Generated ${created} rounds`)
    } catch (error) {
      toast.error(toReadableError(error, 'Could not generate rounds.'))
    }
  }

  async function openCollection(roundId: string) {
    try {
      const { obligationsCreated } = await roundsRepository.openCollection(roundId)
      toast.success(`Collection open — ${obligationsCreated} contributions due`)
    } catch (error) {
      toast.error(toReadableError(error, 'Could not open collection.'))
    }
  }

  if (rounds === undefined) return <LoadingState label="Loading rounds…" />

  if (rounds.length === 0) {
    return (
      <EmptyState
        icon={CalendarClockIcon}
        title="No rounds yet"
        description={
          scheme.status === 'draft'
            ? `Activating this scheme creates all ${scheme.durationMonths} monthly rounds from the payout schedule.`
            : 'This active scheme has no rounds. Generate them from the saved schedule.'
        }
        action={
          scheme.status !== 'draft' ? <Button onClick={generate}>Generate rounds</Button> : undefined
        }
      />
    )
  }

  return (
    <>
      <Card className="hidden py-0 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Month</TableHead>
              <TableHead>Due date</TableHead>
              <TableHead className="text-right">Expected</TableHead>
              <TableHead className="text-right">Collected</TableHead>
              <TableHead className="text-right">Payout</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rounds.map((round) => (
              <TableRow key={round.id}>
                <TableCell className="tabular font-medium">{round.monthNumber}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDisplayDate(round.dueDate)}
                </TableCell>
                <TableCell className="text-right">
                  <MoneyText amount={round.expectedCollection} />
                </TableCell>
                <TableCell className="text-right">
                  <MoneyText amount={round.actualCollection} />
                </TableCell>
                <TableCell className="text-right font-semibold">
                  <MoneyText amount={round.plannedPayoutAmount} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {round.recipientName ?? '—'}
                </TableCell>
                <TableCell>
                  <RoundStatusBadge status={round.status} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {round.status === 'upcoming' && (
                      <Button size="sm" variant="outline" onClick={() => openCollection(round.id)}>
                        Open collection
                      </Button>
                    )}
                    <Button asChild size="sm" variant="ghost">
                      <Link to={`/schemes/${scheme.id}/rounds/${round.id}`}>
                        Open <ChevronRightIcon />
                      </Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="grid gap-3 md:hidden">
        {rounds.map((round) => (
          <Card key={round.id} className="gap-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">Month {round.monthNumber}</p>
                <p className="text-muted-foreground text-xs">{formatDisplayDate(round.dueDate)}</p>
              </div>
              <RoundStatusBadge status={round.status} />
            </div>
            <div className="text-muted-foreground grid grid-cols-2 gap-1 text-xs">
              <span>
                Collected <MoneyText amount={round.actualCollection} className="text-foreground" />
              </span>
              <span className="text-right">
                of <MoneyText amount={round.expectedCollection} />
              </span>
              <span>
                Payout{' '}
                <MoneyText amount={round.plannedPayoutAmount} className="text-foreground font-semibold" />
              </span>
              <span className="text-right">{round.recipientName ?? 'No recipient'}</span>
            </div>
            <div className="mt-2 flex gap-2">
              {round.status === 'upcoming' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => openCollection(round.id)}
                >
                  Open collection
                </Button>
              )}
              <Button asChild size="sm" className="flex-1">
                <Link to={`/schemes/${scheme.id}/rounds/${round.id}`}>Open round</Link>
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </>
  )
}
