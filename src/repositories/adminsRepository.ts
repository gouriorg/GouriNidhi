import { peopleRepository } from '@/repositories/peopleRepository'
import { getSupabase } from '@/lib/supabase'
import { notifyDataChanged } from '@/stores/dataVersion'
import { RepositoryError } from '@/repositories/errors'
import { nowIso } from '@/lib/id'
import { auditService } from '@/services/audit'
import type { Person } from '@/types/entities'

/** Active members who hold the admin role. The leftover Auth-only admin is ignored. */
async function countMemberAdmins(): Promise<number> {
  const listed = await adminsRepository.list()
  return listed.filter((person) => person.status === 'active').length
}

export const adminsRepository = {
  async list(): Promise<Person[]> {
    const { data, error } = await getSupabase().from('user_roles').select('user_id').eq('role', 'admin')
    if (error) throw new RepositoryError('Could not load admins.')
    const userIds = new Set((data ?? []).map((row) => String(row.user_id)))
    if (userIds.size === 0) return []

    const people = await peopleRepository.list()
    return people
      .filter((person) => person.authUserId && userIds.has(person.authUserId))
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
  },

  async promote(personId: string): Promise<void> {
    const person = await peopleRepository.get(personId)
    if (!person) throw new RepositoryError('Person not found.')
    if (!person.authUserId) throw new RepositoryError('This person does not have a login yet.')
    if (person.status !== 'active') {
      throw new RepositoryError('Reactivate this person before making them an admin.')
    }

    const { error } = await getSupabase()
      .from('user_roles')
      .upsert({ user_id: person.authUserId, role: 'admin', created_at: nowIso() })
    if (error) throw new RepositoryError('Could not add the admin role.')
    await auditService.record({
      action: 'role.admin.granted',
      entityType: 'person',
      entityId: person.id,
      summary: `Granted admin to ${person.fullName}`,
    })
    notifyDataChanged()
  },

  async remove(personId: string): Promise<void> {
    const person = await peopleRepository.get(personId)
    if (!person?.authUserId) throw new RepositoryError('Admin not found.')

    const remaining = await countMemberAdmins()
    if (remaining <= 1) {
      throw new RepositoryError('Keep at least one member as admin.')
    }

    const { error } = await getSupabase()
      .from('user_roles')
      .delete()
      .eq('user_id', person.authUserId)
      .eq('role', 'admin')
    if (error) throw new RepositoryError('Could not remove the admin role.')
    await auditService.record({
      action: 'role.admin.removed',
      entityType: 'person',
      entityId: person.id,
      summary: `Removed admin from ${person.fullName}`,
    })
    notifyDataChanged()
  },
}
