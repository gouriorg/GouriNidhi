import { personSchema } from '@/db/schema'
import { getSupabase } from '@/lib/supabase'
import { mapPerson, throwIfError } from '@/lib/mappers'
import { notifyDataChanged } from '@/stores/dataVersion'
import { auditService } from '@/services/audit'
import { RepositoryError } from '@/repositories/errors'
import type { Person } from '@/types/entities'

export type PersonInput = {
  fullName: string
  mobile: string
  address?: string
  notes?: string
}

function normalise(input: PersonInput) {
  return {
    fullName: input.fullName.trim(),
    mobile: input.mobile.trim(),
    address: input.address?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
  }
}

function normalisePartial(input: Partial<PersonInput>) {
  const data: Partial<ReturnType<typeof normalise>> = {}
  if (input.fullName !== undefined) data.fullName = input.fullName.trim()
  if (input.mobile !== undefined) data.mobile = input.mobile.trim()
  if (input.address !== undefined) data.address = input.address.trim() || undefined
  if (input.notes !== undefined) data.notes = input.notes.trim() || undefined
  return data
}

async function invokeMemberAdmin(body: Record<string, unknown>) {
  const { data, error } = await getSupabase().rpc('member_admin', { payload: body })
  if (!error && data?.ok) return data

  const viaFunction = await getSupabase().functions.invoke('member-admin', { body })
  if (!viaFunction.error && viaFunction.data?.ok) return viaFunction.data

  const message =
    (typeof data === 'object' && data && 'message' in data ? String(data.message) : null) ||
    error?.message ||
    viaFunction.error?.message ||
    viaFunction.data?.message ||
    'Member update failed.'
  throw new RepositoryError(message)
}

export const peopleRepository = {
  async list(): Promise<Person[]> {
    const { data, error } = await getSupabase()
      .from('people')
      .select('*')
      .order('full_name')
    throwIfError(error)
    return (data ?? []).map(mapPerson)
  },

  async get(id: string): Promise<Person | undefined> {
    const { data, error } = await getSupabase().from('people').select('*').eq('id', id).maybeSingle()
    throwIfError(error)
    return data ? mapPerson(data) : undefined
  },

  async findByMobile(mobile: string): Promise<Person | undefined> {
    const { data, error } = await getSupabase()
      .from('people')
      .select('*')
      .eq('mobile', mobile.trim())
      .maybeSingle()
    throwIfError(error)
    return data ? mapPerson(data) : undefined
  },

  async findByAuthUserId(authUserId: string): Promise<Person | undefined> {
    const { data, error } = await getSupabase()
      .from('people')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle()
    throwIfError(error)
    return data ? mapPerson(data) : undefined
  },

  async create(input: PersonInput): Promise<Person> {
    const data = normalise(input)
    const result = await invokeMemberAdmin({ action: 'create', ...data })
    const person = mapPerson(result.person)
    await auditService.record({
      action: 'member.created',
      entityType: 'person',
      entityId: person.id,
      summary: `Added member ${person.fullName} (${person.mobile})`,
      after: person,
    })
    notifyDataChanged()
    return person
  },

  async update(id: string, input: Partial<PersonInput>): Promise<Person> {
    const before = await peopleRepository.get(id)
    if (!before) throw new RepositoryError('Member not found')
    const data = normalisePartial(input)
    const result = await invokeMemberAdmin({ action: 'update', id, ...data })
    notifyDataChanged()
    return personSchema.parse(mapPerson(result.person))
  },

  async setStatus(id: string, status: Person['status']): Promise<void> {
    if (status === 'inactive') {
      const person = await peopleRepository.get(id)
      if (person?.authUserId) {
        const { data, error } = await getSupabase()
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin')
        throwIfError(error)
        const adminUserIds = new Set((data ?? []).map((row) => String(row.user_id)))
        if (adminUserIds.has(person.authUserId)) {
          const people = await peopleRepository.list()
          const otherActiveAdmins = people.filter(
            (row) =>
              row.id !== id &&
              row.status === 'active' &&
              row.authUserId &&
              adminUserIds.has(row.authUserId),
          )
          if (otherActiveAdmins.length === 0) {
            throw new RepositoryError('Keep at least one member as admin.')
          }
        }
      }
    }
    await invokeMemberAdmin({ action: 'setStatus', id, status })
    notifyDataChanged()
  },

  async count(): Promise<number> {
    const { count, error } = await getSupabase()
      .from('people')
      .select('*', { count: 'exact', head: true })
    throwIfError(error)
    return count ?? 0
  },
}
