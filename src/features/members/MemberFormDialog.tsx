import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircleIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MobileInput } from '@/components/MobileInput'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { personFormSchema, type PersonFormValues } from '@/db/schema'
import { peopleRepository } from '@/repositories/peopleRepository'
import { toReadableError } from '@/repositories/errors'
import type { Person } from '@/types/entities'

export function MemberFormDialog({
  open,
  onOpenChange,
  person,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  person?: Person
  onSaved?: (person: Person) => void
}) {
  const isEdit = Boolean(person)
  const [mobileChangeAck, setMobileChangeAck] = useState(false)

  const form = useForm<PersonFormValues>({
    resolver: zodResolver(personFormSchema),
    defaultValues: {
      fullName: person?.fullName ?? '',
      mobile: person?.mobile ?? '',
      address: person?.address ?? '',
      notes: person?.notes ?? '',
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        fullName: person?.fullName ?? '',
        mobile: person?.mobile ?? '',
        address: person?.address ?? '',
        notes: person?.notes ?? '',
      })
      setMobileChangeAck(false)
    }
  }, [open, person, form])

  const watchedMobile = form.watch('mobile')
  const mobileChanged = isEdit && person !== undefined && watchedMobile !== person.mobile

  async function onSubmit(values: PersonFormValues) {
    // Changing the mobile changes how this member signs in.
    if (mobileChanged && !mobileChangeAck) {
      setMobileChangeAck(true)
      return
    }

    try {
      const saved = person
        ? await peopleRepository.update(person.id, values)
        : await peopleRepository.create(values)
      toast.success(person ? `Updated ${saved.fullName}` : `Added ${saved.fullName}`)
      onSaved?.(saved)
      onOpenChange(false)
    } catch (error) {
      const message = toReadableError(error, 'Could not save this member.')
      form.setError('mobile', { message })
      toast.error(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit member' : 'Add member'}</DialogTitle>
          <DialogDescription>
            Name and mobile are required. Address is optional.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <div className="grid gap-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              {...form.register('fullName')}
              aria-invalid={Boolean(form.formState.errors.fullName)}
              placeholder="Ravi Kumar"
            />
            {form.formState.errors.fullName && (
              <p className="text-destructive text-xs">{form.formState.errors.fullName.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="mobile">Mobile number</Label>
            <MobileInput
              id="mobile"
              {...form.register('mobile')}
              aria-invalid={Boolean(form.formState.errors.mobile)}
              placeholder="9876543210"
            />
            <p className="text-muted-foreground text-xs">
              They will sign in with this mobile number as both username and password.
            </p>
            {form.formState.errors.mobile && (
              <p className="text-destructive text-xs">{form.formState.errors.mobile.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="address">
              Address <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea id="address" rows={2} {...form.register('address')} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">
              Notes <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea id="notes" rows={2} {...form.register('notes')} />
          </div>

          {mobileChanged && mobileChangeAck && (
            <div className="border-warning/35 bg-warning/10 text-warning-foreground rounded-lg border p-3 text-xs">
              This changes how {person?.fullName} signs in: their new username and password will
              both be {watchedMobile}. Press Save again to confirm.
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <LoaderCircleIcon className="size-4 animate-spin" />}
              {mobileChanged && mobileChangeAck ? 'Confirm change' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
