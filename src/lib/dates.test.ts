import { describe, expect, it } from 'vitest'

import {
  clampCollectionDay,
  dueDateForMonth,
  formatDisplayDate,
  formatMonthLabel,
  isPastDue,
  isValidDateOnly,
} from '@/lib/dates'

describe('dueDateForMonth', () => {
  it('uses the collection day of the start month when it has not passed', () => {
    expect(dueDateForMonth('2026-01-01', 0, 1)).toBe('2026-01-01')
    expect(dueDateForMonth('2026-01-01', 1, 1)).toBe('2026-02-01')
    expect(dueDateForMonth('2026-01-05', 0, 10)).toBe('2026-01-10')
  })

  it('never schedules the first collection before the start date', () => {
    // Starting on the 20th with collection day 1 begins the following month.
    expect(dueDateForMonth('2026-09-20', 0, 1)).toBe('2026-10-01')
    expect(dueDateForMonth('2026-09-20', 1, 1)).toBe('2026-11-01')
  })

  it('rolls across a year boundary', () => {
    expect(dueDateForMonth('2026-12-01', 1, 1)).toBe('2027-01-01')
    expect(dueDateForMonth('2026-01-15', 11, 15)).toBe('2026-12-15')
    expect(dueDateForMonth('2026-01-15', 12, 15)).toBe('2027-01-15')
  })

  it('avoids month-end overflow by clamping to day 28', () => {
    expect(dueDateForMonth('2026-01-01', 1, 31)).toBe('2026-02-28')
    expect(clampCollectionDay(31)).toBe(28)
    expect(clampCollectionDay(0)).toBe(1)
    expect(clampCollectionDay(-5)).toBe(1)
  })

  it('handles February in a leap year without shifting', () => {
    expect(dueDateForMonth('2028-01-28', 1, 28)).toBe('2028-02-28')
  })
})

describe('date formatting', () => {
  it('validates yyyy-MM-dd strings', () => {
    expect(isValidDateOnly('2026-01-01')).toBe(true)
    expect(isValidDateOnly('2026-1-1')).toBe(false)
    expect(isValidDateOnly('not a date')).toBe(false)
    expect(isValidDateOnly('2026-13-01')).toBe(false)
  })

  it('formats for display', () => {
    expect(formatDisplayDate('2026-01-09')).toBe('09 Jan 2026')
    expect(formatDisplayDate(undefined)).toBe('—')
    expect(formatMonthLabel('2026-03-01')).toBe('Mar 2026')
  })

  it('detects overdue dates', () => {
    expect(isPastDue('2026-01-01', '2026-01-02')).toBe(true)
    expect(isPastDue('2026-01-02', '2026-01-02')).toBe(false)
    expect(isPastDue('2026-02-01', '2026-01-02')).toBe(false)
  })
})
