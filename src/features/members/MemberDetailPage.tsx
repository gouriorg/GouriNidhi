import { useLiveQuery } from '@/hooks/useLiveQuery'
import { ArrowLeftIcon, PencilIcon, UserCheckIcon, UserXIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState, LoadingState } from '@/components/EmptyState'
import { MoneyText } from '@/components/MoneyText'
import { PageHeader } from '@/components/PageHeader'
import { PersonStatusBadge, SchemeStatusBadge } from '@/components/StatusBadge'
import { StatCard } from '@/components/StatCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { membershipsRepository } from '@/repositories/membershipsRepository'
import { paymentsRepository } from '@/repositories/paymentsRepository'
import { payoutsRepository } from '@/repositories/payoutsRepository'
import { peopleRepository } from '@/repositories/peopleRepository'
import { schemesRepository } from '@/repositories/schemesRepository'
import { MemberFormDialog } from '@/features/members/MemberFormDialog'
import { formatDisplayDate } from '@/lib/dates'
import { toReadableError } from '@/repositories/errors'

export function MemberDetailPage() {
  const { personId = '' } = useParams()
  const [editOpen, setEditOpen] = useState(false)
  const [statusConfirm, setStatusConfirm] = useState(false)

  const person = useLiveQuery(() => peopleRepository.get(personId), [personId])

  const detail = useLiveQuery(async () => {
    if (!personId) return null
    const memberships = await membershipsRepository.listForPerson(personId)
    const schemes = await Promise.all(memberships.map((m) => schemesRepository.get(m.schemeId)))
    const payments = await paymentsRepository.listForPerson(personId)
    const payouts = await payoutsRepository.listForPerson(personId)

    return {
      rows: memberships
        .map((membership, index) => ({ membership, scheme: schemes[index] }))
        .filter((row) => row.scheme),
      totalPaid: payments.reduce((sum, payment) => sum + payment.amountPaid, 0),
      totalPending: payments
        .filter((payment) => payment.status !== 'waived')
        .reduce((sum, payment) => sum + (payment.amountDue - payment.amountPaid), 0),
      totalReceived: payouts
        .filter((payout) => payout.status === 'paid')
        .reduce((sum, payout) => sum + payout.payoutAmount, 0),
    }
  }, [personId])

  if (person === undefined) return <LoadingState label="Loading member…" />
  if (person === null || !person) {
    return (
      <EmptyState
        title="Member not found"
        description="This member may have been removed."
        action={
          <Button asChild>
            <Link to="/members">Back to members</Link>
          </Button>
        }
      />
    )
  }

  const willDeactivate = person.status === 'active'

  async function toggleStatus() {
    if (!person) return
    try {
      await peopleRepository.setStatus(person.id, willDeactivate ? 'inactive' : 'active')
      toast.success(willDeactivate ? `${person.fullName} deactivated` : `${person.fullName} reactivated`)
    } catch (error) {
      toast.error(toReadableError(error, 'Could not change the status.'))
    }
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/members">
          <ArrowLeftIcon /> All members
        </Link>
      </Button>

      <PageHeader
        title={person.fullName}
        description={`Member since ${formatDisplayDate(person.createdAt.slice(0, 10))}`}
        actions={
          <>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <PencilIcon /> Edit
            </Button>
            <Button
              variant={willDeactivate ? 'destructive' : 'default'}
              onClick={() => setStatusConfirm(true)}
            >
              {willDeactivate ? <UserXIcon /> : <UserCheckIcon />}
              {willDeactivate ? 'Deactivate' : 'Reactivate'}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <Field label="Status">
              <PersonStatusBadge status={person.status} />
            </Field>
            <Field label="Mobile (also their login)">
              <span className="tabular">{person.mobile}</span>
            </Field>
            <Field label="Address">{person.address || '—'}</Field>
            <Field label="Notes">{person.notes || '—'}</Field>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Total paid"
              value={<MoneyText amount={detail?.totalPaid ?? 0} />}
              tone="success"
            />
            <StatCard
              label="Pending"
              value={<MoneyText amount={detail?.totalPending ?? 0} />}
              tone="warning"
            />
            <StatCard
              label="Payouts received"
              value={<MoneyText amount={detail?.totalReceived ?? 0} />}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Schemes</CardTitle>
            </CardHeader>
            <CardContent>
              {!detail || detail.rows.length === 0 ? (
                <p className="text-muted-foreground py-4 text-sm">
                  Not assigned to any scheme yet.
                </p>
              ) : (
                <ul className="divide-border divide-y">
                  {detail.rows.map(({ membership, scheme }) => (
                    <li key={membership.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <Link
                          to={`/schemes/${scheme!.id}`}
                          className="hover:text-primary font-medium hover:underline"
                        >
                          {scheme!.name}
                        </Link>
                        <p className="text-muted-foreground text-xs">
                          {scheme!.code} · Member #{membership.memberNumber} ·{' '}
                          {membership.status === 'active' ? 'Active' : 'Inactive'} membership
                        </p>
                      </div>
                      <SchemeStatusBadge status={scheme!.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <MemberFormDialog open={editOpen} onOpenChange={setEditOpen} person={person} />

      <ConfirmDialog
        open={statusConfirm}
        onOpenChange={setStatusConfirm}
        title={willDeactivate ? `Deactivate ${person.fullName}?` : `Reactivate ${person.fullName}?`}
        description={
          willDeactivate
            ? 'They will not be able to sign in or join new schemes. Their existing records and history stay intact.'
            : 'They will be able to sign in again and join new schemes.'
        }
        confirmLabel={willDeactivate ? 'Deactivate' : 'Reactivate'}
        destructive={willDeactivate}
        onConfirm={toggleStatus}
      />
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  )
}
