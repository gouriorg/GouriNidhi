import type { ComponentProps } from 'react'

import { Input } from '@/components/ui/input'
import { normalizeIndianMobileInput } from '@/lib/mobile'

/** 10-digit Indian mobile. Pasted +91 / 91 / 0 prefixes keep the last 10 digits. */
export function MobileInput({ onChange, ...props }: ComponentProps<typeof Input>) {
  return (
    <Input
      inputMode="numeric"
      autoComplete="tel"
      {...props}
      onChange={(event) => {
        const next = normalizeIndianMobileInput(event.target.value)
        if (event.target.value !== next) {
          event.target.value = next
        }
        onChange?.(event)
      }}
    />
  )
}
