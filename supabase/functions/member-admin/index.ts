import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

const MEMBER_DOMAIN = 'members.gourinidhi.local'

function memberEmail(mobile: string) {
  return `${mobile}@${MEMBER_DOMAIN}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ ok: false, message: 'Not signed in.' }, 401)

  const admin = createClient(url, serviceKey)
  const asUser = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData } = await asUser.auth.getUser()
  if (!userData.user) return json({ ok: false, message: 'Not signed in.' }, 401)
  const { data: roleRow } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', userData.user.id)
    .maybeSingle()
  if (roleRow?.role !== 'admin') {
    return json({ ok: false, message: 'Only an admin can manage members.' }, 403)
  }
  const body = await req.json()
  const action = body.action as string

  if (action === 'create') {
    const fullName = String(body.fullName ?? '').trim()
    const mobile = String(body.mobile ?? '').trim()
    const address = body.address ? String(body.address).trim() : null
    const notes = body.notes ? String(body.notes).trim() : null
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      return json({ ok: false, message: 'Enter a valid 10-digit Indian mobile number.' }, 400)
    }
    if (fullName.length < 2) {
      return json({ ok: false, message: 'Name must be at least 2 characters.' }, 400)
    }

    const { data: clash } = await admin.from('people').select('id, full_name').eq('mobile', mobile).maybeSingle()
    if (clash) {
      return json({ ok: false, message: `${clash.full_name} already uses mobile ${mobile}.` }, 400)
    }

    const { data: created, error: authError } = await admin.auth.admin.createUser({
      email: memberEmail(mobile),
      password: mobile,
      email_confirm: true,
      user_metadata: { role: 'member', mobile, fullName },
    })
    if (authError || !created.user) {
      return json({ ok: false, message: authError?.message ?? 'Could not create login.' }, 400)
    }

    const now = new Date().toISOString()
    const person = {
      id: created.user.id,
      full_name: fullName,
      mobile,
      address,
      notes,
      status: 'active',
      auth_user_id: created.user.id,
      created_at: now,
      updated_at: now,
    }
    const { error: insertError } = await admin.from('people').insert(person)
    if (insertError) {
      await admin.auth.admin.deleteUser(created.user.id)
      return json({ ok: false, message: insertError.message }, 400)
    }
    await admin.from('user_roles').insert({ user_id: created.user.id, role: 'member' })
    return json({ ok: true, person })
  }

  if (action === 'update') {
    const id = String(body.id)
    const { data: before } = await admin.from('people').select('*').eq('id', id).maybeSingle()
    if (!before) return json({ ok: false, message: 'Member not found.' }, 404)

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.fullName !== undefined) patch.full_name = String(body.fullName).trim()
    if (body.address !== undefined) patch.address = String(body.address).trim() || null
    if (body.notes !== undefined) patch.notes = String(body.notes).trim() || null
    if (body.mobile !== undefined) {
      const mobile = String(body.mobile).trim()
      if (!/^[6-9]\d{9}$/.test(mobile)) {
        return json({ ok: false, message: 'Enter a valid 10-digit Indian mobile number.' }, 400)
      }
      patch.mobile = mobile
      if (before.auth_user_id) {
        await admin.auth.admin.updateUserById(before.auth_user_id, {
          email: memberEmail(mobile),
          password: mobile,
          user_metadata: { role: 'member', mobile, fullName: patch.full_name ?? before.full_name },
        })
      }
    }

    const { data: updated, error } = await admin.from('people').update(patch).eq('id', id).select().single()
    if (error) return json({ ok: false, message: error.message }, 400)
    return json({ ok: true, person: updated })
  }

  if (action === 'setStatus') {
    const id = String(body.id)
    const status = body.status === 'inactive' ? 'inactive' : 'active'
    const { data: before } = await admin.from('people').select('*').eq('id', id).maybeSingle()
    if (!before) return json({ ok: false, message: 'Member not found.' }, 404)

    const { data: updated, error } = await admin
      .from('people')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) return json({ ok: false, message: error.message }, 400)

    if (before.auth_user_id) {
      await admin.auth.admin.updateUserById(before.auth_user_id, {
        ban_duration: status === 'inactive' ? '876000h' : 'none',
      })
    }
    return json({ ok: true, person: updated })
  }

  if (action === 'ensureAuth') {
    const id = String(body.id)
    const { data: person } = await admin.from('people').select('*').eq('id', id).maybeSingle()
    if (!person) return json({ ok: false, message: 'Member not found.' }, 404)
    if (person.auth_user_id) return json({ ok: true, person })

    const mobile = String(person.mobile)
    const email = memberEmail(mobile)
    let userId: string | undefined
    const { data: created, error: authError } = await admin.auth.admin.createUser({
      email,
      password: mobile,
      email_confirm: true,
      user_metadata: { role: 'member', mobile, fullName: person.full_name },
    })
    if (created?.user) {
      userId = created.user.id
    } else {
      const { data: users } = await admin.auth.admin.listUsers()
      userId = users.users.find((u) => u.email === email)?.id
      if (!userId) return json({ ok: false, message: authError?.message ?? 'Could not create login.' }, 400)
    }
    const { data: updated, error } = await admin
      .from('people')
      .update({ auth_user_id: userId, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) return json({ ok: false, message: error.message }, 400)
    await admin.from('user_roles').upsert({ user_id: userId, role: 'member' })
    return json({ ok: true, person: updated })
  }

  return json({ ok: false, message: 'Unknown action.' }, 400)
})
