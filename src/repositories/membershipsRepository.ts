import { schemeMemberSchema } from '@/db/schema'
import { todayIso } from '@/lib/dates'
import { newId, nowIso } from '@/lib/id'
import { mapMembership, membershipToRow, throwIfError } from '@/lib/mappers'
import { getSupabase } from '@/lib/supabase'
import { auditService } from '@/services/audit'
import { notifyDataChanged } from '@/stores/dataVersion'
import { RepositoryError } from '@/repositories/errors'
import { peopleRepository } from '@/repositories/peopleRepository'
import { roundsRepository } from '@/repositories/roundsRepository'
import { schemesRepository } from '@/repositories/schemesRepository'
import type { Person, SchemeMember } from '@/types/entities'

export type MembershipWithPerson = SchemeMember & { person: Person }

export const membershipsRepository = {
  async listForScheme(schemeId: string): Promise<SchemeMember[]> {
    const { data, error } = await getSupabase()
      .from('scheme_members')
      .select('*')
      .eq('scheme_id', schemeId)
      .order('member_number')
    throwIfError(error)
    return (data ?? []).map(mapMembership)
  },

  async listForSchemeWithPeople(schemeId: string): Promise<MembershipWithPerson[]> {
    const rows = await membershipsRepository.listForScheme(schemeId)
    const people = await Promise.all(rows.map((row) => peopleRepository.get(row.personId)))
    return rows
      .map((row, index) => ({ ...row, person: people[index] }))
      .filter((row): row is MembershipWithPerson => Boolean(row.person))
  },

  async listForPerson(personId: string): Promise<SchemeMember[]> {
    const { data, error } = await getSupabase()
      .from('scheme_members')
      .select('*')
      .eq('person_id', personId)
    throwIfError(error)
    return (data ?? []).map(mapMembership)
  },

  async find(schemeId: string, personId: string): Promise<SchemeMember | undefined> {
    const { data, error } = await getSupabase()
      .from('scheme_members')
      .select('*')
      .eq('scheme_id', schemeId)
      .eq('person_id', personId)
      .maybeSingle()
    throwIfError(error)
    return data ? mapMembership(data) : undefined
  },

  async countActive(schemeId: string): Promise<number> {
    const { count, error } = await getSupabase()
      .from('scheme_members')
      .select('*', { count: 'exact', head: true })
      .eq('scheme_id', schemeId)
      .eq('status', 'active')
    throwIfError(error)
    return count ?? 0
  },

  async add(schemeId: string, personId: string): Promise<SchemeMember> {
    const scheme = await schemesRepository.get(schemeId)
    if (!scheme) throw new RepositoryError('Scheme not found')
    if (scheme.status === 'completed' || scheme.status === 'cancelled') {
      throw new RepositoryError(`Cannot change the roster of a ${scheme.status} scheme.`)
    }
    const person = await peopleRepository.get(personId)
    if (!person) throw new RepositoryError('Member not found')
    if (person.status !== 'active') {
      throw new RepositoryError(`${person.fullName} is inactive and cannot join a scheme.`)
    }

    const existing = await membershipsRepository.find(schemeId, personId)
    if (existing) {
      if (existing.status === 'active') {
        throw new RepositoryError(`${person.fullName} is already in this scheme.`)
      }
      const reactivated: SchemeMember = { ...existing, status: 'active', updatedAt: nowIso() }
      const { error } = await getSupabase()
        .from('scheme_members')
        .update(membershipToRow(reactivated))
        .eq('id', existing.id)
      throwIfError(error)
      await auditService.record({
        action: 'membership.reactivated',
        entityType: 'schemeMember',
        entityId: reactivated.id,
        summary: `Reactivated ${person.fullName} in ${scheme.code}`,
        before: existing,
        after: reactivated,
      })
      if (scheme.status === 'active') {
        await roundsRepository.openDueCollections()
      }
      notifyDataChanged()
      return reactivated
    }

    const allRows = await membershipsRepository.listForScheme(schemeId)
    const nextNumber = allRows.reduce((max, row) => Math.max(max, row.memberNumber), 0) + 1
    const timestamp = nowIso()
    const membership = schemeMemberSchema.parse({
      id: newId(),
      schemeId,
      personId,
      memberNumber: nextNumber,
      status: 'active',
      joinedAt: todayIso(),
      createdAt: timestamp,
      updatedAt: timestamp,
    } satisfies SchemeMember)

    const { error } = await getSupabase().from('scheme_members').insert(membershipToRow(membership))
    throwIfError(error)
    await auditService.record({
      action: 'membership.added',
      entityType: 'schemeMember',
      entityId: membership.id,
      summary: `Added ${person.fullName} to ${scheme.code} as member #${nextNumber}`,
      after: membership,
    })
    if (scheme.status === 'active') {
      await roundsRepository.openDueCollections()
    }
    notifyDataChanged()
    return membership
  },

  async setMemberNumber(membershipId: string, memberNumber: number): Promise<void> {
    const { data, error } = await getSupabase()
      .from('scheme_members')
      .select('*')
      .eq('id', membershipId)
      .maybeSingle()
    throwIfError(error)
    if (!data) throw new RepositoryError('Membership not found')
    const before = mapMembership(data)

    const { count } = await getSupabase()
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('scheme_id', before.schemeId)
      .eq('person_id', before.personId)
    if (count && count > 0) {
      throw new RepositoryError('Member number cannot change after the first payment exists.')
    }

    const { data: clash } = await getSupabase()
      .from('scheme_members')
      .select('id')
      .eq('scheme_id', before.schemeId)
      .eq('member_number', memberNumber)
      .maybeSingle()
    if (clash && clash.id !== membershipId) {
      throw new RepositoryError(`Member #${memberNumber} is already taken in this scheme.`)
    }

    const updated = membershipToRow({ ...before, memberNumber, updatedAt: nowIso() })
    const { error: updateError } = await getSupabase()
      .from('scheme_members')
      .update(updated)
      .eq('id', membershipId)
    throwIfError(updateError)
    notifyDataChanged()
  },

  async remove(membershipId: string): Promise<void> {
    const { data, error } = await getSupabase()
      .from('scheme_members')
      .select('*')
      .eq('id', membershipId)
      .maybeSingle()
    throwIfError(error)
    if (!data) throw new RepositoryError('Membership not found')
    const membership = mapMembership(data)

    const [{ count: payments }, { count: payouts }] = await Promise.all([
      getSupabase()
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .eq('scheme_id', membership.schemeId)
        .eq('person_id', membership.personId),
      getSupabase()
        .from('payouts')
        .select('*', { count: 'exact', head: true })
        .eq('scheme_id', membership.schemeId)
        .eq('person_id', membership.personId),
    ])
    if ((payments ?? 0) > 0 || (payouts ?? 0) > 0) {
      throw new RepositoryError(
        'This member already has payments or payouts recorded. Deactivate the membership instead of removing it.',
      )
    }

    const [person, scheme] = await Promise.all([
      peopleRepository.get(membership.personId),
      schemesRepository.get(membership.schemeId),
    ])
    const { error: delError } = await getSupabase().from('scheme_members').delete().eq('id', membershipId)
    throwIfError(delError)
    await auditService.record({
      action: 'membership.removed',
      entityType: 'schemeMember',
      entityId: membershipId,
      summary: `Removed ${person?.fullName ?? 'member'} from ${scheme?.code ?? 'scheme'}`,
      before: membership,
    })
    notifyDataChanged()
  },

  async setCollector(membershipId: string, collectorPersonId: string | null): Promise<void> {
    const { data, error } = await getSupabase()
      .from('scheme_members')
      .select('*')
      .eq('id', membershipId)
      .maybeSingle()
    throwIfError(error)
    if (!data) throw new RepositoryError('Membership not found')
    const before = mapMembership(data)
    const updated: SchemeMember = { ...before, collectorPersonId: collectorPersonId ?? undefined, updatedAt: nowIso() }
    const { error: updateError } = await getSupabase()
      .from('scheme_members')
      .update(membershipToRow(updated))
      .eq('id', membershipId)
    throwIfError(updateError)
    notifyDataChanged()
  },

  async assignUnassigned(schemeId: string, collectorPersonId: string): Promise<number> {
    const { data, error } = await getSupabase()
      .from('scheme_members')
      .update({ collector_person_id: collectorPersonId, updated_at: nowIso() })
      .eq('scheme_id', schemeId)
      .eq('status', 'active')
      .is('collector_person_id', null)
      .select('id')
    throwIfError(error)
    notifyDataChanged()
    return data?.length ?? 0
  },

  async listActive(): Promise<SchemeMember[]> {
    const { data, error } = await getSupabase()
      .from('scheme_members')
      .select('*')
      .eq('status', 'active')
    throwIfError(error)
    return (data ?? []).map(mapMembership)
  },

  async listAssignedTo(collectorPersonId: string): Promise<SchemeMember[]> {
    const { data, error } = await getSupabase()
      .from('scheme_members')
      .select('*')
      .eq('collector_person_id', collectorPersonId)
      .eq('status', 'active')
    throwIfError(error)
    return (data ?? []).map(mapMembership)
  },

  async setStatus(membershipId: string, status: SchemeMember['status']): Promise<void> {
    const { data, error } = await getSupabase()
      .from('scheme_members')
      .select('*')
      .eq('id', membershipId)
      .maybeSingle()
    throwIfError(error)
    if (!data) throw new RepositoryError('Membership not found')
    const before = mapMembership(data)
    const [person, scheme] = await Promise.all([
      peopleRepository.get(before.personId),
      schemesRepository.get(before.schemeId),
    ])
    const updated: SchemeMember = { ...before, status, updatedAt: nowIso() }
    const { error: updateError } = await getSupabase()
      .from('scheme_members')
      .update(membershipToRow(updated))
      .eq('id', membershipId)
    throwIfError(updateError)
    await auditService.record({
      action: status === 'active' ? 'membership.reactivated' : 'membership.deactivated',
      entityType: 'schemeMember',
      entityId: membershipId,
      summary: `${status === 'active' ? 'Reactivated' : 'Deactivated'} ${person?.fullName ?? 'member'} in ${scheme?.code ?? 'scheme'}`,
      before,
      after: updated,
    })
    notifyDataChanged()
  },
}
