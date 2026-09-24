import { features } from '@/config/features'
import type { MenuCommand } from '@/components/layout/MenuSearch'
import {
  FileTextIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  PlusIcon,
  SettingsIcon,
  ShieldIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
  BanknoteIcon,
  PhoneIcon,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

/** Admin sidebar (desktop). Change nav structure here and in AdminBottomNav only. */
export const adminNavItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboardIcon, end: true },
  { to: '/members', label: 'Members', icon: UsersIcon },
  { to: '/cashiers', label: 'Cashiers', icon: BanknoteIcon },
  { to: '/overdue', label: 'Call overdue', icon: PhoneIcon },
  { to: '/schemes', label: 'Schemes', icon: WalletIcon },
  { to: '/reports', label: 'Reports', icon: FileTextIcon },
  { to: '/roles', label: 'Roles', icon: ShieldIcon },
  ...(features.auditLog ? [{ to: '/audit', label: 'Audit log', icon: HistoryIcon } satisfies NavItem] : []),
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

/** Shown in the admin chrome only when the signed-in admin is also a member. */
export const adminMyAccountItem: NavItem = { to: '/me', label: 'My account', icon: UserIcon }

/** Items shown behind "More" on mobile bottom tabs. */
export const adminMoreNavItems: NavItem[] = adminNavItems.filter(
  (item) => !['/', '/members', '/schemes'].includes(item.to),
)

/** Spotlight search targets — sidebar pages plus a few extra jumps. */
export const adminMenuCommands: MenuCommand[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboardIcon, keywords: ['home', 'overview'] },
  { to: '/members', label: 'Members', icon: UsersIcon, keywords: ['people', 'roster', 'directory'] },
  { to: '/cashiers', label: 'Cashiers', icon: BanknoteIcon, keywords: ['collector', 'collection'] },
  {
    to: '/overdue',
    label: 'Call overdue members',
    icon: PhoneIcon,
    keywords: ['call', 'overdue', 'phone', 'pending', 'due'],
  },
  { to: '/schemes', label: 'Schemes', icon: WalletIcon, keywords: ['chit', 'group'] },
  { to: '/schemes/new', label: 'New scheme', icon: PlusIcon, keywords: ['create', 'add scheme'] },
  { to: '/reports', label: 'Reports', icon: FileTextIcon, keywords: ['export', 'statement'] },
  { to: '/roles', label: 'Roles', icon: ShieldIcon, keywords: ['admin', 'cashier', 'member'] },
  ...(features.auditLog
    ? [{ to: '/audit', label: 'Audit log', icon: HistoryIcon, keywords: ['history', 'log'] }]
    : []),
  { to: '/settings', label: 'Settings', icon: SettingsIcon, keywords: ['backup', 'supabase'] },
  {
    to: '/me',
    label: 'My account',
    icon: UserIcon,
    keywords: ['member', 'self', 'profile', 'my schemes'],
  },
]
