import { useLiveQuery } from '@/hooks/useLiveQuery'
import {
  AlertTriangleIcon,
  BanknoteIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  PhoneIcon,
  PlusIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
} from 'lucide-react'
import { Link } from 'react-router'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { EmptyState, LoadingState } from '@/components/EmptyState'
import { MoneyText } from '@/components/MoneyText'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { features } from '@/config/features'
import { loadAdminDashboard } from '@/features/dashboard/admin/adminDashboardService'
import { formatDisplayDate, formatDisplayDateTime, formatShortMonth } from '@/lib/dates'

export function AdminDashboardPage() {
  const data = useLiveQuery(() => loadAdminDashboard(), [])

  if (data === undefined) return <LoadingState label="Loading dashboard…" />

  const empty = data.totalMembers === 0 && data.totalSchemes === 0

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Everything across your schemes at a glance."
        actions={
          <Button asChild>
            <Link to="/schemes/new">
              <PlusIcon /> New scheme
            </Link>
          </Button>
        }
      />

      {empty ? (
        <EmptyState
          icon={WalletIcon}
          title="Welcome to GouriNidhi"
          description="Start by adding the members of your group, then create a scheme. Everything is stored in this browser — no server, no account."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link to="/members">
                  <UsersIcon /> Add members
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/schemes/new">
                  <WalletIcon /> Create a scheme
                </Link>
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Active schemes"
              value={data.activeSchemes}
              hint={`${data.totalSchemes} total`}
              icon={WalletIcon}
            />
            <StatCard
              label="Active members"
              value={data.activeMembers}
              hint={`${data.memberships} scheme memberships`}
              icon={UsersIcon}
            />
            <StatCard
              label="Expected each month"
              value={<MoneyText amount={data.expectedMonthly} />}
              hint="Across active schemes"
              icon={TrendingUpIcon}
            />
            <StatCard
              label="Pending collection"
              value={<MoneyText amount={data.pendingNow} />}
              hint={data.overdueCount > 0 ? `${data.overdueCount} overdue` : 'Nothing overdue'}
              tone={data.pendingNow > 0 ? 'warning' : 'success'}
              icon={data.overdueCount > 0 ? AlertTriangleIcon : CheckCircle2Icon}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Collected all time"
              value={<MoneyText amount={data.collectedAllTime} />}
              tone="success"
              icon={BanknoteIcon}
            />
            <StatCard
              label="Paid out all time"
              value={<MoneyText amount={data.paidOutAllTime} />}
              icon={BanknoteIcon}
            />
            <StatCard
              label="Rounds completed"
              value={`${data.roundsCompleted} / ${data.roundsTotal}`}
              icon={CalendarClockIcon}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label="Cashiers"
              value={data.cashierCount}
              hint="People with the cashier role"
              icon={UsersIcon}
            />
            <StatCard
              label="Unassigned members"
              value={data.unassignedMembers}
              hint="Active scheme seats without a cashier"
              tone={data.unassignedMembers > 0 ? 'warning' : 'success'}
              icon={AlertTriangleIcon}
            />
          </div>

          {data.callAlerts.length > 0 && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PhoneIcon className="size-5" />
                  Call overdue members
                </CardTitle>
                <CardDescription>
                  These members missed the monthly due day. Call them, or ask their cashier to collect.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="divide-border divide-y">
                  {data.callAlerts.map((alert) => (
                    <li key={alert.paymentId} className="flex flex-wrap items-start justify-between gap-3 py-3">
                      <div>
                        <p className="text-sm font-medium">{alert.personName}</p>
                        <p className="text-muted-foreground text-xs">
                          {alert.schemeCode} · {formatShortMonth(alert.dueDate)} · due {formatDisplayDate(alert.dueDate)}
                          {alert.cashierName ? ` · cashier ${alert.cashierName}` : ' · no cashier'}
                        </p>
                      </div>
                      <div className="text-right">
                        <a href={`tel:${alert.mobile}`} className="text-primary tabular text-sm font-medium hover:underline">
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

          <Card>
            <CardHeader>
              <CardTitle>By cashier</CardTitle>
              <CardDescription>
                Assigned members and this month’s open collection.{' '}
                <Link to="/cashiers" className="text-primary hover:underline">
                  Manage cashiers
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.byCashier.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">No cashiers yet.</p>
              ) : (
                <ul className="divide-border divide-y">
                  {data.byCashier.map((row) => (
                    <li key={row.personId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <p className="text-sm font-medium">{row.name}</p>
                        <p className="text-muted-foreground text-xs">{row.assignedCount} assigned</p>
                      </div>
                      <div className="text-right text-sm">
                        <MoneyText amount={row.collectedOpen} className="font-semibold" />
                        <p className="text-muted-foreground text-xs">
                          <MoneyText amount={row.pendingOpen} /> still to collect
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Collection by scheme</CardTitle>
                <CardDescription>Collected versus still pending, in rupees.</CardDescription>
              </CardHeader>
              <CardContent>
                {data.collectionByScheme.length === 0 ? (
                  <p className="text-muted-foreground py-10 text-center text-sm">
                    No active schemes yet.
                  </p>
                ) : (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.collectionByScheme}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis
                          dataKey="code"
                          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                          tickLine={false}
                          axisLine={false}
                          width={56}
                          tickFormatter={(value: number) =>
                            new Intl.NumberFormat('en-IN', {
                              notation: 'compact',
                              maximumFractionDigits: 1,
                            }).format(value)
                          }
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--popover)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius)',
                            fontSize: 12,
                            color: 'var(--popover-foreground)',
                          }}
                          formatter={(value) =>
                            new Intl.NumberFormat('en-IN', {
                              style: 'currency',
                              currency: 'INR',
                              maximumFractionDigits: 0,
                            }).format(Number(value) || 0)
                          }
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar
                          dataKey="collected"
                          name="Collected"
                          fill="var(--color-chart-3)"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="pending"
                          name="Pending"
                          fill="var(--color-chart-2)"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Next dues</CardTitle>
                <CardDescription>Rounds waiting to be collected.</CardDescription>
              </CardHeader>
              <CardContent>
                {data.upcomingDues.length === 0 ? (
                  <p className="text-muted-foreground py-10 text-center text-sm">
                    No upcoming rounds.
                  </p>
                ) : (
                  <ul className="divide-border divide-y">
                    {data.upcomingDues.map((due) => (
                      <li key={due.roundId} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <Link
                            to={`/schemes/${due.schemeId}/rounds/${due.roundId}`}
                            className="hover:text-primary text-sm font-medium hover:underline"
                          >
                            {due.schemeCode} · {formatShortMonth(due.dueDate)}
                          </Link>
                          <p className="text-muted-foreground text-xs">
                            Due {formatDisplayDate(due.dueDate)}
                          </p>
                        </div>
                        <div className="text-right">
                          <MoneyText
                            amount={due.isOpen ? due.pending : due.expected}
                            className="text-sm font-semibold"
                          />
                          <p className="text-muted-foreground text-xs">
                            {due.isOpen ? 'pending' : 'expected'}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {features.auditLog && (
            <Card>
              <CardHeader>
                <CardTitle>Recent activity</CardTitle>
                <CardDescription>The latest changes recorded in the audit log.</CardDescription>
              </CardHeader>
              <CardContent>
                {data.recentActivity.length === 0 ? (
                  <p className="text-muted-foreground py-6 text-center text-sm">Nothing yet.</p>
                ) : (
                  <ul className="divide-border divide-y">
                    {data.recentActivity.map((entry) => (
                      <li key={entry.id} className="flex items-baseline justify-between gap-4 py-2.5">
                        <span className="text-sm">{entry.summary}</span>
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {formatDisplayDateTime(entry.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </>
  )
}
