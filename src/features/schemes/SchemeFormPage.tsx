import { zodResolver } from '@hookform/resolvers/zod'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { AlertTriangleIcon, ArrowLeftIcon, InfoIcon, LoaderCircleIcon, SaveIcon } from 'lucide-react'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { LoadingState } from '@/components/EmptyState'
import { MoneyText } from '@/components/MoneyText'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { schemeFormSchema, type SchemeFormValues } from '@/db/schema'
import {
  buildFixedProfitSchedule,
  canBuildSchedule,
} from '@/domain/distribution/fixedProfitSchedule'
import { fromRupees, percentToBps, toRupees } from '@/domain/money/money'
import { PayoutScheduleChart } from '@/features/schemes/PayoutScheduleChart'
import { PayoutScheduleTable } from '@/features/schemes/PayoutScheduleTable'
import { todayIso } from '@/lib/dates'
import { toReadableError } from '@/repositories/errors'
import { isFinancialsLocked, schemesRepository } from '@/repositories/schemesRepository'

export function SchemeFormPage() {
  const { schemeId } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(schemeId)

  const scheme = useLiveQuery(
    () => (schemeId ? schemesRepository.get(schemeId) : Promise.resolve(undefined)),
    [schemeId],
  )

  if (isEdit && scheme === undefined) return <LoadingState label="Loading scheme…" />

  return (
    <SchemeForm
      key={scheme?.id ?? 'new'}
      scheme={scheme ?? undefined}
      onSaved={(id) => navigate(`/schemes/${id}`)}
    />
  )
}

function SchemeForm({
  scheme,
  onSaved,
}: {
  scheme?: Awaited<ReturnType<typeof schemesRepository.get>>
  onSaved: (id: string) => void
}) {
  const locked = scheme ? isFinancialsLocked(scheme) : false

  const form = useForm<SchemeFormValues>({
    resolver: zodResolver(schemeFormSchema),
    mode: 'onChange',
    defaultValues: {
      code: scheme?.code ?? '',
      name: scheme?.name ?? '',
      description: scheme?.description ?? '',
      maxMembers: scheme?.maxMembers ?? 20,
      monthlyAmountRupees: scheme ? toRupees(scheme.monthlyAmount) : 4000,
      durationMonths: scheme?.durationMonths ?? 20,
      startDate: scheme?.startDate ?? todayIso(),
      collectionDay: scheme?.collectionDay ?? 1,
      profitPercent: scheme ? scheme.profitBps / 100 : 10,
      notes: scheme?.notes ?? '',
    },
  })

  const values = form.watch()

  // Live preview: recompute the schedule on every valid keystroke.
  const preview = useMemo(() => {
    const maxMembers = Number(values.maxMembers)
    const durationMonths = Number(values.durationMonths)
    const collectionDay = Number(values.collectionDay)
    const profitPercent = Number(values.profitPercent)
    const monthlyRupees = Number(values.monthlyAmountRupees)

    if (
      !Number.isFinite(monthlyRupees) ||
      monthlyRupees <= 0 ||
      !Number.isFinite(profitPercent) ||
      profitPercent < 0
    ) {
      return null
    }

    const input = {
      maxMembers,
      monthlyAmount: fromRupees(monthlyRupees),
      durationMonths,
      startDate: values.startDate,
      collectionDay,
      profitBps: percentToBps(profitPercent),
    }

    if (!canBuildSchedule(input)) return null

    try {
      return buildFixedProfitSchedule(input)
    } catch {
      return null
    }
  }, [
    values.maxMembers,
    values.durationMonths,
    values.collectionDay,
    values.profitPercent,
    values.monthlyAmountRupees,
    values.startDate,
  ])

  const durationMismatch =
    Number(values.durationMonths) !== Number(values.maxMembers) &&
    Number.isFinite(Number(values.durationMonths)) &&
    Number.isFinite(Number(values.maxMembers))

  async function onSubmit(raw: SchemeFormValues) {
    const parsed = schemeFormSchema.parse(raw)
    const input = {
      code: parsed.code,
      name: parsed.name,
      description: parsed.description || undefined,
      monthlyAmount: fromRupees(parsed.monthlyAmountRupees),
      maxMembers: parsed.maxMembers,
      durationMonths: parsed.durationMonths,
      startDate: parsed.startDate,
      collectionDay: parsed.collectionDay,
      profitBps: percentToBps(parsed.profitPercent),
      notes: parsed.notes || undefined,
    }

    // Once the scheme is active only the descriptive fields are submitted, so
    // a locked value can never be re-sent and rejected by the repository.
    const editable = locked
      ? {
          name: input.name,
          description: input.description,
          collectionDay: input.collectionDay,
          notes: input.notes,
        }
      : input

    try {
      const saved = scheme
        ? await schemesRepository.update(scheme.id, editable)
        : await schemesRepository.create(input)
      toast.success(scheme ? `Updated ${saved.code}` : `Created ${saved.code}`)
      onSaved(saved.id)
    } catch (error) {
      const message = toReadableError(error, 'Could not save this scheme.')
      form.setError('code', { message })
      toast.error(message)
    }
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to={scheme ? `/schemes/${scheme.id}` : '/schemes'}>
          <ArrowLeftIcon /> {scheme ? 'Back to scheme' : 'All schemes'}
        </Link>
      </Button>

      <PageHeader
        title={scheme ? `Edit ${scheme.code}` : 'New scheme'}
        description="Enter the plan below. The monthly payout schedule is calculated for you as you type."
      />

      {locked && (
        <div className="border-warning/35 bg-warning/10 text-warning-foreground mb-6 flex gap-2 rounded-lg border p-3 text-sm">
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          <p>
            This scheme is active. Member count, monthly contribution, duration, start date, profit
            and code are locked so the agreed payout schedule cannot change. Name, notes and the
            collection day can still be edited.
          </p>
        </div>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          {/* Inputs */}
          <div className="grid content-start gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Scheme details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <Field
                  id="name"
                  label="Scheme name"
                  error={form.formState.errors.name?.message}
                >
                  <Input id="name" {...form.register('name')} placeholder="GouriNidhi Family 2026" />
                </Field>

                <Field id="code" label="Scheme code" error={form.formState.errors.code?.message}>
                  <Input
                    id="code"
                    {...form.register('code')}
                    placeholder="GN-001"
                    disabled={locked}
                    className="uppercase"
                  />
                </Field>

                <Field id="description" label="Description (optional)">
                  <Textarea id="description" rows={2} {...form.register('description')} />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>The plan</CardTitle>
                <CardDescription>
                  These five inputs decide the payout schedule.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field
                    id="maxMembers"
                    label="Number of members"
                    error={form.formState.errors.maxMembers?.message}
                  >
                    <Input
                      id="maxMembers"
                      type="number"
                      inputMode="numeric"
                      min={2}
                      {...form.register('maxMembers')}
                      disabled={locked}
                    />
                  </Field>

                  <Field
                    id="durationMonths"
                    label="Duration (months)"
                    error={form.formState.errors.durationMonths?.message}
                  >
                    <Input
                      id="durationMonths"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      {...form.register('durationMonths')}
                      disabled={locked}
                    />
                  </Field>
                </div>

                <Field
                  id="monthlyAmountRupees"
                  label="Monthly contribution per member (₹)"
                  error={form.formState.errors.monthlyAmountRupees?.message}
                  hint="Everyone pays this same amount every month."
                >
                  <Input
                    id="monthlyAmountRupees"
                    type="number"
                    inputMode="decimal"
                    min={1}
                    step="0.01"
                    {...form.register('monthlyAmountRupees')}
                    disabled={locked}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field
                    id="startDate"
                    label="Start date"
                    error={form.formState.errors.startDate?.message}
                  >
                    <Input
                      id="startDate"
                      type="date"
                      {...form.register('startDate')}
                      disabled={locked}
                    />
                  </Field>

                  <Field
                    id="collectionDay"
                    label="Collection day"
                    error={form.formState.errors.collectionDay?.message}
                    hint="Day 1–28 of each month."
                  >
                    <Input
                      id="collectionDay"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={28}
                      {...form.register('collectionDay')}
                    />
                  </Field>
                </div>

                <Field
                  id="profitPercent"
                  label="Profit (%)"
                  error={form.formState.errors.profitPercent?.message}
                  hint="Spread between the first and last withdrawal. 0% pays everyone the same."
                >
                  <Input
                    id="profitPercent"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step="0.5"
                    {...form.register('profitPercent')}
                    disabled={locked}
                  />
                </Field>

                <Field id="notes" label="Notes (optional)">
                  <Textarea id="notes" rows={2} {...form.register('notes')} />
                </Field>
              </CardContent>
            </Card>

            {durationMismatch && (
              <div className="border-warning/35 bg-warning/10 text-warning-foreground flex gap-2 rounded-lg border p-3 text-sm">
                <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
                <p>
                  Duration ({String(values.durationMonths)} months) does not match the member count
                  ({String(values.maxMembers)}). A rotating chit normally pays one member per month,
                  so some members would get no month or share one.
                </p>
              </div>
            )}

            <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <LoaderCircleIcon className="size-4 animate-spin" />
              ) : (
                <SaveIcon />
              )}
              {scheme ? 'Save changes' : 'Create scheme'}
            </Button>
          </div>

          {/* Live schedule */}
          <div className="grid content-start gap-4">
            <Card className="gap-4">
              <CardHeader>
                <CardTitle>Payout schedule</CardTitle>
                <CardDescription>
                  Calculated automatically. Whoever withdraws earlier receives less; the last month
                  receives the most. Total paid out always equals total collected.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!preview ? (
                  <p className="text-muted-foreground py-10 text-center text-sm">
                    Fill in members, monthly contribution, duration, start date and profit to see
                    the schedule.
                  </p>
                ) : (
                  <>
                    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Figure label="Monthly pool" value={preview.grossPool} />
                      <Figure
                        label="First month gets"
                        value={preview.lines[0].plannedPayoutAmount}
                      />
                      <Figure
                        label="Last month gets"
                        value={preview.lines[preview.lines.length - 1].plannedPayoutAmount}
                      />
                      <Figure label="Total over term" value={preview.totalCollected} />
                    </div>
                    <PayoutScheduleChart lines={preview.lines} />
                  </>
                )}
              </CardContent>
            </Card>

            {preview && (
              <PayoutScheduleTable lines={preview.lines} showRecipients={false} />
            )}
          </div>
        </div>
      </form>
    </>
  )
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && <p className="text-muted-foreground text-xs">{hint}</p>}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  )
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <MoneyText amount={value} className="mt-1 block text-base font-bold" />
    </div>
  )
}
