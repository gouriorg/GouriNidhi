import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { getSupabaseProject, isValidSupabaseProject } from '@/config/supabaseProject'

export function isSupabaseConfigured(): boolean {
  return isValidSupabaseProject(getSupabaseProject())
}

let client: SupabaseClient | null = null
let clientKey: string | null = null

export function resetSupabaseClient(): void {
  client = null
  clientKey = null
}

export function getSupabase(): SupabaseClient {
  const project = getSupabaseProject()
  if (!project) {
    throw new Error(
      'Supabase is not configured. Paste your project URL and publishable key in Settings, or add them to .env.local.',
    )
  }

  const fingerprint = `${project.url}::${project.anonKey}`
  if (client && clientKey === fingerprint) return client

  client = createClient(project.url, project.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: `gourinidhi.auth.${project.url}`,
    },
  })
  clientKey = fingerprint
  return client
}
