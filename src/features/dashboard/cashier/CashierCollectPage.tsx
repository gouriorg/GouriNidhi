import { useLiveQuery } from '@/hooks/useLiveQuery'

import { EmptyState, LoadingState } from '@/components/EmptyState'
import { CollectWorkspace } from '@/features/payments/CollectWorkspace'
import { loadCashierDashboard } from '@/features/dashboard/cashier/cashierDashboardService'
import { paymentsRepository } from '@/repositories/paymentsRepository'
import { useSession } from '@/stores/session'

export function CashierCollectPage() {
  const session = useSession()
  const personId = session?.kind === 'member' ? session.personId : undefined
  const data = useLiveQuery(() => (personId ? loadCashierDashboard(personId) : Promise.resolve(null)), [personId])

  if (data === undefined) return <LoadingState label="Loading your members…" />
  if (!data) return <EmptyState title="Account not found" />

  return (
    <CollectWorkspace
      title="Members"
      description="Pick a scheme and a member, then mark Paid or Unpaid. Paid months store the date you received the cash."
      emptyTitle="No members assigned yet"
      emptyDescription="Ask the admin to assign scheme members to you."
      membersLabel="Assigned members"
      data={data}
      onSetStatus={(input) => paymentsRepository.setCashierStatus(input)}
    />
  )
}
