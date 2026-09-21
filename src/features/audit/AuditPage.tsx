import { useLiveQuery } from '@/hooks/useLiveQuery'
import { HistoryIcon, SearchIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { EmptyState, LoadingState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
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
import { auditService } from '@/services/audit'
import { formatDisplayDateTime } from '@/lib/dates'
import type { AuditEntityType } from '@/types/entities'

const entityLabels: Record<AuditEntityType, string> = {
  person: 'Member',
  scheme: 'Scheme',
  schemeMember: 'Membership',
  round: 'Round',
  payment: 'Payment',
  payout: 'Payout',
  settings: 'Settings',
  backup: 'Backup',
}

export function AuditPage() {
  const [search, setSearch] = useState('')
  const [entityType, setEntityType] = useState<AuditEntityType | 'all'>('all')
  const [action, setAction] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const logs = useLiveQuery(() => auditService.list(), [])

  const actions = useMemo(
    () => [...new Set((logs ?? []).map((log) => log.action))].sort(),
    [logs],
  )

  const filtered = useMemo(() => {
    if (!logs) return []
    const needle = search.trim().toLowerCase()
    return logs.filter((log) => {
      if (entityType !== 'all' && log.entityType !== entityType) return false
      if (action !== 'all' && log.action !== action) return false
      const day = log.createdAt.slice(0, 10)
      if (from && day < from) return false
      if (to && day > to) return false
      if (
        needle &&
        !log.summary.toLowerCase().includes(needle) &&
        !log.actorLabel.toLowerCase().includes(needle)
      ) {
        return false
      }
      return true
    })
  }, [logs, search, entityType, action, from, to])

  return (
    <>
      <PageHeader
        title="Audit log"
        description="An append-only record of every change. Entries can never be edited or deleted."
      />

      <Card className="mb-5 p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              className="pl-9"
              placeholder="Search the log"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search audit log"
            />
          </div>
          <Select
            value={entityType}
            onValueChange={(value) => setEntityType(value as AuditEntityType | 'all')}
          >
            <SelectTrigger className="w-full" aria-label="Filter by record type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All record types</SelectItem>
              {Object.entries(entityLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="w-full" aria-label="Filter by action">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {actions.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              aria-label="From date"
            />
            <Input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              aria-label="To date"
            />
          </div>
        </div>
      </Card>

      {logs === undefined ? (
        <LoadingState label="Loading history…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title={logs.length === 0 ? 'Nothing recorded yet' : 'No matching entries'}
          description={
            logs.length === 0
              ? 'Every member, scheme, payment and payout change will be listed here.'
              : 'Try clearing a filter or widening the dates.'
          }
        />
      ) : (
        <>
          <Card className="hidden py-0 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Record</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground tabular whitespace-nowrap">
                      {formatDisplayDateTime(log.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="muted" className="font-mono text-[11px]">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {entityLabels[log.entityType]}
                    </TableCell>
                    <TableCell className="whitespace-normal">{log.summary}</TableCell>
                    <TableCell className="text-muted-foreground">{log.actorLabel}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="grid gap-3 md:hidden">
            {filtered.map((log) => (
              <Card key={log.id} className="gap-1.5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <Badge variant="muted" className="font-mono text-[11px]">
                    {log.action}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    {formatDisplayDateTime(log.createdAt)}
                  </span>
                </div>
                <p className="text-sm">{log.summary}</p>
                <p className="text-muted-foreground text-xs">by {log.actorLabel}</p>
              </Card>
            ))}
          </div>

          <p className="text-muted-foreground mt-3 text-xs">{filtered.length} entries</p>
        </>
      )}
    </>
  )
}
