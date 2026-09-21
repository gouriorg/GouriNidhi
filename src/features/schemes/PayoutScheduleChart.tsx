import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { formatINR, toRupees } from '@/domain/money/money'
import type { ScheduleLine } from '@/types/entities'

/** Bar chart of the rising monthly payout, with the pool marked as a baseline. */
export function PayoutScheduleChart({
  lines,
  highlightMonth,
}: {
  lines: ScheduleLine[]
  highlightMonth?: number
}) {
  const data = lines.map((line) => ({
    month: line.monthNumber,
    payout: toRupees(line.plannedPayoutAmount),
    paise: line.plannedPayoutAmount,
  }))
  const pool = lines[0] ? toRupees(lines[0].grossPool) : 0

  return (
    <div className="h-64 w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            width={64}
            tickFormatter={(value: number) =>
              new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(
                value,
              )
            }
            domain={['dataMin - 5000', 'dataMax + 5000']}
          />
          <Tooltip
            cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              fontSize: 12,
              color: 'var(--popover-foreground)',
            }}
            formatter={(_value, _name, item) => [
              formatINR((item.payload as { paise: number }).paise),
              'Payout',
            ]}
            labelFormatter={(label) => `Month ${label}`}
          />
          <ReferenceLine
            y={pool}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
            label={{
              value: 'Monthly pool',
              position: 'insideTopLeft',
              fontSize: 10,
              fill: 'var(--muted-foreground)',
            }}
          />
          <Bar dataKey="payout" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.month}
                fill={
                  highlightMonth === entry.month
                    ? 'var(--color-chart-2)'
                    : 'var(--color-chart-1)'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
