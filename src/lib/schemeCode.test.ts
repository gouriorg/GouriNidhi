import { describe, expect, it } from 'vitest'

import { nextGnSchemeCode } from '@/lib/schemeCode'

describe('nextGnSchemeCode', () => {
  it('starts at GN-001 when there are no schemes', () => {
    expect(nextGnSchemeCode([])).toBe('GN-001')
  })

  it('increments the highest GN number and pads to three digits', () => {
    expect(nextGnSchemeCode(['GN-001', 'GN-SAMPLE', 'gn-12'])).toBe('GN-013')
  })

  it('grows past three digits when needed', () => {
    expect(nextGnSchemeCode(['GN-999'])).toBe('GN-1000')
  })
})
