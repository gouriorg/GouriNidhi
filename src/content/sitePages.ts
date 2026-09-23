export type SiteContact = {
  organization: string
  addressLines: string[]
  phone: string
  email: string
  hours: string
  notes: string
}

export type SiteOrganizer = {
  id: string
  name: string
  role: string
  phone: string
  email: string
  notes: string
}

/** Members and cashiers only see organizers whose name has been filled in. */
export function isOrganizerNameFilled(name: string): boolean {
  const trimmed = name.trim()
  if (!trimmed) return false
  return !(trimmed.startsWith('[') && trimmed.endsWith(']'))
}

export type SiteTermsSection = {
  heading: string
  body: string
}

export type SiteTerms = {
  updatedLabel: string
  sections: SiteTermsSection[]
}

/**
 * Fallback copy until an admin saves Contact, Organizers or Terms in the app.
 */
export const defaultContact: SiteContact = {
  organization: 'GouriNidhi',
  addressLines: ['[Street address]', '[Area]', '[City], [State] [PIN]'],
  phone: '[Phone number]',
  email: '[email@example.com]',
  hours: '[Weekdays, hours]',
  notes: '',
}

export const defaultOrganizers: SiteOrganizer[] = [
  {
    id: 'organizer-1',
    name: '[Organizer name]',
    role: 'Organizer',
    phone: '[Phone]',
    email: '[email@example.com]',
    notes: '',
  },
  {
    id: 'organizer-2',
    name: '[Co-organizer name]',
    role: 'Co-organizer',
    phone: '[Phone]',
    email: '[email@example.com]',
    notes: '',
  },
]

export const defaultTerms: SiteTerms = {
  updatedLabel: 'Last updated: 23 Sep 2026',
  sections: [
    {
      heading: '1. Monthly payment',
      body: 'Every member must transfer their monthly contribution before the 10th of each month. Payment can be made via UPI or cash.',
    },
    {
      heading: '2. No volunteer for payout',
      body: 'If no member is willing to take the monthly payout, a lottery will be conducted. The selected member will receive the amount via UPI or cash.',
    },
    {
      heading: '3. Multiple volunteers',
      body: 'If more than one member is interested in taking the payout, a lottery system will be used. The member whose name is picked will receive the payout.',
    },
    {
      heading: '4. Intimation for payout',
      body: 'Members who are interested in taking the payout must inform the organizer at least one month in advance.',
    },
    {
      heading: '5. Monthly payout',
      body: 'The payout will be distributed around the 20th of every month, as per the predefined chart. All members must follow the payout structure strictly.',
    },
  ],
}

export const contactPage = {
  title: 'Contact',
  description: 'How to reach the GouriNidhi organizers.',
}

export const organizersPage = {
  title: 'Organizers',
  description: 'People who run GouriNidhi schemes.',
}

export const termsPage = {
  title: 'Terms & conditions',
  description: 'How GouriNidhi schemes work for members and organizers.',
}

export const siteLinks = [
  { to: '/contact', label: 'Contact' },
  { to: '/organizers', label: 'Organizers' },
  { to: '/terms', label: 'Terms' },
] as const
