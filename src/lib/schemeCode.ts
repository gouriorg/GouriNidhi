const GN_CODE = /^GN-(\d+)$/i

/** Next unused scheme code: GN-001, GN-002, … */
export function nextGnSchemeCode(existingCodes: string[]): string {
  let max = 0
  for (const code of existingCodes) {
    const match = code.trim().match(GN_CODE)
    if (!match) continue
    const n = Number(match[1])
    if (Number.isFinite(n) && n > max) max = n
  }
  return `GN-${String(max + 1).padStart(3, '0')}`
}
