import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

const ADMIN_EMAIL = 'admin@gourinidhi.local'
const ADMIN_PASSWORD = 'admin'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, serviceKey)

  const { data: existingRoles } = await admin.from('user_roles').select('user_id').eq('role', 'admin').limit(1)
  if (existingRoles && existingRoles.length > 0) {
    return json({ ok: true, created: false })
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { role: 'admin' },
  })
  if (error) {
    // Already exists from a previous partial run.
    const { data: users } = await admin.auth.admin.listUsers()
    const found = users.users.find((u) => u.email === ADMIN_EMAIL)
    if (!found) return json({ ok: false, message: error.message }, 400)
    await admin.from('user_roles').upsert({ user_id: found.id, role: 'admin' })
    return json({ ok: true, created: false })
  }

  await admin.from('user_roles').insert({ user_id: data.user.id, role: 'admin' })
  return json({ ok: true, created: true })
})
