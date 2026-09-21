import { useLiveQuery } from '@/hooks/useLiveQuery'
import { DownloadIcon, FileTextIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { EmptyState, LoadingState } from '@/components/EmptyState'
import { MoneyText } from '@/components/MoneyText'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { peopleRepository } from '@/repositories/peopleRepository'
import { schemesRepository } from '@/repositories/schemesRepository'
import {
  collectionReport,
  memberStatement,
  payoutReport,
  schemeStatement,
  type ReportFilters,
} from '@/features/reports/reportsService'
import { downloadTextFile, toCsv } from '@/lib/csv'
import { todayIso } from '@/lib/dates'

type ReportKind = 'collection' | 'payout' | 'scheme' | 'member'

const reportLabels: Record<ReportKind, string> = {
  collection: 'Collection',
  payout: 'Payout',
  scheme: 'Scheme statement',
  member: 'Member statement',
}

export function ReportsPage() {
  const [kind, setKind] = useState<ReportKind>('collection')
  const [filters, setFilters] = useState<ReportFilters>({ status: 'all' })

  const schemes = useLiveQuery(() => schemesRepository.list(), [])
  const people = useLiveQuery(() => peopleRepository.list(), [])

  const report = useLiveQuery(async () => {
    switch (kind) {
      case 'collection':
        return collectionReport(filters)
      case 'payout':
        return payoutReport(filters)
      case 'scheme':
        return schemeStatement(filters)
      case 'member':
        return memberStatement(filters)
    }
  }, [kind, filters])

  function exportCsv() {
    if (!report || report.rows.length === 0) {
      toast.error('Nothing to export for these filters.')
      return
    }
    const csv = toCsv(
      report.columns.map((column) => column.label),
      report.rows.map((row) => report.columns.map((column) => row[column.key] ?? '')),
    )
    downloadTextFile(`gourinidhi-${kind}-${todayIso()}.csv`, csv)
    toast.success('CSV downloaded')
  }

  const needsScheme = kind === 'scheme' && !filters.schemeId
  const needsPerson = kind === 'member' && !filters.personId

  return (
    <>
      <PageHeader
        title="Reports"
        description="Filter your records and export them as CSV. Amounts are included in both rupees and paise."
        actions={
          <Button onClick={exportCsv} disabled={!report || report.rows.length === 0}>
            <DownloadIcon /> Export CSV
          </Button>
        }
      />

      <Tabs value={kind} onValueChange={(value) => setKind(value as ReportKind)} className="mb-5">
        <TabsList>
          {Object.entries(reportLabels).map(([value, label]) => (
            <TabsTrigger key={value} value={value}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card className="mb-5 p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="grid gap-2">
            <Label htmlFor="filter-scheme">Scheme</Label>
            <Select
              value={filters.schemeId ?? 'all'}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, schemeId: value === 'all' ? undefined : value }))
              }
            >
              <SelectTrigger id="filter-scheme" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All schemes</SelectItem>
                {schemes?.map((scheme) => (
                  <SelectItem key={scheme.id} value={scheme.id}>
                    {scheme.code} — {scheme.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="filter-person">Member</Label>
            <Select
              value={filters.personId ?? 'all'}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, personId: value === 'all' ? undefined : value }))
              }
            >
              <SelectTrigger id="filter-person" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All members</SelectItem>
                {people?.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="filter-from">From</Label>
            <Input
              id="filter-from"
              type="date"
              value={filters.from ?? ''}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, from: event.target.value || undefined }))
              }
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="filter-to">To</Label>
            <Input
              id="filter-to"
              type="date"
              value={filters.to ?? ''}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, to: event.target.value || undefined }))
              }
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="filter-status">Status</Label>
            <Select
              value={filters.status ?? 'all'}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
            >
              <SelectTrigger id="filter-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {kind === 'payout' ? (
                  <>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="partially_paid">Partially paid</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="waived">Waived</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {needsScheme || needsPerson ? (
        <EmptyState
          icon={FileTextIcon}
          title={needsScheme ? 'Choose a scheme' : 'Choose a member'}
          description={`A ${needsScheme ? 'scheme' : 'member'} statement covers one ${needsScheme ? 'scheme' : 'member'} at a time. Pick one above.`}
        />
      ) : report === undefined ? (
        <LoadingState label="Building report…" />
      ) : report.rows.length === 0 ? (
        <EmptyState
          icon={FileTextIcon}
          title="No records match"
          description="Widen the date range or clear a filter."
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-3">
            {report.totals.map((total) => (
              <Card key={total.label} className="gap-1 px-4 py-3">
                <span className="text-muted-foreground text-xs">{total.label}</span>
                <MoneyText amount={total.amount} className="text-base font-bold" />
              </Card>
            ))}
          </div>

          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {report.columns.map((column) => (
                    <TableHead key={column.key} className={column.numeric ? 'text-right' : ''}>
                      {column.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((row, index) => (
                  <TableRow key={index}>
                    {report.columns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={column.numeric ? 'tabular text-right' : ''}
                      >
                        {String(row[column.key] ?? '')}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <p className="text-muted-foreground mt-3 text-xs">
            {report.rows.length} row{report.rows.length === 1 ? '' : 's'}
          </p>
        </>
      )}
    </>
  )
}
