import { schemeSchema } from '@/db/schema'
import { buildFixedProfitSchedule } from '@/domain/distribution/fixedProfitSchedule'
import { generateRoundsForScheme } from '@/domain/rounds/generateRounds'
import { newId, nowIso } from '@/lib/id'
import { mapScheme, roundToRow, schemeToRow, throwIfError } from '@/lib/mappers'
import { nextGnSchemeCode } from '@/lib/schemeCode'
import { getSupabase } from '@/lib/supabase'
import { auditService } from '@/services/audit'
import { notifyDataChanged } from '@/stores/dataVersion'
import { RepositoryError } from '@/repositories/errors'
import type { Paise } from '@/domain/money/money'
import type { DateOnly, Scheme, SchemeStatus } from '@/types/entities'

export type SchemeInput = {
  name: string
  description?: string
  monthlyAmount: Paise
  maxMembers: number
  durationMonths: number
  startDate: DateOnly
  collectionDay: number
  profitBps: number
  notes?: string
}

export function isFinancialsLocked(scheme: Scheme): boolean {
  return scheme.status !== 'draft'
}

export function isReadOnly(scheme: Scheme): boolean {
  return scheme.status === 'completed' || scheme.status === 'cancelled'
}

function buildSnapshot(input: Omit<SchemeInput, 'name'>) {
  return buildFixedProfitSchedule({
    maxMembers: input.maxMembers,
    monthlyAmount: input.monthlyAmount,
    durationMonths: input.durationMonths,
    startDate: input.startDate,
    collectionDay: input.collectionDay,
    profitBps: input.profitBps,
  }).lines
}

export const schemesRepository = {
  async list(): Promise<Scheme[]> {
    const { data, error } = await getSupabase().from('schemes').select('*').order('code')
    throwIfError(error)
    return (data ?? []).map(mapScheme)
  },

  async get(id: string): Promise<Scheme | undefined> {
    const { data, error } = await getSupabase().from('schemes').select('*').eq('id', id).maybeSingle()
    throwIfError(error)
    return data ? mapScheme(data) : undefined
  },

  async findByCode(code: string): Promise<Scheme | undefined> {
    const { data, error } = await getSupabase()
      .from('schemes')
      .select('*')
      .eq('code', code.trim().toUpperCase())
      .maybeSingle()
    throwIfError(error)
    return data ? mapScheme(data) : undefined
  },

  async allocateNextCode(): Promise<string> {
    const existing = await schemesRepository.list()
    return nextGnSchemeCode(existing.map((scheme) => scheme.code))
  },

  async create(input: SchemeInput): Promise<Scheme> {
    const timestamp = nowIso()
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = await schemesRepository.allocateNextCode()
      const scheme = schemeSchema.parse({
        id: newId(),
        code,
        name: input.name.trim(),
        description: input.description?.trim() || undefined,
        monthlyAmount: input.monthlyAmount,
        maxMembers: input.maxMembers,
        durationMonths: input.durationMonths,
        startDate: input.startDate,
        collectionDay: input.collectionDay,
        profitBps: input.profitBps,
        distributionMode: 'fixed_profit',
        scheduleSnapshot: buildSnapshot(input),
        status: 'draft',
        notes: input.notes?.trim() || undefined,
        createdAt: timestamp,
        updatedAt: timestamp,
      } satisfies Scheme)

      const { error } = await getSupabase().from('schemes').insert(schemeToRow(scheme))
      if (error) {
        if (error.code === '23505') continue
        throwIfError(error)
      }

      await auditService.record({
        action: 'scheme.created',
        entityType: 'scheme',
        entityId: scheme.id,
        summary: `Created scheme ${scheme.code} — ${scheme.name}`,
        after: scheme,
      })
      notifyDataChanged()
      return scheme
    }

    throw new RepositoryError('Could not allocate a unique scheme code. Try saving again.')
  },

  async update(id: string, input: Partial<SchemeInput>): Promise<Scheme> {
    const before = await schemesRepository.get(id)
    if (!before) throw new RepositoryError('Scheme not found')
    if (isReadOnly(before)) {
      throw new RepositoryError(`A ${before.status} scheme cannot be edited. Only notes can change.`)
    }

    const locked = isFinancialsLocked(before)
    if (locked) {
      const frozen: (keyof SchemeInput)[] = [
        'monthlyAmount',
        'maxMembers',
        'durationMonths',
        'startDate',
        'profitBps',
      ]
      const attempted = frozen.filter(
        (field) => input[field] !== undefined && input[field] !== before[field],
      )
      if (attempted.length > 0) {
        throw new RepositoryError(
          `${before.code} is ${before.status}, so ${attempted.join(', ')} can no longer change. Money already moved against this schedule.`,
        )
      }
    }

    const merged: Scheme = {
      ...before,
      name: input.name === undefined ? before.name : input.name.trim(),
      description:
        input.description === undefined ? before.description : input.description.trim() || undefined,
      notes: input.notes === undefined ? before.notes : input.notes.trim() || undefined,
      monthlyAmount: input.monthlyAmount ?? before.monthlyAmount,
      maxMembers: input.maxMembers ?? before.maxMembers,
      durationMonths: input.durationMonths ?? before.durationMonths,
      startDate: input.startDate ?? before.startDate,
      profitBps: input.profitBps ?? before.profitBps,
      collectionDay: input.collectionDay ?? before.collectionDay,
      updatedAt: nowIso(),
    }
    if (!locked) merged.scheduleSnapshot = buildSnapshot(merged)
    const scheme = schemeSchema.parse(merged)

    const { error } = await getSupabase().from('schemes').update(schemeToRow(scheme)).eq('id', id)
    throwIfError(error)
    await auditService.record({
      action: 'scheme.updated',
      entityType: 'scheme',
      entityId: id,
      summary: `Updated scheme ${scheme.code}`,
      before,
      after: scheme,
    })
    notifyDataChanged()
    return scheme
  },

  async activate(id: string): Promise<{ roundsCreated: number }> {
    const scheme = await schemesRepository.get(id)
    if (!scheme) throw new RepositoryError('Scheme not found')
    if (scheme.status !== 'draft') throw new RepositoryError('Only a Draft scheme can be activated.')

    const snapshot = scheme.scheduleSnapshot?.length ? scheme.scheduleSnapshot : buildSnapshot(scheme)
    const activated: Scheme = {
      ...scheme,
      status: 'active',
      scheduleSnapshot: snapshot,
      updatedAt: nowIso(),
    }

    const { count } = await getSupabase()
      .from('rounds')
      .select('*', { count: 'exact', head: true })
      .eq('scheme_id', id)

    const { error } = await getSupabase().from('schemes').update(schemeToRow(activated)).eq('id', id)
    throwIfError(error)

    let roundsCreated = 0
    if (!count) {
      const rounds = generateRoundsForScheme(activated)
      const { error: roundError } = await getSupabase().from('rounds').insert(rounds.map(roundToRow))
      throwIfError(roundError)
      roundsCreated = rounds.length
    }

    await auditService.record({
      action: 'scheme.activated',
      entityType: 'scheme',
      entityId: id,
      summary: `Activated scheme ${scheme.code} and generated ${roundsCreated} rounds`,
      before: scheme,
      after: activated,
    })
    notifyDataChanged()
    return { roundsCreated }
  },

  async generateMissingRounds(id: string): Promise<number> {
    const scheme = await schemesRepository.get(id)
    if (!scheme) throw new RepositoryError('Scheme not found')
    if (scheme.status === 'draft') {
      throw new RepositoryError('Activate the scheme first to generate rounds.')
    }
    const { count } = await getSupabase()
      .from('rounds')
      .select('*', { count: 'exact', head: true })
      .eq('scheme_id', id)
    if (count && count > 0) throw new RepositoryError('Rounds already exist and are never regenerated.')
    const rounds = generateRoundsForScheme(scheme)
    const { error } = await getSupabase().from('rounds').insert(rounds.map(roundToRow))
    throwIfError(error)
    await auditService.record({
      action: 'scheme.rounds_generated',
      entityType: 'scheme',
      entityId: id,
      summary: `Generated ${rounds.length} rounds for ${scheme.code}`,
    })
    notifyDataChanged()
    return rounds.length
  },

  async setStatus(id: string, status: SchemeStatus): Promise<void> {
    const before = await schemesRepository.get(id)
    if (!before) throw new RepositoryError('Scheme not found')
    if (status === 'completed') {
      const { data } = await getSupabase().from('rounds').select('status').eq('scheme_id', id)
      const openRounds = (data ?? []).filter((row) => row.status !== 'closed').length
      if (openRounds > 0) {
        throw new RepositoryError(
          `${openRounds} round(s) are still open. Close every round before completing the scheme.`,
        )
      }
    }
    const updated: Scheme = { ...before, status, updatedAt: nowIso() }
    const { error } = await getSupabase().from('schemes').update(schemeToRow(updated)).eq('id', id)
    throwIfError(error)
    await auditService.record({
      action: `scheme.${status}`,
      entityType: 'scheme',
      entityId: id,
      summary: `Scheme ${before.code} marked ${status === 'cancelled' ? 'inactive' : status}`,
      before,
      after: updated,
    })
    notifyDataChanged()
  },

  /** Soft-close a scheme. The row and all money history stay in the database. */
  async deactivate(id: string): Promise<void> {
    const before = await schemesRepository.get(id)
    if (!before) throw new RepositoryError('Scheme not found')
    if (before.status !== 'draft' && before.status !== 'active') {
      throw new RepositoryError('Only a draft or active scheme can be deactivated.')
    }
    await schemesRepository.setStatus(id, 'cancelled')
  },

  /** Restore an inactive scheme. Returns draft if it never ran, otherwise active. */
  async reactivate(id: string): Promise<SchemeStatus> {
    const before = await schemesRepository.get(id)
    if (!before) throw new RepositoryError('Scheme not found')
    if (before.status !== 'cancelled') {
      throw new RepositoryError('Only an inactive scheme can be reactivated.')
    }
    const { count } = await getSupabase()
      .from('rounds')
      .select('*', { count: 'exact', head: true })
      .eq('scheme_id', id)
    const next: SchemeStatus = count && count > 0 ? 'active' : 'draft'
    await schemesRepository.setStatus(id, next)
    return next
  },

  async updateNotes(id: string, notes: string): Promise<void> {
    const before = await schemesRepository.get(id)
    if (!before) throw new RepositoryError('Scheme not found')
    const updated: Scheme = { ...before, notes: notes.trim() || undefined, updatedAt: nowIso() }
    const { error } = await getSupabase().from('schemes').update(schemeToRow(updated)).eq('id', id)
    throwIfError(error)
    notifyDataChanged()
  },
}
