import { useLiveQuery } from '@/hooks/useLiveQuery'
import { PlusIcon, SearchIcon, WalletIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'

import { EmptyState, LoadingState } from '@/components/EmptyState'
import { MoneyText } from '@/components/MoneyText'
import { PageHeader } from '@/components/PageHeader'
import { SchemeStatusBadge } from '@/components/StatusBadge'
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
import { schemesRepository } from '@/repositories/schemesRepository'
import { membershipsRepository } from '@/repositories/membershipsRepository'
import { formatDisplayDate } from '@/lib/dates'
import type { SchemeStatus } from '@/types/entities'

export function SchemesPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<SchemeStatus | 'all'>('all')

  const schemes = useLiveQuery(async () => {
    const rows = await schemesRepository.list()
    const counts = await Promise.all(rows.map((scheme) => membershipsRepository.countActive(scheme.id)))
    return rows
      .map((scheme, index) => ({ ...scheme, memberCount: counts[index] }))
      .sort((a, b) => a.code.localeCompare(b.code))
  }, [])

  const filtered = useMemo(() => {
    if (!schemes) return []
    const needle = search.trim().toLowerCase()
    return schemes.filter((scheme) => {
      const matchesStatus = statusFilter === 'all' || scheme.status === statusFilter
      const matchesSearch =
        !needle ||
        scheme.name.toLowerCase().includes(needle) ||
        scheme.code.toLowerCase().includes(needle)
      return matchesStatus && matchesSearch
    })
  }, [schemes, search, statusFilter])

  return (
    <>
      <PageHeader
        title="Schemes"
        description="Each scheme pays one member per month. Early withdrawals receive less, the last month receives the most."
        actions={
          <Button asChild>
            <Link to="/schemes/new">
              <PlusIcon /> New scheme
            </Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            className="pl-9"
            placeholder="Search by name or code"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search schemes"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as SchemeStatus | 'all')}
        >
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {schemes === undefined ? (
        <LoadingState label="Loading schemes…" />
      ) : schemes.length === 0 ? (
        <EmptyState
          icon={WalletIcon}
          title="No schemes yet"
          description="Create a scheme with the number of members, monthly amount, duration, start date and profit. GouriNidhi works out every month's payout for you."
          action={
            <Button asChild>
              <Link to="/schemes/new">
                <PlusIcon /> Create your first scheme
              </Link>
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={SearchIcon} title="No matching schemes" />
      ) : (
        <>
          <Card className="hidden py-0 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Monthly</TableHead>
                  <TableHead className="text-right">Members</TableHead>
                  <TableHead className="text-right">Months</TableHead>
                  <TableHead>Starts</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((scheme) => (
                  <TableRow key={scheme.id}>
                    <TableCell className="tabular font-medium">
                      <Link to={`/schemes/${scheme.id}`} className="hover:text-primary hover:underline">
                        {scheme.code}
                      </Link>
                    </TableCell>
                    <TableCell>{scheme.name}</TableCell>
                    <TableCell className="text-right">
                      <MoneyText amount={scheme.monthlyAmount} />
                    </TableCell>
                    <TableCell className="tabular text-right">
                      {scheme.memberCount}/{scheme.maxMembers}
                    </TableCell>
                    <TableCell className="tabular text-right">{scheme.durationMonths}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDisplayDate(scheme.startDate)}
                    </TableCell>
                    <TableCell>
                      <SchemeStatusBadge status={scheme.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="grid gap-3 md:hidden">
            {filtered.map((scheme) => (
              <Card key={scheme.id} className="gap-2 p-4">
                <Link to={`/schemes/${scheme.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{scheme.name}</p>
                      <p className="text-muted-foreground tabular text-xs">{scheme.code}</p>
                    </div>
                    <SchemeStatusBadge status={scheme.status} />
                  </div>
                  <div className="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span>
                      <MoneyText amount={scheme.monthlyAmount} className="text-foreground" /> / month
                    </span>
                    <span className="tabular">
                      {scheme.memberCount}/{scheme.maxMembers} members
                    </span>
                    <span className="tabular">{scheme.durationMonths} months</span>
                  </div>
                </Link>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  )
}
