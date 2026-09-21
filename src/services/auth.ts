import { ADMIN_CREDENTIALS, ADMIN_EMAIL, memberEmail } from '@/config/auth'
import { getSupabase } from '@/lib/supabase'
import { peopleRepository } from '@/repositories/peopleRepository'
import type { Session } from '@/stores/session'

export type LoginResult =
  | { ok: true; session: NonNullable<Session> }
  | { ok: false; message: string }

async function roleFor(userId: string): Promise<'admin' | 'member' | null> {
  const { data } = await getSupabase()
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()
  if (data?.role === 'admin' || data?.role === 'member') return data.role
  return null
}

export async function sessionFromUser(userId: string, email?: string | null): Promise<Session> {
  const role = await roleFor(userId)
  if (role === 'admin' || email === ADMIN_EMAIL) {
    return { kind: 'admin' }
  }

  const person =
    (await peopleRepository.findByAuthUserId(userId)) ??
    (email?.endsWith('@members.gourinidhi.local')
      ? await peopleRepository.findByMobile(email.split('@')[0] ?? '')
      : undefined)

  if (!person) return null
  if (person.status !== 'active') return null

  return {
    kind: 'member',
    personId: person.id,
    fullName: person.fullName,
    mobile: person.mobile,
  }
}

/**
 * Username + password on the login screen. Admin is still admin/admin; members
 * use their 10-digit mobile as both fields. Auth is checked on Supabase.
 */
export async function login(username: string, password: string): Promise<LoginResult> {
  const user = username.trim()
  const pass = password.trim()

  if (!user || !pass) {
    return { ok: false, message: 'Enter both a username and a password.' }
  }

  const supabase = getSupabase()

  if (user === ADMIN_CREDENTIALS.username && pass === ADMIN_CREDENTIALS.password) {
    try {
      await supabase.functions.invoke('bootstrap-admin', { body: {} })
    } catch {
      // Optional: the first admin can already exist from SQL bootstrap.
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_CREDENTIALS.password,
    })
    if (error) {
      return {
        ok: false,
        message: error.message || 'Could not sign in as admin.',
      }
    }
    return { ok: true, session: { kind: 'admin' } }
  }

  if (!/^\d{10}$/.test(user) || pass !== user) {
    return { ok: false, message: 'Incorrect username or password.' }
  }

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
      message: 'This member is inactive. Ask the admin to reactivate the account.',
    }
  }

  return { ok: true, session }
}

export async function logout(): Promise<void> {
  await getSupabase().auth.signOut()
}
