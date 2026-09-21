import { useLiveQuery } from '@/hooks/useLiveQuery'
import {
  AlertTriangleIcon,
  BanknoteIcon,
  CalendarClockIcon,
  PiggyBankIcon,
  TrophyIcon,
  WalletIcon,
} from 'lucide-react'
import { Navigate } from 'react-router'

import { EmptyState, LoadingState } from '@/components/EmptyState'
import { MoneyText } from '@/components/MoneyText'
import { PaymentStatusBadge, PayoutStatusBadge } from '@/components/StatusBadge'
import { StatCard } from '@/components/StatCard'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PayoutScheduleChart } from '@/features/schemes/PayoutScheduleChart'
import { loadMemberHome } from '@/features/dashboard/member/memberHomeService'
import { formatDisplayDate } from '@/lib/dates'
import { useSession } from '@/stores/session'

/**
 * The member's only page. Shows all of their own information and nothing
 * about any other member — no roster, no other names, no other amounts.
 */
export function MemberHomePage() {
  const session = useSession()
  const personId = session?.kind === 'member' ? session.personId : undefined

  const data = useLiveQuery(
    () => (personId ? loadMemberHome(personId) : Promise.resolve(null)),
    [personId],
  )

  // An admin who lands here belongs in the admin workspace.
  if (session?.kind === 'admin') return <Navigate to="/" replace />
  if (data === undefined) return <LoadingState label="Loading your account…" />
  if (!data) {
    return (
      <EmptyState
        title="Account not found"
        description="This member record no longer exists. Ask your admin for help."
      />
    )
  }

  const { person } = data

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">Namaste, {person.fullName.split(' ')[0]}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Here is everything recorded for you in GouriNidhi.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total saved"
          value={<MoneyText amount={data.totalPaid} />}
          hint="Contributions you have paid"
          tone="success"
          icon={PiggyBankIcon}
        />
        <StatCard
          label="Still to pay"
          value={<MoneyText amount={data.totalPending} />}
          hint={data.overdueCount > 0 ? `${data.overdueCount} overdue` : 'Nothing overdue'}
          tone={data.totalPending > 0 ? 'warning' : 'success'}
          icon={data.overdueCount > 0 ? AlertTriangleIcon : CalendarClockIcon}
        />
        <StatCard
          label="Received"
          value={<MoneyText amount={data.totalReceived} />}
          hint="Payouts paid to you"
          icon={TrophyIcon}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Detail label="Name" value={person.fullName} />
          <Detail label="Mobile" value={<span className="tabular">{person.mobile}</span>} />
          <Detail label="Address" value={person.address || '—'} />
        </CardContent>
      </Card>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Your schemes</h2>
        {data.schemes.length === 0 ? (
          <EmptyState
            icon={WalletIcon}
            title="You are not in a scheme yet"
            description="Once your admin adds you to a chit scheme, it will appear here with your savings and payout month."
          />
        ) : (
          data.schemes.map((scheme) => (
            <Card key={scheme.schemeId}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {scheme.name}
                  <Badge variant="muted">{scheme.code}</Badge>
                  {!scheme.membershipActive && <Badge variant="secondary">Inactive</Badge>}
                </CardTitle>
                <CardDescription>
                  You are member #{scheme.memberNumber} · <MoneyText amount={scheme.monthlyAmount} />{' '}
                  every month for {scheme.durationMonths} months, starting{' '}
                  {formatDisplayDate(scheme.startDate)}.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Figure label="You have paid" value={scheme.paid} />
                  <Figure label="You still owe" value={scheme.pending} />
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs">Your payout month</p>
                    <p className="tabular mt-1 text-base font-bold">
                      {scheme.myMonth ? `Month ${scheme.myMonth}` : 'Not assigned yet'}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-muted-foreground mb-2 text-xs">
                    Payout amount by month. Earlier months receive less, later months receive more.
                    {scheme.myMonth ? ' Your month is highlighted.' : ''}
                  </p>
                  <PayoutScheduleChart lines={scheme.schedule} highlightMonth={scheme.myMonth} />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      {data.upcomingDues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>What you owe</CardTitle>
            <CardDescription>Contributions that are not settled yet.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-border divide-y">
              {data.upcomingDues.map((due) => (
                <li key={due.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium">
                      {due.schemeCode} · Month {due.monthNumber}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Due {formatDisplayDate(due.dueDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <MoneyText
                      amount={due.amountDue - due.amountPaid}
                      className="text-sm font-semibold"
                    />
                    <PaymentStatusBadge status={due.status} />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your payment history</CardTitle>
        </CardHeader>
        <CardContent>
          {data.payments.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No contributions recorded yet.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {data.payments.map((payment) => (
                <li key={payment.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium">
                      {payment.schemeCode} · Month {payment.monthNumber}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {payment.paidDate
                        ? `Paid ${formatDisplayDate(payment.paidDate)}`
                        : `Due ${formatDisplayDate(payment.dueDate)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm">
                      <MoneyText amount={payment.amountPaid} className="font-semibold" />
                      <span className="text-muted-foreground">
                        {' '}
                        / <MoneyText amount={payment.amountDue} />
                      </span>
                    </span>
                    <PaymentStatusBadge status={payment.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your payouts</CardTitle>
          <CardDescription>The months assigned to you and what you receive.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.payouts.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No payout month assigned to you yet.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {data.payouts.map((payout) => (
                <li key={payout.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium">
                      {payout.schemeCode} · Month {payout.monthNumber}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {payout.paidDate
                        ? `Paid ${formatDisplayDate(payout.paidDate)}`
                        : `Scheduled ${formatDisplayDate(payout.dueDate)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <MoneyText amount={payout.payoutAmount} className="font-semibold" />
                    <PayoutStatusBadge status={payout.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-muted-foreground flex items-center justify-center gap-2 pb-4 text-center text-xs">
        <BanknoteIcon className="size-3.5" />
        Contact your scheme admin for any correction.
      </p>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  )
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <MoneyText amount={value} className="mt-1 block text-base font-bold" />
    </div>
  )
}
