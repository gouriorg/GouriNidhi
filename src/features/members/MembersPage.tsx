import { useLiveQuery } from '@/hooks/useLiveQuery'
import { PhoneIcon, PlusIcon, SearchIcon, UsersIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'

import { EmptyState, LoadingState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { PersonStatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MemberFormDialog } from '@/features/members/MemberFormDialog'
import { peopleRepository } from '@/repositories/peopleRepository'
import type { PersonStatus } from '@/types/entities'

export function MembersPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<PersonStatus | 'all'>('all')
  const [dialogOpen, setDialogOpen] = useState(false)

  const people = useLiveQuery(() => peopleRepository.list(), [])

  const filtered = useMemo(() => {
    if (!people) return []
    const needle = search.trim().toLowerCase()
    return people.filter((person) => {
      const matchesStatus = statusFilter === 'all' || person.status === statusFilter
      const matchesSearch =
        !needle ||
        person.fullName.toLowerCase().includes(needle) ||
        person.mobile.includes(needle)
      return matchesStatus && matchesSearch
    })
  }, [people, search, statusFilter])

  return (
    <>
      <PageHeader
        title="Members"
        description="Everyone who can join a scheme. Their mobile number is also their login."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <PlusIcon /> Add member
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            className="pl-9"
            placeholder="Search by name or mobile"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search members"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as PersonStatus | 'all')}
        >
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {people === undefined ? (
        <LoadingState label="Loading members…" />
      ) : people.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="No members yet"
          description="Add the people who will take part in your chit schemes. You only need a name and a mobile number."
          action={
            <Button onClick={() => setDialogOpen(true)}>
              <PlusIcon /> Add your first member
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={SearchIcon}
          title="No matching members"
          description="Try a different name, mobile number, or status filter."
        />
      ) : (
        <>
          {/* Table from md up */}
          <Card className="hidden py-0 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((person) => (
                  <TableRow key={person.id}>
                    <TableCell className="font-medium">
                      <Link to={`/members/${person.id}`} className="hover:text-primary hover:underline">
                        {person.fullName}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular">{person.mobile}</TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {person.address || '—'}
                    </TableCell>
                    <TableCell>
                      <PersonStatusBadge status={person.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/members/${person.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Cards on phones */}
          <div className="grid gap-3 md:hidden">
            {filtered.map((person) => (
              <Card key={person.id} className="gap-2 p-4">
                <Link to={`/members/${person.id}`} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{person.fullName}</p>
                    <p className="text-muted-foreground tabular mt-1 flex items-center gap-1.5 text-sm">
                      <PhoneIcon className="size-3.5" />
                      {person.mobile}
                    </p>
                    {person.address && (
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                        {person.address}
                      </p>
                    )}
                  </div>
                  <PersonStatusBadge status={person.status} />
                </Link>
              </Card>
            ))}
          </div>
        </>
      )}

      <MemberFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}
