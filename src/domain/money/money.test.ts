import { describe, expect, it } from 'vitest'

import {
  addPaise,
  applyBps,
  assertPaise,
  bpsToPercent,
  formatINR,
  formatRupeesPlain,
  fromRupees,
  multiplyPaise,
  parseRupeeInput,
  percentToBps,
  subtractPaise,
  sumPaise,
  toRupees,
} from '@/domain/money/money'

describe('money', () => {
  it('converts rupees to integer paise', () => {
    expect(fromRupees(4000)).toBe(400_000)
    expect(fromRupees(4000.5)).toBe(400_050)
    expect(fromRupees(0)).toBe(0)
  })

  it('round-trips paise to rupees', () => {
    expect(toRupees(400_000)).toBe(4000)
    expect(toRupees(400_050)).toBe(4000.5)
  })

  it('avoids float drift on repeated addition', () => {
    // 0.1 + 0.2 !== 0.3 in floats; in paise it is exact.
    const total = addPaise(fromRupees(0.1), fromRupees(0.2))
    expect(total).toBe(30)
    expect(toRupees(total)).toBe(0.3)
  })

  it('sums a monthly pool exactly', () => {
    const monthly = fromRupees(4000)
    const pool = sumPaise(Array.from({ length: 20 }, () => monthly))
    expect(pool).toBe(8_000_000)
    expect(formatINR(pool)).toBe('₹80,000')
  })

  it('subtracts and multiplies in paise', () => {
    expect(subtractPaise(8_000_000, 800_000)).toBe(7_200_000)
    expect(multiplyPaise(400_000, 20)).toBe(8_000_000)
  })

  it('rejects fractional paise', () => {
    expect(() => assertPaise(10.5)).toThrow(/whole number of paise/)
    expect(() => addPaise(1.5, 2)).toThrow()
  })

  it('rejects non-finite values', () => {
    expect(() => assertPaise(Number.NaN)).toThrow()
    expect(() => assertPaise(Number.POSITIVE_INFINITY)).toThrow()
    expect(() => fromRupees(Number.NaN)).toThrow()
  })

  it('formats INR in en-IN grouping', () => {
    expect(formatINR(8_000_000)).toBe('₹80,000')
    expect(formatINR(7_200_000)).toBe('₹72,000')
    expect(formatINR(10_000_000)).toBe('₹1,00,000')
    expect(formatINR(400_050, { precise: true })).toBe('₹4,000.50')
  })

  it('formats plain rupees for CSV', () => {
    expect(formatRupeesPlain(400_050)).toBe('4000.50')
  })

  it('parses user input', () => {
    expect(parseRupeeInput('4,000')).toBe(400_000)
    expect(parseRupeeInput('₹4000.50')).toBe(400_050)
    expect(parseRupeeInput('')).toBeNull()
    expect(parseRupeeInput('abc')).toBeNull()
    expect(parseRupeeInput('-5')).toBeNull()
  })

  it('handles basis points', () => {
    expect(percentToBps(10)).toBe(1000)
    expect(bpsToPercent(1000)).toBe(10)
    expect(applyBps(8_000_000, 1000)).toBe(800_000)
    expect(applyBps(8_000_000, 0)).toBe(0)
  })
})
