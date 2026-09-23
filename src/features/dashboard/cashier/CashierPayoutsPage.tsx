import { useLiveQuery } from '@/hooks/useLiveQuery'
import { toast } from 'sonner'

import { EmptyState, LoadingState } from '@/components/EmptyState'
import { MoneyText } from '@/components/MoneyText'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { loadCashierDashboard } from '@/features/dashboard/cashier/cashierDashboardService'
import { formatShortMonth, todayIso } from '@/lib/dates'
import { toReadableError } from '@/repositories/errors'
import { payoutsRepository } from '@/repositories/payoutsRepository'
import { useSession } from '@/stores/session'

export function CashierPayoutsPage() {
  const session = useSession()
  const personId = session?.kind === 'member' ? session.personId : undefined
  const data = useLiveQuery(() => (personId ? loadCashierDashboard(personId) : Promise.resolve(null)), [personId])

  if (data === undefined) return <LoadingState label="Loading handovers…" />
  if (!data) return <EmptyState title="Account not found" />

  async function handOver(payoutId: string, name: string) {
    try {
      await payoutsRepository.markHandover(payoutId, { paidDate: todayIso(), method: 'cash' })
      toast.success(`Marked handover to ${name}`)
    } catch (error) {
      toast.error(toReadableError(error, 'Could not mark this handover.'))
    }
  }

  return (
    <>
      <PageHeader
        title="Handover"
        description="If this month’s recipient is assigned to you, record that you handed over the cash."
      />
      {data.handovers.length === 0 ? (
        <EmptyState
          title="No handover assigned to you"
          description="When the admin assigns this month’s recipient to you, it will appear here."
        />
      ) : (
        <div className="grid gap-3">
          {data.handovers.map((row) => (
            <Card key={row.payout.id}>
              <CardHeader>
                <CardTitle>
                  {row.scheme.code} · {formatShortMonth(row.round.dueDate)}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{row.person.fullName}</p>
                  <MoneyText amount={row.payout.payoutAmount} className="text-muted-foreground text-sm" />
                </div>
                {row.payout.status === 'paid' ? (
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">Handed over</p>
                ) : (
                  <Button onClick={() => void handOver(row.payout.id, row.person.fullName)}>
                    Mark handed over
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
