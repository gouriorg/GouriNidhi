import { MoneyText } from '@/components/MoneyText'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDisplayDate, formatShortMonth } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { ScheduleLine } from '@/types/entities'

export type RecipientLookup = Record<number, { name: string; paid: boolean } | undefined>

/**
 * The auto-calculated rotating payout schedule.
 * Recipient names are admin-only; pass `showRecipients={false}` for members.
 */
export function PayoutScheduleTable({
  lines,
  recipients,
  showRecipients = true,
  highlightMonth,
}: {
  lines: ScheduleLine[]
  recipients?: RecipientLookup
  showRecipients?: boolean
  highlightMonth?: number
}) {
  return (
    <>
      <Card className="hidden py-0 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead>Payout date</TableHead>
              <TableHead className="text-right">Expected collection</TableHead>
              <TableHead className="text-right">Adjustment</TableHead>
              <TableHead className="text-right">Payout to winner</TableHead>
              {showRecipients && <TableHead>Recipient</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => {
              const recipient = recipients?.[line.monthNumber]
              const highlighted = highlightMonth === line.monthNumber
              return (
                <TableRow
                  key={line.monthNumber}
                  className={cn(highlighted && 'bg-primary/8 hover:bg-primary/12')}
                >
                  <TableCell className="font-medium">
                    {formatShortMonth(line.dueDate)}
                    {highlighted && (
                      <span className="text-primary ml-2 text-xs font-semibold">Your month</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDisplayDate(line.dueDate)}
                  </TableCell>
                  <TableCell className="text-right">
                    <MoneyText amount={line.grossPool} />
                  </TableCell>
                  <TableCell className="text-right">
                    <MoneyText amount={line.adjustment} signed colored />
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    <MoneyText amount={line.plannedPayoutAmount} />
                  </TableCell>
                  {showRecipients && (
                    <TableCell className="text-muted-foreground">
                      {recipient ? (
                        <span className={cn(recipient.paid && 'text-success font-medium')}>
                          {recipient.name}
                          {recipient.paid ? ' (paid)' : ''}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Stacked cards on phones */}
      <div className="grid gap-2 md:hidden">
        {lines.map((line) => {
          const recipient = recipients?.[line.monthNumber]
          const highlighted = highlightMonth === line.monthNumber
          return (
            <Card
              key={line.monthNumber}
              className={cn('gap-2 p-4', highlighted && 'border-primary bg-primary/5')}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">
                  {formatShortMonth(line.dueDate)}
                  {highlighted && <span className="text-primary ml-2 text-xs">Your month</span>}
                </span>
                <span className="text-muted-foreground text-xs">
                  {formatDisplayDate(line.dueDate)}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-muted-foreground text-xs">Payout to winner</span>
                <MoneyText amount={line.plannedPayoutAmount} className="text-lg font-bold" />
              </div>
              <div className="text-muted-foreground flex items-baseline justify-between gap-2 text-xs">
                <span>
                  Pool <MoneyText amount={line.grossPool} />
                </span>
                <MoneyText amount={line.adjustment} signed colored />
              </div>
              {showRecipients && recipient && (
                <p className="text-muted-foreground text-xs">
                  Recipient: <span className="text-foreground">{recipient.name}</span>
                  {recipient.paid ? ' (paid)' : ''}
                </p>
              )}
            </Card>
          )
        })}
      </div>
    </>
  )
}
