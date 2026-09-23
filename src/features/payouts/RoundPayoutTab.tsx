import { useLiveQuery } from '@/hooks/useLiveQuery'
import { AlertTriangleIcon, InfoIcon, TrophyIcon } from 'lucide-react'
import { useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { roundsRepository } from '@/repositories/roundsRepository'
import { getDistributionStrategy } from '@/domain/distribution/registry'
import { fromRupees, toRupees } from '@/domain/money/money'
import { paymentMethodLabels } from '@/lib/constants'
import { formatShortMonth, todayIso } from '@/lib/dates'
import { membershipsRepository } from '@/repositories/membershipsRepository'
import { payoutsRepository } from '@/repositories/payoutsRepository'
import { toReadableError } from '@/repositories/errors'
import type { PaymentMethod, Round, Scheme } from '@/types/entities'

export function RoundPayoutTab({ round, scheme }: { round: Round; scheme: Scheme }) {
  const data = useLiveQuery(async () => {
    const [payout, roster, allPayouts] = await Promise.all([
      payoutsRepository.getForRound(round.id),
      membershipsRepository.listForSchemeWithPeople(scheme.id),
      payoutsRepository.listForScheme(scheme.id),
    ])
    const alreadyWon = new Set(
      allPayouts.filter((p) => p.roundId !== round.id).map((p) => p.personId),
    )
    const plannedTotal = (await roundsRepository.listForScheme(scheme.id)).reduce(
      (sum, r) => sum + r.plannedPayoutAmount,
      0,
    )
    const actualTotal = allPayouts.reduce((sum, p) => sum + p.payoutAmount, 0)
    return { payout, roster: roster.filter((r) => r.status === 'active'), alreadyWon, plannedTotal, actualTotal }
  }, [round.id, scheme.id])

  const [personId, setPersonId] = useState<string>('')
  const [override, setOverride] = useState(false)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [paidDate, setPaidDate] = useState(todayIso())
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [hydratedFor, setHydratedFor] = useState<string | null>(null)

  if (data === undefined) return <LoadingState label="Loading payout…" />

  const { payout, roster, alreadyWon, plannedTotal, actualTotal } = data

  // Prefill once per round from whatever is already saved.
  if (hydratedFor !== round.id) {
    setHydratedFor(round.id)
    setPersonId(payout?.personId ?? round.recipientPersonId ?? '')
    setOverride(payout ? !payout.autoCalculated : false)
    setAmount(String(toRupees(payout?.payoutAmount ?? round.plannedPayoutAmount)))
    setMethod(payout?.method ?? 'cash')
    setPaidDate(payout?.paidDate ?? todayIso())
    setReference(payout?.reference ?? '')
    setNotes(payout?.notes ?? '')
  }

  const locked = round.status === 'closed'
  const strategy = getDistributionStrategy(override ? 'manual' : 'fixed_profit')
  const overrideAmount = override && amount ? fromRupees(Number(amount) || 0) : undefined
  const effectiveAmount = override
    ? (overrideAmount ?? round.plannedPayoutAmount)
    : round.plannedPayoutAmount
  const duplicateWinner = personId !== '' && alreadyWon.has(personId)
  const isFirstMonth = round.monthNumber === 1
  const isLastMonth = round.monthNumber === scheme.durationMonths

  async function save(markPaid: boolean) {
    if (!personId) {
      toast.error('Choose who receives this month\u2019s payout.')
      return
    }

    if (override) {
      const check = strategy.validate({
        grossPool: round.expectedCollection,
        profitBps: scheme.profitBps,
        memberCount: scheme.maxMembers,
        durationMonths: scheme.durationMonths,
        monthNumber: round.monthNumber,
        overrideAmount,
      })
      if (!check.ok) {
        toast.error(check.message)
        return
      }
    }

    try {
      await payoutsRepository.save({
        roundId: round.id,
        personId,
        payoutAmount: effectiveAmount,
        autoCalculated: !override,
        paidDate,
        method,
        reference,
        notes,
        markPaid,
      })
      toast.success(markPaid ? 'Payout recorded as paid' : 'Recipient saved')
    } catch (error) {
      toast.error(toReadableError(error, 'Could not save this payout.'))
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
      <Card>
        <CardHeader>
          <CardTitle>{formatShortMonth(round.dueDate)} payout</CardTitle>
          <CardDescription>
            {isFirstMonth
              ? `${formatShortMonth(round.dueDate)} is an early withdrawal, so it pays the lowest amount of the whole scheme.`
              : isLastMonth
                ? `${formatShortMonth(round.dueDate)} is the final month, so it pays the highest amount of the whole scheme.`
                : 'Amounts rise every month: earlier withdrawals receive less, later ones receive more.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="recipient">Who withdrew this month?</Label>
            <Select value={personId} onValueChange={setPersonId} disabled={locked}>
              <SelectTrigger id="recipient" className="w-full">
                <SelectValue placeholder="Choose a member" />
              </SelectTrigger>
              <SelectContent>
                {roster.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No active members in this scheme
                  </SelectItem>
                ) : (
                  roster.map((row) => (
                    <SelectItem key={row.personId} value={row.personId}>
                      #{row.memberNumber} {row.person.fullName}
                      {alreadyWon.has(row.personId) ? ' — already received' : ''}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {duplicateWinner && (
              <p className="text-warning-foreground flex gap-2 text-xs">
                <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
                This member already received a payout in this scheme. Normally each member takes one
                month. You can still continue.
              </p>
            )}
          </div>

          <div className="bg-muted/50 grid gap-2 rounded-lg p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Monthly pool</span>
              <MoneyText amount={round.expectedCollection} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {round.plannedPayoutAmount < round.expectedCollection
                  ? 'Early withdrawal discount'
                  : 'Late withdrawal bonus'}
              </span>
              <MoneyText
                amount={round.plannedPayoutAmount - round.expectedCollection}
                signed
                colored
              />
            </div>
            <div className="border-border mt-1 flex items-center justify-between border-t pt-2 text-base font-semibold">
              <span>Scheduled payout</span>
              <MoneyText amount={round.plannedPayoutAmount} />
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="accent-primary mt-0.5 size-4"
              checked={override}
              disabled={locked}
              onChange={(event) => {
                setOverride(event.target.checked)
                if (!event.target.checked) setAmount(String(toRupees(round.plannedPayoutAmount)))
              }}
            />
            <span>
              Pay a different amount this month
              <span className="text-muted-foreground block text-xs">
                Overrides only this month. The rest of the schedule is unchanged.
              </span>
            </span>
          </label>

          {override && (
            <div className="grid gap-2">
              <Label htmlFor="payoutAmount">Amount to pay (₹)</Label>
              <Input
                id="payoutAmount"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                disabled={locked}
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="payout-method">Method</Label>
              <Select
                value={method}
                onValueChange={(value) => setMethod(value as PaymentMethod)}
                disabled={locked}
              >
                <SelectTrigger id="payout-method" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(paymentMethodLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="payout-date">Date paid</Label>
              <Input
                id="payout-date"
                type="date"
                value={paidDate}
                onChange={(event) => setPaidDate(event.target.value)}
                disabled={locked}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="payout-reference">Reference (optional)</Label>
            <Input
              id="payout-reference"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              disabled={locked}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="payout-notes">
              Notes {override && <span className="text-muted-foreground">(reason for override)</span>}
            </Label>
            <Textarea
              id="payout-notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={locked}
            />
          </div>

          {!locked && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => save(false)} disabled={!personId}>
                Save recipient
              </Button>
              <Button onClick={() => setConfirmOpen(true)} disabled={!personId}>
                <TrophyIcon /> Mark paid
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid content-start gap-4">
        {payout && (
          <Card className="gap-3 p-5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Recorded payout</span>
              <PayoutStatusBadge status={payout.status} />
            </div>
            <MoneyText amount={payout.payoutAmount} className="text-2xl font-bold" />
            {!payout.autoCalculated && (
              <p className="text-warning-foreground text-xs">Manual amount, not the schedule.</p>
            )}
          </Card>
        )}

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
            Keep these close together. Overriding amounts can make the scheme pay out more than it
            collects.
          </p>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirm this payout"
        description={
          <span>
            Paying{' '}
            <strong>
              {roster.find((r) => r.personId === personId)?.person.fullName ?? 'this member'}
            </strong>{' '}
            for {formatShortMonth(round.dueDate)}. This marks the round as payout complete.
          </span>
        }
        confirmLabel="Mark paid"
        onConfirm={() => save(true)}
      >
        <div className="bg-muted/50 flex items-center justify-between rounded-lg p-4">
          <span className="text-sm">Amount</span>
          <MoneyText amount={effectiveAmount} className="text-lg font-bold" />
        </div>
      </ConfirmDialog>
    </div>
  )
}
