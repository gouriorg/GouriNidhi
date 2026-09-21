import {
  defaultContact,
  defaultOrganizers,
  defaultTerms,
  type SiteContact,
  type SiteOrganizer,
  type SiteTerms,
  type SiteTermsSection,
} from '@/content/sitePages'
import { getSupabase } from '@/lib/supabase'
import { RepositoryError } from '@/repositories/errors'
import { notifyDataChanged } from '@/stores/dataVersion'

export const SITE_CONTACT_KEY = 'site.contact'
export const SITE_ORGANIZERS_KEY = 'site.organizers'
export const SITE_TERMS_KEY = 'site.terms'

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function parseContact(value: unknown): SiteContact {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaultContact
  const row = value as Record<string, unknown>
  const lines = Array.isArray(row.addressLines)
    ? row.addressLines.filter((line): line is string => typeof line === 'string')
    : defaultContact.addressLines
  return {
    organization: asString(row.organization, defaultContact.organization),
    addressLines: lines,
    phone: asString(row.phone, defaultContact.phone),
    email: asString(row.email, defaultContact.email),
    hours: asString(row.hours, defaultContact.hours),
    notes: asString(row.notes),
  }
}

function parseOrganizers(value: unknown): SiteOrganizer[] {
  if (!Array.isArray(value)) return defaultOrganizers
  const people = value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item, index) => ({
      id: asString(item.id, `organizer-${index + 1}`),
      name: asString(item.name, 'Organizer'),
      role: asString(item.role, 'Organizer'),
      phone: asString(item.phone),
      email: asString(item.email),
      notes: asString(item.notes),
    }))
    .filter((person) => person.id)
  return people.length > 0 ? people : defaultOrganizers
}

function parseTerms(value: unknown): SiteTerms {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaultTerms
  const row = value as Record<string, unknown>
  const sections = Array.isArray(row.sections)
    ? row.sections
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
        .map(
          (item): SiteTermsSection => ({
            heading: asString(item.heading),
            body: asString(item.body),
          }),
        )
        .filter((section) => section.heading || section.body)
    : defaultTerms.sections
  return {
    updatedLabel: asString(row.updatedLabel, defaultTerms.updatedLabel),
    sections: sections.length > 0 ? sections : defaultTerms.sections,
  }
}

async function readSetting(key: string): Promise<unknown> {
  const { data, error } = await getSupabase().from('settings').select('value').eq('key', key).maybeSingle()
  if (error) return undefined
  return data?.value
}

async function writeSetting(key: string, value: unknown, failMessage: string): Promise<void> {
  const { error } = await getSupabase().from('settings').upsert({
    key,
    value,
    updated_at: new Date().toISOString(),
  })
  if (error) {
    throw new RepositoryError(
      error.message.includes('policy') || error.code === '42501'
        ? `${failMessage} Sign in as admin and run the latest setup SQL.`
        : failMessage,
    )
  }
  notifyDataChanged()
}

export const siteContentRepository = {
  async getContact(): Promise<SiteContact> {
    return parseContact(await readSetting(SITE_CONTACT_KEY))
  },

  async saveContact(contact: SiteContact): Promise<void> {
    await writeSetting(SITE_CONTACT_KEY, contact, 'Could not save the contact details.')
  },

  async listOrganizers(): Promise<SiteOrganizer[]> {
    return parseOrganizers(await readSetting(SITE_ORGANIZERS_KEY))
  },

  async saveOrganizers(people: SiteOrganizer[]): Promise<void> {
    await writeSetting(SITE_ORGANIZERS_KEY, people, 'Could not save the organizers.')
  },

  async getTerms(): Promise<SiteTerms> {
    return parseTerms(await readSetting(SITE_TERMS_KEY))
  },

  async saveTerms(terms: SiteTerms): Promise<void> {
    await writeSetting(SITE_TERMS_KEY, terms, 'Could not save the terms.')
  },
}
