import { useLiveQuery } from '@/hooks/useLiveQuery'

import { LoadingState } from '@/components/EmptyState'
import { CollectWorkspace } from '@/features/payments/CollectWorkspace'
import { loadAdminCollectDashboard } from '@/features/dashboard/cashier/cashierDashboardService'
import { paymentsRepository } from '@/repositories/paymentsRepository'

export function AdminCollectPage() {
  const data = useLiveQuery(() => loadAdminCollectDashboard(), [])

  if (data === undefined) return <LoadingState label="Loading members…" />

  return (
    <CollectWorkspace
      title="Collect"
      description="Mark paid or unpaid for any member in any scheme. You can record cash before collection is opened, and store the date you received it."
      emptyTitle="No scheme members yet"
      emptyDescription="Add members to a scheme first."
      membersLabel="Scheme members"
      data={data}
      onSetStatus={(input) => paymentsRepository.setAdminStatus(input)}
    />
  )
}
