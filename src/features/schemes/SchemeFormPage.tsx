import { zodResolver } from '@hookform/resolvers/zod'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { ArrowLeftIcon, InfoIcon, LoaderCircleIcon, SaveIcon } from 'lucide-react'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { LoadingState } from '@/components/EmptyState'
import { MoneyText } from '@/components/MoneyText'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { schemeFormSchema, type SchemeFormValues } from '@/db/schema'
import {
  buildFixedProfitSchedule,
  canBuildSchedule,
  profitBpsFromChart,
  type Schedule,
} from '@/domain/distribution/fixedProfitSchedule'
import { bpsToPercent, fromRupees, percentToBps, toRupees } from '@/domain/money/money'
import { PayoutScheduleChart } from '@/features/schemes/PayoutScheduleChart'
import { PayoutScheduleTable } from '@/features/schemes/PayoutScheduleTable'
import { todayIso } from '@/lib/dates'
import { nextGnSchemeCode } from '@/lib/schemeCode'
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
  const customChart = scheme?.distributionMode === 'custom' && (scheme.scheduleSnapshot?.length ?? 0) > 0
  const existingSchemes = useLiveQuery(() => schemesRepository.list(), [])
  const nextCode = nextGnSchemeCode((existingSchemes ?? []).map((row) => row.code))
  const assignedCode = scheme?.code ?? nextCode

  const form = useForm<SchemeFormValues>({
    resolver: zodResolver(schemeFormSchema),
    mode: 'onChange',
    defaultValues: {
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

  const preview = useMemo((): Schedule | null => {
    if (customChart && scheme?.scheduleSnapshot?.length) {
      const monthlyPaise = fromRupees(Number(values.monthlyAmountRupees) || 0)
      const members = Number(values.maxMembers)
      const pool =
        Number.isInteger(monthlyPaise) && monthlyPaise > 0 && Number.isInteger(members) && members > 0
          ? monthlyPaise * members
          : (scheme.scheduleSnapshot[0]?.grossPool ?? 0)
      const lines = scheme.scheduleSnapshot.map((line) => ({
        ...line,
        grossPool: pool,
        adjustment: line.plannedPayoutAmount - pool,
      }))
      const totalPayout = lines.reduce((sum, line) => sum + line.plannedPayoutAmount, 0)
      return {
        lines,
        grossPool: pool,
        totalCollected: pool * lines.length,
        totalPayout,
      }
    }

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
    customChart,
    scheme?.scheduleSnapshot,
    values.maxMembers,
    values.durationMonths,
    values.collectionDay,
    values.profitPercent,
    values.monthlyAmountRupees,
    values.startDate,
  ])

  const impliedProfitPercent = useMemo(() => {
    if (!preview?.lines.length || preview.grossPool <= 0) return null
    const first = preview.lines[0].plannedPayoutAmount
    const last = preview.lines[preview.lines.length - 1].plannedPayoutAmount
    return bpsToPercent(profitBpsFromChart(preview.grossPool, first, last))
  }, [preview])

  function syncMembersAndDuration(source: 'maxMembers' | 'durationMonths', raw: string) {
    if (locked) return
    const value = Number(raw)
    if (!Number.isFinite(value)) return
    const other = source === 'maxMembers' ? 'durationMonths' : 'maxMembers'
    if (Number(form.getValues(other)) === value) return
    form.setValue(other, value, { shouldDirty: true, shouldValidate: true })
  }

  async function onSubmit(raw: SchemeFormValues) {
    const parsed = schemeFormSchema.parse(raw)
    const input = {
      name: parsed.name,
      description: parsed.description || undefined,
      monthlyAmount: fromRupees(parsed.monthlyAmountRupees),
      maxMembers: parsed.maxMembers,
      durationMonths: locked ? parsed.durationMonths : parsed.maxMembers,
      startDate: parsed.startDate,
      collectionDay: parsed.collectionDay,
      profitBps:
        customChart && impliedProfitPercent !== null
          ? percentToBps(impliedProfitPercent)
          : percentToBps(parsed.profitPercent),
      notes: parsed.notes || undefined,
    }

    // Once the scheme is active only the descriptive fields are submitted, so
    // a locked value can never be re-sent and rejected by the repository.
    const editable = locked
      ? {
          name: input.name,
          description: input.description,
          monthlyAmount: input.monthlyAmount,
          collectionDay: input.collectionDay,
          notes: input.notes,
          ...(customChart ? { profitBps: input.profitBps } : {}),
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
      form.setError('name', { message })
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
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span>{scheme ? `Edit ${scheme.name}` : 'New scheme'}</span>
            <Badge variant="secondary" className="tabular">
              {assignedCode}
            </Badge>
          </span>
        }
        description={
          customChart
            ? 'This scheme uses the printed payout chart. Amounts stay as on the chart.'
            : 'Enter the plan below. The monthly payout schedule is calculated for you as you type. The scheme code is assigned automatically and cannot be changed.'
        }
      />

      {locked && (
        <div className="border-warning/35 bg-warning/10 text-warning-foreground mb-6 flex gap-2 rounded-lg border p-3 text-sm">
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          <p>
            {customChart
              ? 'This scheme is active and follows the printed payout chart. Member count, duration and start date stay locked. Monthly contribution and due day can still be edited. Get Amount stays as on the chart; profit % is recalculated from first vs last payout against the new monthly pool.'
              : 'This scheme is active. Member count, duration, start date and profit stay locked. You can still set the monthly contribution so a running scheme can be filled in. Unpaid months and the payout preview update to the new amount. Paid months are left as recorded.'}
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
                  hint={`Code ${assignedCode} is assigned automatically and cannot be changed.`}
                >
                  <Input id="name" {...form.register('name')} placeholder="GouriNidhi Family 2026" />
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
                  {customChart
                    ? 'Monthly contribution and due day can be edited. The payout chart stays as printed.'
                    : 'These five inputs decide the payout schedule.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid grid-cols-2 items-start gap-4">
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
                      {...form.register('maxMembers', {
                        onChange: (event) => syncMembersAndDuration('maxMembers', event.target.value),
                      })}
                      disabled={locked}
                    />
                  </Field>

                  <Field
                    id="durationMonths"
                    label="Duration (months)"
                    error={form.formState.errors.durationMonths?.message}
                    hint="Same as the member count so each member can take one month."
                  >
                    <Input
                      id="durationMonths"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      {...form.register('durationMonths', {
                        onChange: (event) =>
                          syncMembersAndDuration('durationMonths', event.target.value),
                      })}
                      disabled={locked}
                    />
                  </Field>
                </div>

                <Field
                  id="monthlyAmountRupees"
                  label="Monthly contribution per member (₹)"
                  error={form.formState.errors.monthlyAmountRupees?.message}
                  hint={
                    locked
                      ? 'You can still fill this on a running scheme. Unpaid months use the new amount.'
                      : 'Everyone pays this same amount every month.'
                  }
                >
                  <Input
                    id="monthlyAmountRupees"
                    type="number"
                    inputMode="decimal"
                    min={1}
                    step="0.01"
                    {...form.register('monthlyAmountRupees')}
                  />
                </Field>

                <div className="grid grid-cols-2 items-start gap-4">
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
                    label="Monthly due day"
                    error={form.formState.errors.collectionDay?.message}
                    hint="Same day every month (1–28). After that day, unpaid members are highlighted for their cashier and listed on the admin dashboard to call."
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

                {customChart ? (
                  <Field
                    id="profitPercent"
                    label="Profit (%)"
                    hint="From this chart: half the gap between first and last Get Amount, as a share of the monthly pool. Recalculates when you change the monthly contribution."
                  >
                    <input type="hidden" {...form.register('profitPercent')} />
                    <Input
                      id="profitPercentDisplay"
                      readOnly
                      value={impliedProfitPercent === null ? '' : String(impliedProfitPercent)}
                    />
                  </Field>
                ) : (
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
                )}

                <Field id="notes" label="Notes (optional)">
                  <Textarea id="notes" rows={2} {...form.register('notes')} />
                </Field>
              </CardContent>
            </Card>

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
                  {customChart
                    ? 'Copied from the 2 Lakh New B.C chart: BC Payment is the monthly contribution, Get Amount is the payout.'
                    : 'Calculated automatically. Whoever withdraws earlier receives less; the last month receives the most. Total paid out always equals total collected.'}
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
    <div className="grid content-start gap-2">
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
