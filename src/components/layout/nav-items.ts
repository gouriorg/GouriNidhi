import { features } from '@/config/features'
import {
  FileTextIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  ShieldIcon,
  UsersIcon,
  WalletIcon,
  BanknoteIcon,
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
  { to: '/schemes', label: 'Schemes', icon: WalletIcon },
  { to: '/reports', label: 'Reports', icon: FileTextIcon },
  { to: '/roles', label: 'Roles', icon: ShieldIcon },
  ...(features.auditLog ? [{ to: '/audit', label: 'Audit log', icon: HistoryIcon } satisfies NavItem] : []),
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

/** Items shown behind "More" on mobile bottom tabs. */
export const adminMoreNavItems: NavItem[] = adminNavItems.filter(
  (item) => !['/', '/members', '/schemes'].includes(item.to),
)
