/**
 * MVP credentials.
 *
 * WARNING: this is not security. Members, cashiers, and assigned admins sign in
 * with their mobile number as both username and password. Anyone with access to
 * this browser profile can open the app.
 */

/** `{mobile}@members.gourinidhi.local` — required by Supabase Auth, hidden from the UI. */
export const MEMBER_EMAIL_DOMAIN = 'members.gourinidhi.local'

export function memberEmail(mobile: string): string {
  return `${mobile.trim()}@${MEMBER_EMAIL_DOMAIN}`
}
