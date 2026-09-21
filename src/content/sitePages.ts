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
  updatedLabel: 'Last updated: [date]',
  sections: [
    {
      heading: '1. About these terms',
      body: 'These terms will describe how members join a scheme, contribute each month, and receive a payout.',
    },
    {
      heading: '2. Membership',
      body: 'Explain eligibility, how a member is added, and that the mobile number is used to sign in.',
    },
    {
      heading: '3. Contributions and payouts',
      body: 'Explain the monthly contribution, the rotating payout schedule, and that GouriNidhi does not take payments through a gateway.',
    },
    {
      heading: '4. Organizer role',
      body: 'Explain what the organizer records, what members can see, and how disputes are handled.',
    },
    {
      heading: '5. Records',
      body: 'Explain that schemes can be deactivated but records are kept.',
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
