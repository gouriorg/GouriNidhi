import type { Session } from '@/stores/session'
import { isAdminSession, isCashierSession } from '@/stores/session'

export type AppRole = 'admin' | 'member' | 'cashier'

export type Action =
  | 'members.manage'
  | 'schemes.manage'
  | 'memberships.manage'
  | 'rounds.manage'
  | 'payments.manage'
  | 'payouts.manage'
  | 'cashiers.manage'
  | 'payments.collect'
  | 'payouts.handover'
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
  'cashiers.manage',
  'payments.collect',
  'payouts.handover',
  'reports.view',
  'audit.view',
  'backup.manage',
  'settings.manage',
  'self.view',
]

const cashierActions: Action[] = ['payments.collect', 'payouts.handover', 'self.view']
const memberActions: Action[] = ['self.view']

export function can(role: AppRole, action: Action): boolean {
  if (role === 'admin') return adminActions.includes(action)
  if (role === 'cashier') return cashierActions.includes(action)
  return memberActions.includes(action)
}

export function roleOf(session: Session): AppRole | null {
  if (!session) return null
  if (isAdminSession(session)) return 'admin'
  if (isCashierSession(session)) return 'cashier'
  return 'member'
}
