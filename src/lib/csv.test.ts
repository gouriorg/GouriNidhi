import { describe, expect, it } from 'vitest'

import { escapeCsvValue, toCsv } from '@/lib/csv'

describe('csv', () => {
  it('leaves plain values alone', () => {
    expect(escapeCsvValue('Ravi')).toBe('Ravi')
    expect(escapeCsvValue(4000)).toBe('4000')
  })

  it('quotes values containing a comma', () => {
    expect(escapeCsvValue('12 MG Road, Bengaluru')).toBe('"12 MG Road, Bengaluru"')
  })

  it('doubles embedded quotes', () => {
    expect(escapeCsvValue('He said "hello"')).toBe('"He said ""hello"""')
  })

  it('quotes newlines', () => {
    expect(escapeCsvValue('line1\nline2')).toBe('"line1\nline2"')
  })

  it('renders empty strings for null and undefined', () => {
    expect(escapeCsvValue(null)).toBe('')
    expect(escapeCsvValue(undefined)).toBe('')
  })

  it('builds a full document with CRLF rows', () => {
    const csv = toCsv(
      ['Name', 'Amount'],
      [
        ['Ravi', '4000.00'],
        ['Anita, A', '4000.00'],
      ],
    )
    expect(csv).toBe('Name,Amount\r\nRavi,4000.00\r\n"Anita, A",4000.00')
  })
})
