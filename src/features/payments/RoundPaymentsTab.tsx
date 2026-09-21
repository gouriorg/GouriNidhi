import { useLiveQuery } from '@/hooks/useLiveQuery'
import { BanknoteIcon, CheckCheckIcon, RotateCcwIcon, WalletIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState, LoadingState } from '@/components/EmptyState'
import { MoneyText } from '@/components/MoneyText'
import { PaymentStatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { fromRupees, toRupees } from '@/domain/money/money'
import { paymentMethodLabels } from '@/lib/constants'
import { todayIso } from '@/lib/dates'
import { toReadableError } from '@/repositories/errors'
import {
  displayStatus,
  paymentsRepository,
  type PaymentWithPerson,
} from '@/repositories/paymentsRepository'
import type { PaymentMethod, Round } from '@/types/entities'

export function RoundPaymentsTab({ round }: { round: Round }) {
  const [recordTarget, setRecordTarget] = useState<PaymentWithPerson | null>(null)
  const [waiveTarget, setWaiveTarget] = useState<PaymentWithPerson | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)

  const payments = useLiveQuery(
    () => paymentsRepository.listForRoundWithPeople(round.id),
    [round.id],
  )

  if (payments === undefined) return <LoadingState label="Loading contributions…" />

  if (payments.length === 0) {
    return (
      <EmptyState
        icon={WalletIcon}
        title="No contributions due yet"
        description="Open collection on this round to create one pending contribution for every active member."
      />
    )
  }

  async function reset(paymentId: string) {
    try {
      await paymentsRepository.reset(paymentId)
      toast.success('Contribution reset to pending')
    } catch (error) {
      toast.error(toReadableError(error, 'Could not reset this contribution.'))
    }
  }

  async function waive(paymentId: string) {
    try {
      await paymentsRepository.waive(paymentId)
      toast.success('Contribution waived')
    } catch (error) {
      toast.error(toReadableError(error, 'Could not waive this contribution.'))
    }
  }

  async function markAllPaid() {
    try {
      const { settled } = await paymentsRepository.recordAllOutstanding(round.id)
      toast.success(`Marked ${settled} contribution(s) paid`)
    } catch (error) {
      toast.error(toReadableError(error, 'Could not settle these contributions.'))
    }
  }

  const locked = round.status === 'closed'
  const outstanding = payments.filter(
    (payment) => payment.status !== 'paid' && payment.status !== 'waived',
  )
  const settledCount = payments.length - outstanding.length

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          <span className="text-foreground font-semibold">
            {settledCount}/{payments.length}
          </span>{' '}
          settled
          {outstanding.length > 0 && (
            <>
              {' · '}
              <MoneyText
                amount={outstanding.reduce(
                  (sum, payment) => sum + (payment.amountDue - payment.amountPaid),
                  0,
                )}
              />{' '}
              still to collect
            </>
          )}
        </p>
        {!locked && outstanding.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>
            <CheckCheckIcon /> Mark all paid
          </Button>
        )}
      </div>

      <Card className="hidden py-0 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead className="text-right">Due</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="font-medium">{payment.person?.fullName ?? '—'}</TableCell>
                <TableCell className="text-right">
                  <MoneyText amount={payment.amountDue} />
                </TableCell>
                <TableCell className="text-right">
                  <MoneyText amount={payment.amountPaid} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {payment.method ? paymentMethodLabels[payment.method] : '—'}
                </TableCell>
                <TableCell>
                  <PaymentStatusBadge status={displayStatus(payment, round.dueDate)} />
                </TableCell>
                <TableCell className="text-right">
                  {!locked && (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => setRecordTarget(payment)}>
                        <BanknoteIcon /> Record
                      </Button>
                      {payment.status === 'pending' ? (
                        <Button size="sm" variant="ghost" onClick={() => setWaiveTarget(payment)}>
                          Waive
                        </Button>
                      ) : (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Reset to pending"
                          onClick={() => reset(payment.id)}
                        >
                          <RotateCcwIcon />
                        </Button>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="grid gap-3 md:hidden">
        {payments.map((payment) => (
          <Card key={payment.id} className="gap-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{payment.person?.fullName ?? '—'}</p>
                <p className="text-muted-foreground text-xs">
                  <MoneyText amount={payment.amountPaid} className="text-foreground" /> of{' '}
                  <MoneyText amount={payment.amountDue} />
                </p>
              </div>
              <PaymentStatusBadge status={displayStatus(payment, round.dueDate)} />
            </div>
            {!locked && (
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setRecordTarget(payment)}
                >
                  Record payment
                </Button>
                {payment.status === 'pending' ? (
                  <Button size="sm" variant="ghost" onClick={() => setWaiveTarget(payment)}>
                    Waive
                  </Button>
                ) : (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Reset"
                    onClick={() => reset(payment.id)}
                  >
                    <RotateCcwIcon />
                  </Button>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      <RecordPaymentDialog
        payment={recordTarget}
        onOpenChange={(open) => !open && setRecordTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(waiveTarget)}
        onOpenChange={(open) => !open && setWaiveTarget(null)}
        title={`Waive ${waiveTarget?.person?.fullName}'s contribution?`}
        description="A waived contribution counts as settled for closing the round, but is never added to the collected total."
        confirmLabel="Waive"
        onConfirm={async () => {
          if (waiveTarget) await waive(waiveTarget.id)
        }}
      />

      <ConfirmDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title={`Mark ${outstanding.length} contribution(s) as paid?`}
        description={`Each outstanding member will be recorded as paying their full contribution today. Contributions already paid or waived are left alone. You can still correct any individual row afterwards.`}
        confirmLabel="Mark all paid"
        onConfirm={markAllPaid}
      />
    </>
  )
}

function RecordPaymentDialog({
  payment,
  onOpenChange,
}: {
  payment: PaymentWithPerson | null
  onOpenChange: (open: boolean) => void
}) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [paidDate, setPaidDate] = useState(todayIso())
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const open = Boolean(payment)

  // Reset the form each time a different obligation is opened.
  const [lastId, setLastId] = useState<string | null>(null)
  if (payment && payment.id !== lastId) {
    setLastId(payment.id)
    setAmount(String(toRupees(payment.amountPaid > 0 ? payment.amountPaid : payment.amountDue)))
    setMethod(payment.method ?? 'cash')
    setPaidDate(payment.paidDate ?? todayIso())
    setReference(payment.reference ?? '')
    setNotes(payment.notes ?? '')
    setError(null)
  }

  async function submit() {
    if (!payment) return
    const parsed = Number(amount)
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Enter a valid amount.')
      return
    }
    const paise = fromRupees(parsed)
    if (paise > payment.amountDue) {
      setError('Overpayment is not allowed. Enter at most the monthly contribution.')
      return
    }

    setBusy(true)
    try {
      await paymentsRepository.record({
        paymentId: payment.id,
        amountPaid: paise,
        paidDate,
        method,
        reference,
        notes,
      })
      toast.success(`Payment recorded for ${payment.person?.fullName ?? 'member'}`)
      onOpenChange(false)
    } catch (err) {
      const message = toReadableError(err, 'Could not record this payment.')
      setError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            {payment?.person?.fullName} owes{' '}
            {payment && <MoneyText amount={payment.amountDue} />} this month. A smaller amount is
            recorded as a partial payment.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="amount">Amount received (₹)</Label>
            <Input
              id="amount"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              aria-invalid={Boolean(error)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="method">Method</Label>
              <Select value={method} onValueChange={(value) => setMethod(value as PaymentMethod)}>
                <SelectTrigger id="method" className="w-full">
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
              <Label htmlFor="paidDate">Date received</Label>
              <Input
                id="paidDate"
                type="date"
                value={paidDate}
                onChange={(event) => setPaidDate(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="reference">Reference (optional)</Label>
            <Input
              id="reference"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="UPI reference, cheque number…"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="payment-notes">Notes (optional)</Label>
            <Textarea
              id="payment-notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            Save payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
