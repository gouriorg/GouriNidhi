/**
 * MVP credentials.
 *
 * WARNING: this is not security. The admin username and password are hardcoded
 * in the client bundle, and members sign in with their mobile number as both
 * username and password. Anyone with access to this browser profile can open
 * the app. Replace this file with a real admin account (hashed credential,
 * or a server) before using GouriNidhi for anything beyond family record-keeping.
 */
export const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'admin',
} as const

/** Synthetic email for the hardcoded admin Auth user. Members never see this. */
export const ADMIN_EMAIL = 'admin@gourinidhi.local'

/** `{mobile}@members.gourinidhi.local` — required by Supabase Auth, hidden from the UI. */
export const MEMBER_EMAIL_DOMAIN = 'members.gourinidhi.local'

export function memberEmail(mobile: string): string {
  return `${mobile.trim()}@${MEMBER_EMAIL_DOMAIN}`
}

export const AUTH_WARNING =
  'MVP login is not secure. Admin is admin/admin. Members use their mobile number as the password. Data is stored in your shared Supabase project.'
