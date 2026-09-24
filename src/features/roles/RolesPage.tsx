import { useLiveQuery } from '@/hooks/useLiveQuery'
import { BanknoteIcon, ShieldIcon, UserIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { adminsRepository } from '@/repositories/adminsRepository'
import { cashiersRepository } from '@/repositories/cashiersRepository'
import { peopleRepository } from '@/repositories/peopleRepository'
import { toReadableError } from '@/repositories/errors'
import type { Person } from '@/types/entities'

export function RolesPage() {
  const memberCount = useLiveQuery(
    () =>
      peopleRepository.list().then((rows) => rows.filter((person) => person.status === 'active').length),
    [],
  )
  const cashierCount = useLiveQuery(() => cashiersRepository.list().then((rows) => rows.length), [])
  const admins = useLiveQuery(() => adminsRepository.list(), [])
  const [addOpen, setAddOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<Person | null>(null)

  return (
    <>
      <PageHeader
        title="Roles"
        description="Admin, Member, and Cashier. A person can hold more than one role and still use their mobile login."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldIcon className="text-primary size-5" /> Admin
              <Badge variant="muted">
                {admins?.length ?? 0} member{(admins?.length ?? 0) === 1 ? '' : 's'}
              </Badge>
            </CardTitle>
            <CardDescription>
              Assigned members sign in with their mobile number. Keep at least one admin.
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
              <li>Open My account for their own schemes, if they are a member</li>
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
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Member admins</CardTitle>
            <CardDescription>
              Promote an existing member. They keep their mobile login and can still open My account.
            </CardDescription>
          </div>
          <Button onClick={() => setAddOpen(true)}>Make admin</Button>
        </CardHeader>
        <CardContent>
          {!admins ? (
            <p className="text-muted-foreground text-sm">Loading admins…</p>
          ) : admins.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No members have the admin role. Make at least one member an admin so someone can open
              this workspace.
            </p>
          ) : (
            <ul className="divide-border divide-y rounded-md border">
              {admins.map((person) => (
                <li key={person.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{person.fullName}</p>
                    <p className="text-muted-foreground tabular text-xs">{person.mobile}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={admins.length === 1}
                    onClick={() => setRemoveTarget(person)}
                  >
                    Remove admin
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AddAdminDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        adminIds={new Set(admins?.map((row) => row.id) ?? [])}
      />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={`Remove admin from ${removeTarget?.fullName}?`}
        description="They stay a member (and a cashier, if they were one). They will sign in with the same mobile number and no longer see the admin workspace."
        confirmLabel="Remove admin"
        destructive
        onConfirm={async () => {
          if (!removeTarget) return
          try {
            await adminsRepository.remove(removeTarget.id)
            toast.success('Admin role removed')
          } catch (error) {
            toast.error(toReadableError(error, 'Could not remove this admin.'))
          }
        }}
      />
    </>
  )
}

function AddAdminDialog({
  open,
  onOpenChange,
  adminIds,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  adminIds: Set<string>
}) {
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const people = useLiveQuery(
    () => peopleRepository.list().then((rows) => rows.filter((person) => person.status === 'active')),
    [],
  )

  const candidates = useMemo(() => {
    if (!people) return []
    const needle = search.trim().toLowerCase()
    return people
      .filter((person) => !adminIds.has(person.id) && person.authUserId)
      .filter(
        (person) =>
          !needle ||
          person.fullName.toLowerCase().includes(needle) ||
          person.mobile.includes(needle),
      )
  }, [people, search, adminIds])

  async function promote(personId: string) {
    setBusyId(personId)
    try {
      await adminsRepository.promote(personId)
      toast.success('Admin role added')
    } catch (error) {
      toast.error(toReadableError(error, 'Could not make this person an admin.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setSearch('')
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Make a member admin</DialogTitle>
          <DialogDescription>
            They keep the same mobile login and can still open My account for their own schemes.
          </DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Search by name or mobile"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="max-h-72 overflow-y-auto">
          {candidates.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">No matching members.</p>
          ) : (
            <ul className="divide-border divide-y">
              {candidates.map((person) => (
                <li key={person.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{person.fullName}</p>
                    <p className="text-muted-foreground tabular text-xs">{person.mobile}</p>
                  </div>
                  <Button size="sm" disabled={busyId === person.id} onClick={() => void promote(person.id)}>
                    Make admin
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
