import type { Session } from '@/stores/session'

/** Only two roles exist in the MVP. */
export type AppRole = 'admin' | 'member'

export type Action =
  | 'members.manage'
  | 'schemes.manage'
  | 'memberships.manage'
  | 'rounds.manage'
  | 'payments.manage'
  | 'payouts.manage'
  | 'reports.view'
  | 'audit.view'
  | 'backup.manage'
  | 'settings.manage'
  | 'self.view'

const adminActions: Action[] = [
  'members.manage',
  'schemes.manage',
  'memberships.manage',
  'rounds.manage',
  'payments.manage',
  'payouts.manage',
  'reports.view',
  'audit.view',
  'backup.manage',
  'settings.manage',
  'self.view',
]

/** Members can only read their own data. */
const memberActions: Action[] = ['self.view']

export function can(role: AppRole, action: Action): boolean {
  return role === 'admin' ? adminActions.includes(action) : memberActions.includes(action)
}

export function roleOf(session: Session): AppRole | null {
  if (!session) return null
  return session.kind === 'admin' ? 'admin' : 'member'
}
