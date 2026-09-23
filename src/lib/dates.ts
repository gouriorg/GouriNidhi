import { addMonths, format, isValid, parseISO, startOfDay } from 'date-fns'

import type { DateOnly } from '@/types/entities'

export const DATE_FORMAT = 'yyyy-MM-dd'

/** Today as `yyyy-MM-dd` in the browser's local timezone. */
export function todayIso(): DateOnly {
  return format(startOfDay(new Date()), DATE_FORMAT)
}

export function toDateOnly(date: Date): DateOnly {
  return format(date, DATE_FORMAT)
}

export function parseDateOnly(value: DateOnly): Date {
  // parseISO on `yyyy-MM-dd` yields local midnight, avoiding UTC shift bugs.
  return parseISO(value)
}

export function isValidDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value))
}

/** Human display, e.g. "01 Jan 2026". */
export function formatDisplayDate(value?: DateOnly): string {
  if (!value || !isValidDateOnly(value)) return '—'
  return format(parseDateOnly(value), 'dd MMM yyyy')
}

/** "Jan 2026" for round headings. */
export function formatMonthLabel(value: DateOnly): string {
  if (!isValidDateOnly(value)) return '—'
  return format(parseDateOnly(value), 'MMM yyyy')
}

/** "Sep 26" for cashier month buttons. */
export function formatShortMonth(value?: DateOnly): string {
  if (!value || !isValidDateOnly(value)) return '—'
  return format(parseDateOnly(value), 'MMM yy')
}

export function formatDisplayDateTime(iso: string): string {
  const date = new Date(iso)
  if (!isValid(date)) return '—'
  return format(date, 'dd MMM yyyy, HH:mm')
}

/**
 * Due date for a round: the collection day of the Nth month of the scheme.
 *
 * Month 1 is the first collection day that falls on or after the start date,
 * so a scheme starting on the 20th with collection day 1 begins the following
 * month rather than in the past. collectionDay is clamped to 1–28 so no
 * month-end overflow can occur.
 */
export function dueDateForMonth(
  startDate: DateOnly,
  monthOffset: number,
  collectionDay: number,
): DateOnly {
  const start = parseDateOnly(startDate)
  const day = clampCollectionDay(collectionDay)

  let first = new Date(start.getFullYear(), start.getMonth(), day)
  if (toDateOnly(first) < startDate) {
    first = addMonths(first, 1)
  }

  const result = addMonths(first, monthOffset)
  return toDateOnly(result)
}

export function clampCollectionDay(day: number): number {
  if (!Number.isFinite(day)) return 1
  return Math.min(28, Math.max(1, Math.round(day)))
}

/** A due date is overdue when it is strictly before today. */
export function isPastDue(dueDate: DateOnly, today: DateOnly = todayIso()): boolean {
  return dueDate < today
}

/** Current calendar month and every older month — these open collection automatically. */
export function isCurrentOrPastMonth(dueDate: DateOnly, today: DateOnly = todayIso()): boolean {
  return dueDate.slice(0, 7) <= today.slice(0, 7)
}
