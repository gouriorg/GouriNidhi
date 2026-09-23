import { useLiveQuery } from '@/hooks/useLiveQuery'
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState, LoadingState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cashiersRepository, type CashierRecord } from '@/repositories/cashiersRepository'
import { peopleRepository } from '@/repositories/peopleRepository'
import { toReadableError } from '@/repositories/errors'

export function CashiersPage() {
  const cashiers = useLiveQuery(() => cashiersRepository.list(), [])
  const [addOpen, setAddOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [assignCashier, setAssignCashier] = useState<CashierRecord | null>(null)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [busyMembershipId, setBusyMembershipId] = useState<string | null>(null)

  if (cashiers === undefined) return <LoadingState label="Loading cashiers…" />

  const removeTarget = cashiers.find((row) => row.id === removeId)

  async function unassign(membershipId: string) {
    setBusyMembershipId(membershipId)
    try {
      await cashiersRepository.unassignMember(membershipId)
      toast.success('Member removed from this cashier')
    } catch (error) {
      toast.error(toReadableError(error, 'Could not remove this member.'))
    } finally {
      setBusyMembershipId(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Cashiers"
        description="Cashiers collect from the members you assign to them. A cashier can also be a member."
        actions={<Button onClick={() => setAddOpen(true)}>Add cashier</Button>}
      />

      {cashiers.length === 0 ? (
        <EmptyState
          title="No cashiers yet"
          description="Promote an existing member or add a person, then assign scheme members to them."
          action={<Button onClick={() => setAddOpen(true)}>Add the first cashier</Button>}
        />
      ) : (
        <div className="grid gap-3">
          {cashiers.map((cashier) => {
            const expanded = expandedId === cashier.id
            return (
              <Card key={cashier.id}>
                <CardContent className="pt-6">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 text-left"
                    aria-expanded={expanded}
                    onClick={() => setExpandedId(expanded ? null : cashier.id)}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {expanded ? (
                        <ChevronDownIcon className="text-muted-foreground size-4 shrink-0" />
                      ) : (
                        <ChevronRightIcon className="text-muted-foreground size-4 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold">{cashier.fullName}</p>
                        <p className="text-muted-foreground tabular text-sm">{cashier.mobile}</p>
                      </div>
                    </div>
                    <Badge variant="muted">
                      <span className="tabular">{cashier.assignedCount}</span> assigned
                    </Badge>
                  </button>

                  {expanded && (
                    <div className="mt-4 grid gap-3 border-t pt-4">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button size="sm" onClick={() => setAssignCashier(cashier)}>
                          Add member
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setRemoveId(cashier.id)}>
                          Remove role
                        </Button>
                      </div>

                      {cashier.assignments.length === 0 ? (
                        <p className="text-muted-foreground text-sm">
                          No members assigned yet. Add a scheme member so this cashier can collect from them.
                        </p>
                      ) : (
                        <ul className="divide-border divide-y rounded-md border">
                          {cashier.assignments.map((row) => (
                            <li
                              key={row.membershipId}
                              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"
                            >
                              <div>
                                <p className="text-sm font-medium">{row.fullName}</p>
                                <p className="text-muted-foreground text-xs">
                                  {row.schemeName} · {row.schemeCode} ·{' '}
                                  <span className="tabular">{row.mobile}</span>
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busyMembershipId === row.membershipId}
                                onClick={() => void unassign(row.membershipId)}
                              >
                                Remove
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <AddCashierDialog open={addOpen} onOpenChange={setAddOpen} cashierIds={new Set(cashiers.map((row) => row.id))} />
      <AssignMemberDialog cashier={assignCashier} onOpenChange={(open) => !open && setAssignCashier(null)} />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveId(null)}
        title={`Remove cashier role from ${removeTarget?.fullName}?`}
        description="They stay a member if they were one. Assigned members become unassigned. Payment history is kept."
        confirmLabel="Remove cashier"
        destructive
        onConfirm={async () => {
          if (!removeTarget) return
          try {
            await cashiersRepository.remove(removeTarget.id)
            toast.success('Cashier role removed')
          } catch (error) {
            toast.error(toReadableError(error, 'Could not remove this cashier.'))
          }
        }}
      />
    </>
  )
}

function AssignMemberDialog({
  cashier,
  onOpenChange,
}: {
  cashier: CashierRecord | null
  onOpenChange: (open: boolean) => void
}) {
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const seats = useLiveQuery(
    () => (cashier ? cashiersRepository.listAssignable(cashier.id) : Promise.resolve([])),
    [cashier?.id],
  )

  const candidates = useMemo(() => {
    if (!seats) return []
    const needle = search.trim().toLowerCase()
    return seats.filter(
      (seat) =>
        !needle ||
        seat.fullName.toLowerCase().includes(needle) ||
        seat.mobile.includes(needle) ||
        seat.schemeCode.toLowerCase().includes(needle) ||
        seat.schemeName.toLowerCase().includes(needle),
    )
  }, [seats, search])

  async function assign(membershipId: string) {
    if (!cashier) return
    setBusyId(membershipId)
    try {
      await cashiersRepository.assignMember(cashier.id, membershipId)
      toast.success(`Assigned to ${cashier.fullName}`)
    } catch (error) {
      toast.error(toReadableError(error, 'Could not assign this member.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Dialog
      open={Boolean(cashier)}
      onOpenChange={(open) => {
        if (!open) setSearch('')
        onOpenChange(open)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add members to {cashier?.fullName}</DialogTitle>
          <DialogDescription>
            Pick a scheme member. Each membership has one cashier. Assigning someone who already has a cashier moves
            them here.
          </DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Search by name, mobile, or scheme"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="max-h-72 overflow-y-auto">
          {!seats ? (
            <p className="text-muted-foreground py-8 text-center text-sm">Loading members…</p>
          ) : candidates.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Everyone already assigned to this cashier, or no matching members.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {candidates.map((seat) => (
                <li key={seat.membershipId} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{seat.fullName}</p>
                    <p className="text-muted-foreground text-xs">
                      {seat.schemeName} · {seat.schemeCode} · <span className="tabular">{seat.mobile}</span>
                      {seat.collectorName ? ` · now ${seat.collectorName}` : ' · unassigned'}
                    </p>
                  </div>
                  <Button size="sm" disabled={busyId === seat.membershipId} onClick={() => void assign(seat.membershipId)}>
                    Assign
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

function AddCashierDialog({
  open,
  onOpenChange,
  cashierIds,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cashierIds: Set<string>
}) {
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newMobile, setNewMobile] = useState('')
  const [creating, setCreating] = useState(false)
  const people = useLiveQuery(
    () => peopleRepository.list().then((rows) => rows.filter((person) => person.status === 'active')),
    [],
  )

  const candidates = useMemo(() => {
    if (!people) return []
    const needle = search.trim().toLowerCase()
    return people
      .filter((person) => !cashierIds.has(person.id) && person.authUserId)
      .filter(
        (person) =>
          !needle ||
          person.fullName.toLowerCase().includes(needle) ||
          person.mobile.includes(needle),
      )
  }, [people, search, cashierIds])

  async function createStandalone() {
    setCreating(true)
    try {
      await cashiersRepository.createStandalone({ fullName: newName, mobile: newMobile })
      toast.success('Cashier added')
      setNewName('')
      setNewMobile('')
    } catch (error) {
      toast.error(toReadableError(error, 'Could not add this cashier.'))
    } finally {
      setCreating(false)
    }
  }

  async function promote(personId: string) {
    setBusyId(personId)
    try {
      await cashiersRepository.promote(personId)
      toast.success('Cashier added')
    } catch (error) {
      toast.error(toReadableError(error, 'Could not add this cashier.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add cashier</DialogTitle>
          <DialogDescription>
            Promote an existing member, or add a person who is not on a scheme. They keep their mobile login.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <p className="text-sm font-medium">New person</p>
          <Input placeholder="Full name" value={newName} onChange={(event) => setNewName(event.target.value)} />
          <Input
            placeholder="10-digit mobile"
            inputMode="numeric"
            value={newMobile}
            onChange={(event) => setNewMobile(event.target.value.replace(/\D/g, '').slice(0, 10))}
          />
          <Button
            variant="secondary"
            disabled={creating || newName.trim().length < 2 || newMobile.length !== 10}
            onClick={() => void createStandalone()}
          >
            Add as cashier
          </Button>
        </div>
        <p className="text-muted-foreground text-sm">Or pick an existing member</p>
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
                    Make cashier
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
