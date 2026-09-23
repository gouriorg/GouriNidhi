import { useMemo, useState } from 'react'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { PhoneIcon, SearchIcon } from 'lucide-react'

import { EmptyState, LoadingState } from '@/components/EmptyState'
import { MoneyText } from '@/components/MoneyText'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { loadCallAlerts } from '@/features/dashboard/admin/adminDashboardService'
import { formatDisplayDate, formatShortMonth } from '@/lib/dates'

export function CallOverduePage() {
  const alerts = useLiveQuery(() => loadCallAlerts(), [])
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!alerts) return []
    const needle = search.trim().toLowerCase()
    if (!needle) return alerts
    return alerts.filter((alert) => {
      const haystack = [
        alert.personName,
        alert.mobile,
        alert.schemeCode,
        alert.cashierName ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [alerts, search])

  if (alerts === undefined) return <LoadingState label="Loading overdue members…" />

  return (
    <>
      <PageHeader
        title="Call overdue members"
        description="These members missed the monthly due day. Call them, or ask their cashier to collect."
      />
      {alerts.length === 0 ? (
        <EmptyState
          icon={PhoneIcon}
          title="Nobody is overdue"
          description="When a contribution passes its due day, the member appears here with their mobile number."
        />
      ) : (
        <>
          <div className="relative mb-4">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              className="pl-9"
              placeholder="Search by name, mobile, scheme, or cashier"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search overdue members"
            />
          </div>
          {filtered.length === 0 ? (
            <EmptyState
              icon={SearchIcon}
              title="No matching members"
              description="Try a different name, mobile number, scheme code, or cashier."
            />
          ) : (
            <Card>
              <CardContent className="pt-2">
                <ul className="divide-border divide-y">
                  {filtered.map((alert) => (
                    <li key={alert.paymentId} className="flex flex-wrap items-start justify-between gap-3 py-3">
                      <div>
                        <p className="text-sm font-medium">{alert.personName}</p>
                        <p className="text-muted-foreground text-xs">
                          {alert.schemeCode} · {formatShortMonth(alert.dueDate)} · due{' '}
                          {formatDisplayDate(alert.dueDate)}
                          {alert.cashierName ? ` · cashier ${alert.cashierName}` : ' · no cashier'}
                        </p>
                      </div>
                      <div className="text-right">
                        <a
                          href={`tel:${alert.mobile}`}
                          className="text-primary tabular text-sm font-medium hover:underline"
                        >
                          {alert.mobile}
                        </a>
                        <p className="text-muted-foreground text-xs">
                          <MoneyText amount={alert.pending} /> pending
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </>
  )
}
