import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/EmptyState'
import { MoneyText } from '@/components/MoneyText'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { CashierCollectRow, CashierDashboard, CashierMonthCell } from '@/features/dashboard/cashier/cashierDashboardService'
import { formatDisplayDate, formatShortMonth, lastDayOfMonthIso } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { toReadableError } from '@/repositories/errors'
import type { PaymentStatusInput } from '@/repositories/paymentsRepository'
import { AlertTriangleIcon, BanknoteIcon, CalendarCheckIcon, SearchIcon, UsersIcon, WalletIcon } from 'lucide-react'

export function CollectWorkspace({
  title,
  description,
  emptyTitle,
  emptyDescription,
  membersLabel,
  data,
  onSetStatus,
}: {
  title: string
  description: string
  emptyTitle: string
  emptyDescription: string
  membersLabel: string
  data: CashierDashboard
  onSetStatus: (input: PaymentStatusInput) => Promise<void>
}) {
  const [schemeId, setSchemeId] = useState<string>()
  const [memberId, setMemberId] = useState<string>()
  const [query, setQuery] = useState('')
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [payTarget, setPayTarget] = useState<{ row: CashierCollectRow; cell: CashierMonthCell } | null>(null)

  const schemes = useMemo(() => {
    const seen = new Map<string, { id: string; code: string; name: string }>()
    for (const row of data.rows) {
      if (!seen.has(row.scheme.id)) {
        seen.set(row.scheme.id, { id: row.scheme.id, code: row.scheme.code, name: row.scheme.name })
      }
    }
    return [...seen.values()]
  }, [data.rows])

  const activeSchemeId = schemeId && schemes.some((scheme) => scheme.id === schemeId) ? schemeId : schemes[0]?.id
  const members = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return data.rows.filter((row) => {
      if (row.scheme.id !== activeSchemeId) return false
      if (!needle) return true
      return (
        row.person.fullName.toLowerCase().includes(needle) ||
        row.person.mobile.includes(needle)
      )
    })
  }, [data.rows, activeSchemeId, query])
  const activeMemberId =
    memberId && members.some((row) => row.membership.id === memberId) ? memberId : members[0]?.membership.id

  async function setUnpaid(row: CashierCollectRow, cell: CashierMonthCell) {
    if (!cell.payment || cell.payment.status !== 'paid') return
    const key = `${row.membership.id}:${cell.round.id}`
    setBusyKey(key)
    try {
      await onSetStatus({
        schemeId: row.scheme.id,
        roundId: cell.round.id,
        personId: row.person.id,
        paid: false,
      })
      toast.success(`${row.person.fullName} · ${formatShortMonth(cell.round.dueDate)} unpaid`)
    } catch (error) {
      toast.error(toReadableError(error, 'Could not update this month.'))
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label={membersLabel} value={data.assignedCount} icon={UsersIcon} />
        <StatCard
          label="Collected (due now)"
          value={<MoneyText amount={data.collectedOpen} />}
          tone="success"
          icon={WalletIcon}
        />
        <StatCard
          label="Still to collect"
          value={<MoneyText amount={data.pendingOpen} />}
          tone={data.pendingOpen > 0 ? 'warning' : 'success'}
          icon={BanknoteIcon}
        />
        <StatCard
          label="Overdue months"
          value={data.overdueCount}
          tone={data.overdueCount > 0 ? 'destructive' : 'success'}
          icon={AlertTriangleIcon}
        />
        <StatCard
          label="Paid in advance"
          value={data.advanceCount}
          hint="Months marked paid before the due day"
          icon={CalendarCheckIcon}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {data.rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <Tabs
          value={activeSchemeId}
          onValueChange={(value) => {
            setSchemeId(value)
            setMemberId(undefined)
          }}
        >
          <TabsList>
            {schemes.map((scheme) => (
              <TabsTrigger key={scheme.id} value={scheme.id}>
                {scheme.code}
              </TabsTrigger>
            ))}
          </TabsList>
          {schemes.map((scheme) => (
            <TabsContent key={scheme.id} value={scheme.id}>
              <p className="text-muted-foreground mb-3 text-sm">{scheme.name}</p>
              <div className="relative mb-4 max-w-md">
                <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  className="pl-9"
                  placeholder="Search member name or mobile"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setMemberId(undefined)
                  }}
                  aria-label="Search members"
                />
              </div>
              {members.length === 0 ? (
                <EmptyState title="No members in this scheme" />
              ) : (
                <div className="grid gap-4">
                  <div className="flex flex-wrap gap-2">
                    {members.map((row) => {
                      const selected = row.membership.id === activeMemberId
                      return (
                        <button
                          key={row.membership.id}
                          type="button"
                          onClick={() => setMemberId(row.membership.id)}
                          className={cn(
                            'rounded-full border px-3 py-1.5 text-left text-sm font-medium transition-colors',
                            selected
                              ? 'bg-primary text-primary-foreground border-transparent'
                              : 'bg-card hover:bg-muted',
                            !selected && row.overdue && 'border-destructive/40 text-destructive',
                          )}
                        >
                          {row.person.fullName}
                          {row.overdue ? ' · overdue' : ''}
                        </button>
                      )
                    })}
                  </div>
                  {members
                    .filter((row) => row.membership.id === activeMemberId)
                    .map((row) => (
                      <MemberMonths
                        key={row.membership.id}
                        row={row}
                        busyKey={busyKey}
                        onPaid={(cell) => setPayTarget({ row, cell })}
                        onUnpaid={(cell) => void setUnpaid(row, cell)}
                      />
                    ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}

      <PaidDateDialog target={payTarget} onClose={() => setPayTarget(null)} onSetStatus={onSetStatus} />
    </>
  )
}

function MemberMonths({
  row,
  busyKey,
  onPaid,
  onUnpaid,
}: {
  row: CashierCollectRow
  busyKey: string | null
  onPaid: (cell: CashierMonthCell) => void
  onUnpaid: (cell: CashierMonthCell) => void
}) {
  const history = row.months
    .filter((cell) => cell.payment?.status === 'paid' && cell.payment.paidDate)
    .sort((a, b) => (b.payment?.paidDate ?? '').localeCompare(a.payment?.paidDate ?? ''))

  if (row.months.length === 0) {
    return <p className="text-muted-foreground text-sm">No months on this scheme yet.</p>
  }

  return (
    <div className="grid gap-4">
      <Card className={cn(row.overdue && 'border-destructive/50')}>
        <CardContent className="grid gap-4 pt-6">
          <div>
            <p className="font-semibold">{row.person.fullName}</p>
            <p className="text-muted-foreground text-sm">{row.person.mobile}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {row.months.map((cell) => {
              const key = `${row.membership.id}:${cell.round.id}`
              const paid = cell.payment?.status === 'paid'
              const busy = busyKey === key
              return (
                <div
                  key={cell.round.id}
                  className={cn(
                    'rounded-lg border p-2',
                    cell.overdue && 'border-destructive/50 bg-destructive/8',
                    paid && !cell.overdue && 'border-success/35 bg-success/8',
                  )}
                >
                  <p className="text-xs font-semibold">{formatShortMonth(cell.round.dueDate)}</p>
                  {paid && cell.payment?.paidDate ? (
                    <p className="text-muted-foreground text-[11px]">
                      Paid {formatDisplayDate(cell.payment.paidDate)}
                    </p>
                  ) : cell.advance ? (
                    <p className="text-success text-[11px] font-medium">Advance</p>
                  ) : null}
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    <Button
                      size="sm"
                      variant={paid ? 'default' : 'outline'}
                      className="h-7 px-1 text-xs"
                      disabled={!cell.canEdit || busy}
                      onClick={() => onPaid(cell)}
                    >
                      Paid
                    </Button>
                    <Button
                      size="sm"
                      variant={!paid ? 'secondary' : 'outline'}
                      className="h-7 px-1 text-xs"
                      disabled={!cell.canEdit || busy || !paid}
                      onClick={() => onUnpaid(cell)}
                    >
                      Unpaid
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-3 pt-6">
          <p className="text-sm font-semibold">Pay history</p>
          {history.length === 0 ? (
            <p className="text-muted-foreground text-sm">No cash recorded yet for this member.</p>
          ) : (
            <ul className="divide-border divide-y">
              {history.map((cell) => (
                <li key={cell.round.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>{formatShortMonth(cell.round.dueDate)}</span>
                  <span className="text-muted-foreground">
                    Paid on {formatDisplayDate(cell.payment?.paidDate)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function PaidDateDialog({
  target,
  onClose,
  onSetStatus,
}: {
  target: { row: CashierCollectRow; cell: CashierMonthCell } | null
  onClose: () => void
  onSetStatus: (input: PaymentStatusInput) => Promise<void>
}) {
  const [paidDate, setPaidDate] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!target) {
      setPaidDate('')
      return
    }
    setPaidDate(target.cell.payment?.paidDate ?? lastDayOfMonthIso(target.cell.round.dueDate))
  }, [target])

  async function save() {
    if (!target) return
    if (!paidDate) {
      toast.error('Choose the date you received the cash.')
      return
    }
    setBusy(true)
    try {
      await onSetStatus({
        schemeId: target.row.scheme.id,
        roundId: target.cell.round.id,
        personId: target.row.person.id,
        paid: true,
        paidDate,
      })
      const name = target.row.person.fullName
      const month = formatShortMonth(target.cell.round.dueDate)
      onClose()
      toast.success(`${name} · ${month} paid on ${formatDisplayDate(paidDate)}`)
    } catch (error) {
      toast.error(toReadableError(error, 'Could not record this payment.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Paid on</DialogTitle>
          <DialogDescription>
            {target
              ? `${target.row.person.fullName} · ${formatShortMonth(target.cell.round.dueDate)}. Defaults to the last day of that month; you can pick another date.`
              : null}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="collect-paid-date">Date received</Label>
          <Input
            id="collect-paid-date"
            type="date"
            value={paidDate}
            onChange={(event) => setPaidDate(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => void save()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
