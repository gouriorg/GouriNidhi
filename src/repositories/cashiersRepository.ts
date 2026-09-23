import { peopleRepository } from '@/repositories/peopleRepository'
import { schemesRepository } from '@/repositories/schemesRepository'
import { membershipsRepository } from '@/repositories/membershipsRepository'
import { getSupabase } from '@/lib/supabase'
import { notifyDataChanged } from '@/stores/dataVersion'
import { RepositoryError } from '@/repositories/errors'
import { nowIso } from '@/lib/id'
import type { Person } from '@/types/entities'

export type CashierAssignment = {
  membershipId: string
  personId: string
  fullName: string
  mobile: string
  schemeId: string
  schemeCode: string
  schemeName: string
}

export type AssignableSeat = {
  membershipId: string
  personId: string
  fullName: string
  mobile: string
  schemeCode: string
  schemeName: string
  collectorPersonId: string | null
  collectorName: string | null
}

export type CashierRecord = Person & {
  assignedCount: number
  assignments: CashierAssignment[]
}

export const cashiersRepository = {
  async list(): Promise<CashierRecord[]> {
    const { data, error } = await getSupabase().from('user_roles').select('user_id').eq('role', 'cashier')
    if (error) throw new RepositoryError('Could not load cashiers.')
    const userIds = (data ?? []).map((row) => String(row.user_id))
    if (userIds.length === 0) return []

    const [people, schemes] = await Promise.all([peopleRepository.list(), schemesRepository.list()])
    const cashiers = people.filter((person) => person.authUserId && userIds.includes(person.authUserId))
    const peopleById = new Map(people.map((person) => [person.id, person]))
    const schemesById = new Map(schemes.map((scheme) => [scheme.id, scheme]))

    const { data: memberships, error: membershipError } = await getSupabase()
      .from('scheme_members')
      .select('id, person_id, scheme_id, collector_person_id')
      .eq('status', 'active')
    if (membershipError) throw new RepositoryError('Could not load cashier assignments.')

    const byCashier = new Map<string, CashierAssignment[]>()
    for (const row of memberships ?? []) {
      const collectorId = row.collector_person_id as string | null
      if (!collectorId) continue
      const person = peopleById.get(String(row.person_id))
      const scheme = schemesById.get(String(row.scheme_id))
      if (!person || !scheme) continue
      const list = byCashier.get(collectorId) ?? []
      list.push({
        membershipId: String(row.id),
        personId: person.id,
        fullName: person.fullName,
        mobile: person.mobile,
        schemeId: scheme.id,
        schemeCode: scheme.code,
        schemeName: scheme.name,
      })
      byCashier.set(collectorId, list)
    }

    for (const assignments of byCashier.values()) {
      assignments.sort((a, b) => a.fullName.localeCompare(b.fullName) || a.schemeCode.localeCompare(b.schemeCode))
    }

    return cashiers
      .map((person) => {
        const assignments = byCashier.get(person.id) ?? []
        return { ...person, assignedCount: assignments.length, assignments }
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
  },

  async listAssignable(cashierId: string): Promise<AssignableSeat[]> {
    const [people, schemes] = await Promise.all([peopleRepository.list(), schemesRepository.list()])
    const peopleById = new Map(people.map((person) => [person.id, person]))
    const schemesById = new Map(schemes.map((scheme) => [scheme.id, scheme]))

    const { data, error } = await getSupabase()
      .from('scheme_members')
      .select('id, person_id, scheme_id, collector_person_id')
      .eq('status', 'active')
    if (error) throw new RepositoryError('Could not load members to assign.')

    return (data ?? [])
      .filter((row) => (row.collector_person_id as string | null) !== cashierId)
      .flatMap((row) => {
        const person = peopleById.get(String(row.person_id))
        const scheme = schemesById.get(String(row.scheme_id))
        if (!person || !scheme) return []
        const collectorId = (row.collector_person_id as string | null) ?? null
        return [
          {
            membershipId: String(row.id),
            personId: person.id,
            fullName: person.fullName,
            mobile: person.mobile,
            schemeCode: scheme.code,
            schemeName: scheme.name,
            collectorPersonId: collectorId,
            collectorName: collectorId ? (peopleById.get(collectorId)?.fullName ?? 'Another cashier') : null,
          },
        ]
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName) || a.schemeCode.localeCompare(b.schemeCode))
  },

  async assignMember(cashierId: string, membershipId: string): Promise<void> {
    await membershipsRepository.setCollector(membershipId, cashierId)
  },

  async unassignMember(membershipId: string): Promise<void> {
    await membershipsRepository.setCollector(membershipId, null)
  },

  async createStandalone(input: { fullName: string; mobile: string }): Promise<void> {
    const person = await peopleRepository.create({
      fullName: input.fullName,
      mobile: input.mobile,
    })
    await cashiersRepository.promote(person.id)
  },

  async promote(personId: string): Promise<void> {
    const person = await peopleRepository.get(personId)
    if (!person) throw new RepositoryError('Person not found.')
    if (!person.authUserId) throw new RepositoryError('This person does not have a login yet.')
    if (person.status !== 'active') throw new RepositoryError('Reactivate this person before making them a cashier.')

    const { error } = await getSupabase()
      .from('user_roles')
      .upsert({ user_id: person.authUserId, role: 'cashier', created_at: nowIso() })
    if (error) throw new RepositoryError('Could not add the cashier role.')
    notifyDataChanged()
  },

  async remove(personId: string): Promise<void> {
    const person = await peopleRepository.get(personId)
    if (!person?.authUserId) throw new RepositoryError('Cashier not found.')

    const { error: clearError } = await getSupabase()
      .from('scheme_members')
      .update({ collector_person_id: null, updated_at: nowIso() })
      .eq('collector_person_id', personId)
    if (clearError) throw new RepositoryError('Could not clear this cashier’s assignments.')

    const { error } = await getSupabase()
      .from('user_roles')
      .delete()
      .eq('user_id', person.authUserId)
      .eq('role', 'cashier')
    if (error) throw new RepositoryError('Could not remove the cashier role.')
    notifyDataChanged()
  },
}
