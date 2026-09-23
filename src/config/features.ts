function envFlag(value: string | undefined, defaultOn = false): boolean {
  if (value === undefined || value.trim() === '') return defaultOn
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

/** Feature flags from Vite env. Restart `npm run dev` after changing them. */
export const features = {
  /**
   * Writes to `audit_logs` and the admin Audit log screen.
   * Off by default so routine collection does not fill the table.
   * Enable later with `VITE_AUDIT_LOG_ENABLED=true`.
   */
  auditLog: envFlag(import.meta.env.VITE_AUDIT_LOG_ENABLED, false),
} as const
