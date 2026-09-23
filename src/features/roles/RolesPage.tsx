import { useLiveQuery } from '@/hooks/useLiveQuery'
import { AlertTriangleIcon, BanknoteIcon, ShieldIcon, UserIcon } from 'lucide-react'

import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ADMIN_CREDENTIALS, AUTH_WARNING } from '@/config/auth'
import { peopleRepository } from '@/repositories/peopleRepository'
import { cashiersRepository } from '@/repositories/cashiersRepository'

/** Explains the two roles. There is deliberately no promote-to-admin action yet. */
export function RolesPage() {
  const memberCount = useLiveQuery(
    () =>
      peopleRepository.list().then((rows) => rows.filter((person) => person.status === 'active').length),
    [],
  )
  const cashierCount = useLiveQuery(() => cashiersRepository.list().then((rows) => rows.length), [])

  return (
    <>
      <PageHeader
        title="Roles"
        description="GouriNidhi has three roles: Admin, Member, and Cashier. A person can be both a member and a cashier."
      />

      <div className="border-warning/35 bg-warning/10 text-warning-foreground mb-6 flex gap-2 rounded-lg border p-3 text-sm">
        <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
        <p>{AUTH_WARNING}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldIcon className="text-primary size-5" /> Admin
              <Badge variant="muted">1 built-in login</Badge>
            </CardTitle>
            <CardDescription>
              Signs in with the username <code className="font-mono">{ADMIN_CREDENTIALS.username}</code>.
              This account is not a member record.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p className="font-medium">Can do everything:</p>
            <ul className="text-muted-foreground list-disc space-y-1 pl-5">
              <li>Add, edit and deactivate members</li>
              <li>Create schemes and deactivate them (records are kept, never deleted)</li>
              <li>See every scheme&rsquo;s member list</li>
              <li>Assign members to schemes and set payout recipients</li>
              <li>Add cashiers and assign members to them</li>
              <li>Record contributions and payouts</li>
              <li>Read reports and export or restore backups</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="text-primary size-5" /> Member
              <Badge variant="muted">{memberCount ?? 0} active</Badge>
            </CardTitle>
            <CardDescription>
              Everyone in the Members directory. They sign in with their 10-digit mobile number as
              both the username and the password.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p className="font-medium">Sees only their own home page:</p>
            <ul className="text-muted-foreground list-disc space-y-1 pl-5">
              <li>Their profile, schemes, savings and payment history</li>
              <li>Their own payout month and amount</li>
              <li>The month-by-month payout curve, without any recipient names</li>
            </ul>
            <p className="mt-2 font-medium">Never sees:</p>
            <ul className="text-muted-foreground list-disc space-y-1 pl-5">
              <li>The Members directory or any scheme roster</li>
              <li>Another member&rsquo;s name, mobile, address or money</li>
              <li>Reports, settings or backups</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BanknoteIcon className="text-primary size-5" /> Cashier
              <Badge variant="muted">{cashierCount ?? 0} active</Badge>
            </CardTitle>
            <CardDescription>
              Extra role on a person. They sign in with the same mobile number. They can also stay a
              member of a scheme.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p className="font-medium">Can do:</p>
            <ul className="text-muted-foreground list-disc space-y-1 pl-5">
              <li>See members assigned to them and mark who paid</li>
              <li>Hand over this month’s chit if that recipient is assigned to them</li>
              <li>Open My account if they are also a scheme member</li>
            </ul>
            <p className="mt-2 font-medium">Never sees:</p>
            <ul className="text-muted-foreground list-disc space-y-1 pl-5">
              <li>The full Members directory or another cashier’s roster</li>
              <li>Reports, settings or backups</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Planned for later</CardTitle>
          <CardDescription>
            Multiple admin accounts and a properly hashed password are intentionally left out of
            this version. Cashier is the extra collection role; scheme membership is still separate.
          </CardDescription>
        </CardHeader>
      </Card>
    </>
  )
}
