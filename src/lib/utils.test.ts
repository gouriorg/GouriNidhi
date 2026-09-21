import { describe, expect, it } from 'vitest'

import { cn } from '@/lib/utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('px-2', 'text-sm')).toBe('px-2 text-sm')
  })

  it('resolves conflicting tailwind classes, last wins', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('drops falsy values', () => {
    expect(cn('px-2', false, undefined, null, 'py-1')).toBe('px-2 py-1')
  })
})
