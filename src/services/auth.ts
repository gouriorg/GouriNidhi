import { memberEmail } from '@/config/auth'
import { normalizeIndianMobileInput } from '@/lib/mobile'
import { getSupabase } from '@/lib/supabase'
import { peopleRepository } from '@/repositories/peopleRepository'
import type { Session } from '@/stores/session'
import type { PersonRole } from '@/types/entities'

export type LoginResult =
  | { ok: true; session: NonNullable<Session> }
  | { ok: false; message: string }

async function rolesFor(userId: string): Promise<string[]> {
  const { data } = await getSupabase().from('user_roles').select('role').eq('user_id', userId)
  return (data ?? []).map((row) => String(row.role))
}

export async function sessionFromUser(userId: string, email?: string | null): Promise<Session> {
  const roles = await rolesFor(userId)
  const person =
    (await peopleRepository.findByAuthUserId(userId)) ??
    (email?.endsWith('@members.gourinidhi.local')
      ? await peopleRepository.findByMobile(email.split('@')[0] ?? '')
      : undefined)

  if (person) {
    if (person.status !== 'active') return null
    const personRoles = roles.filter(
      (role): role is PersonRole => role === 'member' || role === 'cashier' || role === 'admin',
    )
    if (personRoles.length === 0) personRoles.push('member')
    return {
      kind: 'member',
      personId: person.id,
      fullName: person.fullName,
      mobile: person.mobile,
      roles: personRoles,
    }
  }

  return null
}

/**
 * Username + password on the login screen. Members, cashiers, and assigned
 * admins use their 10-digit mobile as both fields. Auth is checked on Supabase.
 */
export async function login(username: string, password: string): Promise<LoginResult> {
  const user = normalizeIndianMobileInput(username)
  const pass = normalizeIndianMobileInput(password)

  if (!user || !pass) {
    return { ok: false, message: 'Enter both a username and a password.' }
  }

  if (!/^\d{10}$/.test(user) || pass !== user) {
    return { ok: false, message: 'Incorrect username or password.' }
  }

  const supabase = getSupabase()

  const { error } = await supabase.auth.signInWithPassword({
    email: memberEmail(user),
    password: pass,
  })
  if (error) {
    return { ok: false, message: 'Incorrect username or password.' }
  }

  const { data: userData } = await supabase.auth.getUser()
  const session = userData.user ? await sessionFromUser(userData.user.id, userData.user.email) : null
  if (!session || session.kind !== 'member') {
    await supabase.auth.signOut()
    return {
      ok: false,
      message: 'This account is inactive. Ask the admin to reactivate it.',
    }
  }

  return { ok: true, session }
}

export async function logout(): Promise<void> {
  await getSupabase().auth.signOut()
}
