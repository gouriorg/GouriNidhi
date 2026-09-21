import { ClockIcon, MailIcon, MapPinIcon, PhoneIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { LoadingState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { contactPage, type SiteContact } from '@/content/sitePages'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { toReadableError } from '@/repositories/errors'
import { siteContentRepository } from '@/repositories/siteContentRepository'
import { useIsAdmin } from '@/stores/session'

export function ContactPage() {
  const isAdmin = useIsAdmin()
  const contact = useLiveQuery(() => siteContentRepository.getContact(), [])

  if (!contact) return <LoadingState label="Loading contact…" />

  return (
    <>
      <PageHeader title={contactPage.title} description={contactPage.description} />
      {isAdmin ? <ContactEditor initial={contact} /> : <ContactView contact={contact} />}
    </>
  )
}

function ContactView({ contact }: { contact: SiteContact }) {
  return (
    <Card>
      <CardContent className="grid gap-5 text-sm">
        <p className="font-medium">{contact.organization}</p>
        <Field icon={MapPinIcon} label="Address">
          {contact.addressLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </Field>
        <Field icon={PhoneIcon} label="Phone">
          {contact.phone}
        </Field>
        <Field icon={MailIcon} label="Email">
          {contact.email}
        </Field>
        <Field icon={ClockIcon} label="Hours">
          {contact.hours}
        </Field>
        {contact.notes ? <p className="text-muted-foreground text-xs">{contact.notes}</p> : null}
      </CardContent>
    </Card>
  )
}

function ContactEditor({ initial }: { initial: SiteContact }) {
  const [draft, setDraft] = useState(initial)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setDraft(initial)
  }, [initial])

  function patch(partial: Partial<SiteContact>) {
    setDraft((current) => ({ ...current, ...partial }))
  }

  async function save() {
    setBusy(true)
    try {
      await siteContentRepository.saveContact({
        ...draft,
        organization: draft.organization.trim() || 'GouriNidhi',
        addressLines: draft.addressLines.map((line) => line.trim()).filter(Boolean),
        phone: draft.phone.trim(),
        email: draft.email.trim(),
        hours: draft.hours.trim(),
        notes: draft.notes.trim(),
      })
      toast.success('Contact details saved')
    } catch (error) {
      toast.error(toReadableError(error, 'Could not save the contact details.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardContent className="grid gap-4">
        <p className="text-muted-foreground text-sm">
          Edit on this page. Members and visitors see the saved details.
        </p>
        <div className="grid gap-2">
          <Label htmlFor="contact-org">Organization</Label>
          <Input
            id="contact-org"
            value={draft.organization}
            onChange={(event) => patch({ organization: event.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="contact-address">Address</Label>
          <Textarea
            id="contact-address"
            rows={4}
            value={draft.addressLines.join('\n')}
            onChange={(event) => patch({ addressLines: event.target.value.split('\n') })}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="contact-phone">Phone</Label>
            <Input
              id="contact-phone"
              value={draft.phone}
              onChange={(event) => patch({ phone: event.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contact-email">Email</Label>
            <Input
              id="contact-email"
              type="email"
              value={draft.email}
              onChange={(event) => patch({ email: event.target.value })}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="contact-hours">Hours</Label>
          <Input
            id="contact-hours"
            value={draft.hours}
            onChange={(event) => patch({ hours: event.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="contact-notes">Notes</Label>
          <Textarea
            id="contact-notes"
            rows={3}
            value={draft.notes}
            onChange={(event) => patch({ notes: event.target.value })}
          />
        </div>
        <div>
          <Button type="button" disabled={busy} onClick={() => void save()}>
            Save contact
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-3">
      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      <div>
        <p className="text-muted-foreground text-xs">{label}</p>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  )
}
