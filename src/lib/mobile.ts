/** Digits only. Drop a country code or extra prefix and keep the last 10. */
export function normalizeIndianMobileInput(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length <= 10) return digits
  return digits.slice(-10)
}
