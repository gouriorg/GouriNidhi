import { useLiveQuery } from '@/hooks/useLiveQuery'
import { PlusIcon, Trash2Icon, UserMinusIcon, UserPlusIcon, UsersIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState, LoadingState } from '@/components/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { peopleRepository } from '@/repositories/peopleRepository'
import { membershipsRepository } from '@/repositories/membershipsRepository'
import { toReadableError } from '@/repositories/errors'
import type { Scheme } from '@/types/entities'

/** Admin-only roster. Never rendered inside the member workspace. */
export function SchemeMembersTab({ scheme }: { scheme: Scheme }) {
  const [addOpen, setAddOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null)

  const rows = useLiveQuery(
    () => membershipsRepository.listForSchemeWithPeople(scheme.id),
    [scheme.id],
  )

  const activeCount = rows?.filter((row) => row.status === 'active').length ?? 0
  const rosterFull = activeCount >= scheme.maxMembers
  const editable = scheme.status === 'draft' || scheme.status === 'active'

  async function toggleStatus(id: string, currentlyActive: boolean) {
    try {
      await membershipsRepository.setStatus(id, currentlyActive ? 'inactive' : 'active')
      toast.success(currentlyActive ? 'Membership deactivated' : 'Membership reactivated')
    } catch (error) {
      toast.error(toReadableError(error, 'Could not change the membership.'))
    }
  }

  async function remove(id: string) {
    try {
      await membershipsRepository.remove(id)
      toast.success('Member removed from this scheme')
    } catch (error) {
      toast.error(toReadableError(error, 'Could not remove this member.'))
    }
  }

  if (rows === undefined) return <LoadingState label="Loading roster…" />

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          <span className="text-foreground tabular font-semibold">
            {activeCount}/{scheme.maxMembers}
          </span>{' '}
          active members{rosterFull ? ' — the roster is full' : ''}
        </p>
        {editable && (
          <Button onClick={() => setAddOpen(true)} disabled={rosterFull}>
            <PlusIcon /> Add member
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="No members assigned"
          description={`Assign up to ${scheme.maxMembers} members to this scheme. Only admins can see this list.`}
          action={
            editable ? (
              <Button onClick={() => setAddOpen(true)}>
                <PlusIcon /> Add the first member
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <Card className="hidden py-0 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="tabular text-muted-foreground">
                      {row.memberNumber}
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        to={`/members/${row.personId}`}
                        className="hover:text-primary hover:underline"
                      >
                        {row.person.fullName}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular">{row.person.mobile}</TableCell>
                    <TableCell>
                      <Badge variant={row.status === 'active' ? 'success' : 'muted'}>
                        {row.status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {editable && (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleStatus(row.id, row.status === 'active')}
                          >
                            {row.status === 'active' ? <UserMinusIcon /> : <UserPlusIcon />}
                            {row.status === 'active' ? 'Deactivate' : 'Reactivate'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove ${row.person.fullName}`}
                            onClick={() =>
                              setRemoveTarget({ id: row.id, name: row.person.fullName })
                            }
                          >
                            <Trash2Icon className="text-destructive" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="grid gap-3 md:hidden">
            {rows.map((row) => (
              <Card key={row.id} className="gap-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      <span className="text-muted-foreground tabular mr-2">
                        #{row.memberNumber}
                      </span>
                      {row.person.fullName}
                    </p>
                    <p className="text-muted-foreground tabular text-sm">{row.person.mobile}</p>
                  </div>
                  <Badge variant={row.status === 'active' ? 'success' : 'muted'}>
                    {row.status === 'active' ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                {editable && (
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => toggleStatus(row.id, row.status === 'active')}
                    >
                      {row.status === 'active' ? 'Deactivate' : 'Reactivate'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRemoveTarget({ id: row.id, name: row.person.fullName })}
                    >
                      <Trash2Icon className="text-destructive" />
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      <AddMemberDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        schemeId={scheme.id}
        assignedPersonIds={new Set(rows.map((row) => row.personId))}
      />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={`Remove ${removeTarget?.name} from this scheme?`}
        description="This is only possible while they have no payments or payouts recorded. Their member record itself is not deleted."
        confirmLabel="Remove"
        destructive
        onConfirm={async () => {
          if (removeTarget) await remove(removeTarget.id)
        }}
      />
    </>
  )
}

function AddMemberDialog({
  open,
  onOpenChange,
  schemeId,
  assignedPersonIds,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  schemeId: string
  assignedPersonIds: Set<string>
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
      .filter((person) => !assignedPersonIds.has(person.id))
      .filter(
        (person) =>
          !needle ||
          person.fullName.toLowerCase().includes(needle) ||
          person.mobile.includes(needle),
      )
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [people, search, assignedPersonIds])

  async function add(personId: string) {
    setBusyId(personId)
    try {
      await membershipsRepository.add(schemeId, personId)
      toast.success('Member added to the scheme')
    } catch (error) {
      toast.error(toReadableError(error, 'Could not add this member.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add member to scheme</DialogTitle>
          <DialogDescription>
            Only active members who are not already in this scheme are listed.
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Search by name or mobile"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search members to add"
        />

        <div className="max-h-72 overflow-y-auto">
          {candidates.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              {people?.length === 0
                ? 'No active members exist yet. Add members first.'
                : 'Everyone matching is already in this scheme.'}
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {candidates.map((person) => (
                <li key={person.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{person.fullName}</p>
                    <p className="text-muted-foreground tabular text-xs">{person.mobile}</p>
                  </div>
                  <Button size="sm" disabled={busyId === person.id} onClick={() => add(person.id)}>
                    Add
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
