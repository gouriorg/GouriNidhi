/**
 * Money is stored as integer paise. ₹4,000.00 === 400000.
 * Never store or compute rupees as floats.
 */
export type Paise = number

const PAISE_PER_RUPEE = 100

export class MoneyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MoneyError'
  }
}

/** Runtime guard: a valid amount is a finite, safe integer number of paise. */
export function assertPaise(value: number, label = 'amount'): asserts value is Paise {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new MoneyError(`${label} must be a whole number of paise, received ${value}`)
  }
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`${label} exceeds the safe integer range`)
  }
}

export function isPaise(value: unknown): value is Paise {
  return typeof value === 'number' && Number.isSafeInteger(value)
}

/** Convert a rupee amount (may have 2 decimals) into integer paise. */
export function fromRupees(rupees: number): Paise {
  if (!Number.isFinite(rupees)) {
    throw new MoneyError(`Cannot convert ${rupees} rupees to paise`)
  }
  // Round through a string-free path that tolerates float noise like 4000.004999
  const paise = Math.round(rupees * PAISE_PER_RUPEE)
  assertPaise(paise)
  return paise
}

/** Convert integer paise back to a rupee number. Display only, never for math. */
export function toRupees(paise: Paise): number {
  assertPaise(paise)
  return paise / PAISE_PER_RUPEE
}

export function addPaise(...values: Paise[]): Paise {
  let total = 0
  for (const value of values) {
    assertPaise(value)
    total += value
  }
  assertPaise(total, 'sum')
  return total
}

export function subtractPaise(a: Paise, b: Paise): Paise {
  assertPaise(a)
  assertPaise(b)
  return a - b
}

export function multiplyPaise(amount: Paise, factor: number): Paise {
  assertPaise(amount)
  if (!Number.isFinite(factor)) {
    throw new MoneyError(`Cannot multiply by ${factor}`)
  }
  const result = Math.round(amount * factor)
  assertPaise(result, 'product')
  return result
}

export function sumPaise(values: Paise[]): Paise {
  return addPaise(...values)
}

export function maxPaise(a: Paise, b: Paise): Paise {
  return a >= b ? a : b
}

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const inrFormatterPrecise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** ₹80,000 style output for display. */
export function formatINR(paise: Paise, options?: { precise?: boolean }): string {
  assertPaise(paise)
  const rupees = toRupees(paise)
  return options?.precise ? inrFormatterPrecise.format(rupees) : inrFormatter.format(rupees)
}

/** Plain rupee number for CSV / inputs (no currency symbol). */
export function formatRupeesPlain(paise: Paise): string {
  assertPaise(paise)
  return (paise / PAISE_PER_RUPEE).toFixed(2)
}

/** Parse free-form user input ("4,000", "4000.50", "₹4000") into paise. */
export function parseRupeeInput(input: string): Paise | null {
  const cleaned = input.replace(/[₹,\s]/g, '')
  if (cleaned === '') return null
  const value = Number(cleaned)
  if (!Number.isFinite(value) || value < 0) return null
  return fromRupees(value)
}

/** Basis points helpers: 10% === 1000 bps. Keeps percentages off the float path. */
export function percentToBps(percent: number): number {
  if (!Number.isFinite(percent)) {
    throw new MoneyError(`Invalid percent ${percent}`)
  }
  return Math.round(percent * 100)
}

export function bpsToPercent(bps: number): number {
  return bps / 100
}

/** Apply basis points to an amount, rounded to whole paise. */
export function applyBps(amount: Paise, bps: number): Paise {
  assertPaise(amount)
  const result = Math.round((amount * bps) / 10_000)
  assertPaise(result, 'bps result')
  return result
}
