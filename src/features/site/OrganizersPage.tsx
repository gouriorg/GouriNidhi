import { CameraIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { LoadingState } from '@/components/EmptyState'
import { OrganizerAvatar } from '@/components/OrganizerAvatar'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { organizersPage, type SiteOrganizer } from '@/content/sitePages'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { imageFileToJpegDataUrl } from '@/lib/organizerPhoto'
import { toReadableError } from '@/repositories/errors'
import { organizersRepository } from '@/repositories/organizersRepository'
import { siteContentRepository } from '@/repositories/siteContentRepository'
import { useIsAdmin } from '@/stores/session'

export function OrganizersPage() {
  const isAdmin = useIsAdmin()
  const people = useLiveQuery(() => siteContentRepository.listOrganizers(), [])
  const photos = useLiveQuery(() => organizersRepository.listPhotos(), []) ?? {}

  if (!people) return <LoadingState label="Loading organizers…" />

  return (
    <>
      <PageHeader
        title={organizersPage.title}
        description={organizersPage.description}
        actions={
          isAdmin ? (
            <Button type="button" variant="outline" onClick={() => void addOrganizer(people)}>
              <PlusIcon />
              Add organizer
            </Button>
          ) : undefined
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {people.map((person) =>
          isAdmin ? (
            <OrganizerEditor key={person.id} person={person} photo={photos[person.id]} people={people} />
          ) : (
            <OrganizerCard key={person.id} person={person} photo={photos[person.id]} />
          ),
        )}
      </div>
    </>
  )
}

async function addOrganizer(people: SiteOrganizer[]) {
  try {
    await siteContentRepository.saveOrganizers([
      ...people,
      {
        id: `organizer-${crypto.randomUUID()}`,
        name: '',
        role: '',
        phone: '',
        email: '',
        notes: '',
      },
    ])
    toast.success('Organizer added')
  } catch (error) {
    toast.error(toReadableError(error, 'Could not add an organizer.'))
  }
}

function OrganizerCard({ person, photo }: { person: SiteOrganizer; photo?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-4">
        <OrganizerAvatar name={person.name} photo={photo} className="text-lg" />
        <div className="min-w-0 flex-1">
          <CardTitle>{person.name || 'Organizer'}</CardTitle>
          {person.role ? <p className="text-muted-foreground text-sm">{person.role}</p> : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        {person.phone ? <p>{person.phone}</p> : null}
        {person.email ? <p>{person.email}</p> : null}
        {person.notes ? <p className="text-muted-foreground text-xs">{person.notes}</p> : null}
      </CardContent>
    </Card>
  )
}

function OrganizerEditor({
  person,
  photo,
  people,
}: {
  person: SiteOrganizer
  photo?: string
  people: SiteOrganizer[]
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(person)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setDraft(person)
  }, [person])

  function patch(partial: Partial<SiteOrganizer>) {
    setDraft((current) => ({ ...current, ...partial }))
  }

  async function save() {
    setBusy(true)
    try {
      const next = people.map((item) => (item.id === person.id ? trimOrganizer(draft) : item))
      await siteContentRepository.saveOrganizers(next)
      toast.success('Organizer saved')
    } catch (error) {
      toast.error(toReadableError(error, 'Could not save this organizer.'))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await organizersRepository.setPhoto(person.id, null)
      await siteContentRepository.saveOrganizers(people.filter((item) => item.id !== person.id))
      toast.success('Organizer removed')
    } catch (error) {
      toast.error(toReadableError(error, 'Could not remove this organizer.'))
    } finally {
      setBusy(false)
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      const dataUrl = await imageFileToJpegDataUrl(file)
      await organizersRepository.setPhoto(person.id, dataUrl)
      toast.success('Photo saved')
    } catch (error) {
      toast.error(toReadableError(error, 'Could not save this photo.'))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function removePhoto() {
    setBusy(true)
    try {
      await organizersRepository.setPhoto(person.id, null)
      toast.success('Photo removed')
    } catch (error) {
      toast.error(toReadableError(error, 'Could not remove this photo.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-4">
        <OrganizerAvatar name={draft.name || 'Organizer'} photo={photo} className="text-lg" />
        <div className="min-w-0 flex-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            className="hidden"
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
              <CameraIcon />
              {photo ? 'Change photo' : 'Add photo'}
            </Button>
            {photo ? (
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void removePhoto()}>
                Remove photo
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-2">
          <Label htmlFor={`${person.id}-name`}>Name</Label>
          <Input
            id={`${person.id}-name`}
            value={draft.name}
            onChange={(event) => patch({ name: event.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${person.id}-role`}>Designation</Label>
          <Input
            id={`${person.id}-role`}
            value={draft.role}
            onChange={(event) => patch({ role: event.target.value })}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor={`${person.id}-phone`}>Phone</Label>
            <Input
              id={`${person.id}-phone`}
              value={draft.phone}
              onChange={(event) => patch({ phone: event.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${person.id}-email`}>Email</Label>
            <Input
              id={`${person.id}-email`}
              type="email"
              value={draft.email}
              onChange={(event) => patch({ email: event.target.value })}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${person.id}-notes`}>Notes</Label>
          <Textarea
            id={`${person.id}-notes`}
            rows={2}
            value={draft.notes}
            onChange={(event) => patch({ notes: event.target.value })}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy} onClick={() => void save()}>
            Save organizer
          </Button>
          {people.length > 1 ? (
            <Button type="button" variant="ghost" disabled={busy} onClick={() => void remove()}>
              <Trash2Icon />
              Remove
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function trimOrganizer(person: SiteOrganizer): SiteOrganizer {
  return {
    ...person,
    name: person.name.trim(),
    role: person.role.trim(),
    phone: person.phone.trim(),
    email: person.email.trim(),
    notes: person.notes.trim(),
  }
}
