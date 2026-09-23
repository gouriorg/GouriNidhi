import { useLiveQuery } from '@/hooks/useLiveQuery'
import { AlertTriangleIcon, InfoIcon, PlusIcon, TrophyIcon, XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { LoadingState } from '@/components/EmptyState'
import { MoneyText } from '@/components/MoneyText'
import { PayoutStatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatShortMonth, todayIso } from '@/lib/dates'
import { membershipsRepository } from '@/repositories/membershipsRepository'
import { payoutsRepository } from '@/repositories/payoutsRepository'
import { roundsRepository } from '@/repositories/roundsRepository'
import { toReadableError } from '@/repositories/errors'
import type { PaymentMethod, Payout, Round, Scheme } from '@/types/entities'

export function RoundPayoutTab({ round, scheme }: { round: Round; scheme: Scheme }) {
  const data = useLiveQuery(async () => {
    const [winners, roster, allPayouts] = await Promise.all([
      payoutsRepository.listForRound(round.id),
      membershipsRepository.listForSchemeWithPeople(scheme.id),
      payoutsRepository.listForScheme(scheme.id),
    ])
    const alreadyWon = new Set(
      allPayouts.filter((payout) => payout.roundId !== round.id).map((payout) => payout.personId),
    )
    const plannedTotal = (await roundsRepository.listForScheme(scheme.id)).reduce(
      (sum, item) => sum + item.plannedPayoutAmount,
      0,
    )
    const actualTotal = allPayouts.reduce((sum, payout) => sum + payout.payoutAmount, 0)
    return {
      winners,
      roster: roster.filter((row) => row.status === 'active'),
      alreadyWon,
      plannedTotal,
      actualTotal,
    }
  }, [round.id, scheme.id])

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [payTarget, setPayTarget] = useState<Payout | null>(null)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [paidDate, setPaidDate] = useState(todayIso())

  useEffect(() => {
    if (!data) return
    setSelectedIds(data.winners.map((row) => row.personId))
  }, [round.id, data?.winners.map((row) => row.personId).join(',')])

  if (data === undefined) return <LoadingState label="Loading payout…" />

  const { winners, roster, alreadyWon, plannedTotal, actualTotal } = data

  const locked = round.status === 'closed'

  function toggleWinner(personId: string) {
    const paid = winners.some((row) => row.personId === personId && row.status === 'paid')
    if (paid) return
    setSelectedIds((current) =>
      current.includes(personId) ? current.filter((id) => id !== personId) : [...current, personId],
    )
  }

  async function saveWinners() {
    if (selectedIds.length === 0) {
      toast.error('Choose at least one member for this month.')
      return
    }
    try {
      await payoutsRepository.saveWinners(round.id, selectedIds)
      toast.success(
        selectedIds.length === 1 ? 'Winner saved' : `${selectedIds.length} winners saved`,
      )
    } catch (error) {
      toast.error(toReadableError(error, 'Could not save the winners.'))
    }
  }

  async function removeWinner(payout: Payout) {
    try {
      await payoutsRepository.remove(payout.id)
      setSelectedIds((current) => current.filter((id) => id !== payout.personId))
      toast.success('Winner removed')
    } catch (error) {
      toast.error(toReadableError(error, 'Could not remove this winner.'))
    }
  }

  async function markPaid() {
    if (!payTarget) return
    try {
      await payoutsRepository.save({
        roundId: round.id,
        personId: payTarget.personId,
        payoutAmount: payTarget.payoutAmount,
        autoCalculated: payTarget.autoCalculated,
        paidDate,
        method,
        markPaid: true,
      })
      toast.success('Payout recorded as paid')
    } catch (error) {
      toast.error(toReadableError(error, 'Could not mark this payout paid.'))
    }
  }

  const sharePreview =
    selectedIds.length > 0 ? Math.floor(round.plannedPayoutAmount / selectedIds.length) : 0

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
      <Card>
        <CardHeader>
          <CardTitle>{formatShortMonth(round.dueDate)} winners</CardTitle>
          <CardDescription>
            Choose one or more members for this month. The scheduled Get Amount is split between
            them when you save.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-2">
            <p className="text-sm font-medium">Who takes this month?</p>
            {roster.length === 0 ? (
              <p className="text-muted-foreground text-sm">No active members in this scheme.</p>
            ) : (
              <div className="grid gap-1">
                {roster.map((row) => {
                  const checked = selectedIds.includes(row.personId)
                  const prior = alreadyWon.has(row.personId)
                  const paidHere = winners.some(
                    (payout) => payout.personId === row.personId && payout.status === 'paid',
                  )
                  return (
                    <label
                      key={row.personId}
                      className="hover:bg-muted/60 flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="accent-primary mt-0.5 size-4"
                        checked={checked}
                        disabled={locked || paidHere}
                        onChange={() => toggleWinner(row.personId)}
                      />
                      <span>
                        #{row.memberNumber} {row.person.fullName}
                        {prior ? (
                          <span className="text-muted-foreground block text-xs">
                            Already received a payout in this scheme
                          </span>
                        ) : null}
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
            {selectedIds.some((id) => alreadyWon.has(id)) && (
              <p className="text-warning-foreground flex gap-2 text-xs">
                <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
                A selected member already received a payout. You can still continue.
              </p>
            )}
          </div>

          <div className="bg-muted/50 grid gap-2 rounded-lg p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Scheduled Get Amount</span>
              <MoneyText amount={round.plannedPayoutAmount} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Winners selected</span>
              <span className="tabular">{selectedIds.length}</span>
            </div>
            {selectedIds.length > 1 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Each receives about</span>
                <MoneyText amount={sharePreview} />
              </div>
            )}
          </div>

          {!locked && (
            <Button onClick={() => void saveWinners()} disabled={selectedIds.length === 0}>
              <PlusIcon /> Save winners
            </Button>
          )}

          {winners.length > 0 && (
            <div className="grid gap-2">
              <p className="text-sm font-medium">Saved for this month</p>
              {winners.map((payout) => {
                const member = roster.find((row) => row.personId === payout.personId)
                return (
                  <div
                    key={payout.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {member?.person.fullName ?? 'Member'}
                      </p>
                      <MoneyText amount={payout.payoutAmount} className="text-muted-foreground text-xs" />
                    </div>
                    <div className="flex items-center gap-2">
                      <PayoutStatusBadge status={payout.status} />
                      {!locked && payout.status !== 'paid' && (
                        <>
                          <Button size="sm" onClick={() => setPayTarget(payout)}>
                            <TrophyIcon /> Mark paid
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void removeWinner(payout)}
                            aria-label="Remove winner"
                          >
                            <XIcon />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid content-start gap-4">
        <Card className="gap-2 p-5 text-sm">
          <p className="font-semibold">Scheme running total</p>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Planned payouts</span>
            <MoneyText amount={plannedTotal} />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Recorded payouts</span>
            <MoneyText amount={actualTotal} />
          </div>
          <p className="text-muted-foreground mt-2 flex gap-2 text-xs">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
            Multiple winners split this month’s Get Amount. The scheme total should still stay close
            to what is collected.
          </p>
        </Card>
      </div>

      <ConfirmDialog
        open={Boolean(payTarget)}
        onOpenChange={(open) => {
          if (!open) setPayTarget(null)
        }}
        title="Confirm this payout"
        description={
          <span>
            Paying{' '}
            <strong>
              {roster.find((row) => row.personId === payTarget?.personId)?.person.fullName ??
                'this member'}
            </strong>{' '}
            for {formatShortMonth(round.dueDate)}.
          </span>
        }
        confirmLabel="Mark paid"
        onConfirm={markPaid}
      >
        <div className="grid gap-3">
          <div className="bg-muted/50 flex items-center justify-between rounded-lg p-4">
            <span className="text-sm">Amount</span>
            <MoneyText amount={payTarget?.payoutAmount ?? 0} className="text-lg font-bold" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="winner-method">Method</Label>
            <Select value={method} onValueChange={(value) => setMethod(value as PaymentMethod)}>
              <SelectTrigger id="winner-method" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="winner-paid-date">Date paid</Label>
            <Input
              id="winner-paid-date"
              type="date"
              value={paidDate}
              onChange={(event) => setPaidDate(event.target.value)}
            />
          </div>
        </div>
      </ConfirmDialog>
    </div>
  )
}
