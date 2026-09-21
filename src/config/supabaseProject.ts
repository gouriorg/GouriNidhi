const STORAGE_KEY = 'gourinidhi.supabase'
export const HOSTED_CONFIG_PATH = '/supabase.config.json'

export type SupabaseProject = {
  url: string
  anonKey: string
}

export type SupabaseProjectSource = 'browser' | 'hosted' | 'env' | 'none'

type ResolvedProject = {
  project: SupabaseProject | null
  source: SupabaseProjectSource
}

let resolved: ResolvedProject | null = null
let loadPromise: Promise<ResolvedProject> | null = null

function envProject(): SupabaseProject | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey) return null
  return { url, anonKey }
}

function readOverride(): SupabaseProject | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SupabaseProject>
    if (!parsed.url || !parsed.anonKey) return null
    return { url: parsed.url, anonKey: parsed.anonKey }
  } catch {
    return null
  }
}

export function parseSupabaseProject(url: string, anonKey: string): SupabaseProject | { error: string } {
  const cleanUrl = url.trim().replace(/\/+$/, '')
  const cleanKey = anonKey.trim()
  if (!cleanUrl.startsWith('https://') || !cleanUrl.includes('.supabase.co')) {
    return { error: 'Paste the Project URL, like https://abcd.supabase.co' }
  }
  if (!cleanKey.startsWith('sb_publishable_') && !cleanKey.startsWith('eyJ')) {
    return { error: 'Paste the publishable or anon public key from Project Settings → API.' }
  }
  return { url: cleanUrl, anonKey: cleanKey }
}

export function isValidSupabaseProject(project: SupabaseProject | null): project is SupabaseProject {
  if (!project) return false
  const parsed = parseSupabaseProject(project.url, project.anonKey)
  return !('error' in parsed)
}

function asProject(candidate: Partial<SupabaseProject> | null): SupabaseProject | null {
  if (!candidate?.url || !candidate.anonKey) return null
  const parsed = parseSupabaseProject(candidate.url, candidate.anonKey)
  return 'error' in parsed ? null : parsed
}

async function fetchHostedProject(): Promise<SupabaseProject | null> {
  if (typeof fetch === 'undefined') return null
  try {
    const response = await fetch(HOSTED_CONFIG_PATH, { cache: 'no-store' })
    if (!response.ok) return null
    const parsed = (await response.json()) as Partial<SupabaseProject>
    return asProject(parsed)
  } catch {
    return null
  }
}

function resolveSync(): ResolvedProject {
  const override = asProject(readOverride())
  if (override) return { project: override, source: 'browser' }
  const fromEnv = asProject(envProject())
  if (fromEnv) return { project: fromEnv, source: 'env' }
  return { project: null, source: 'none' }
}

/**
 * Browser override, then `/supabase.config.json` on the host, then build/.env keys.
 * Call `loadSupabaseProject()` once at startup before using the client.
 */
export function getSupabaseProject(): SupabaseProject | null {
  if (resolved) return resolved.project
  return resolveSync().project
}

export function getSupabaseProjectSource(): SupabaseProjectSource {
  if (resolved) return resolved.source
  return resolveSync().source
}

export async function loadSupabaseProject(): Promise<ResolvedProject> {
  if (resolved) return resolved
  if (!loadPromise) {
    loadPromise = (async () => {
      const override = asProject(readOverride())
      if (override) {
        resolved = { project: override, source: 'browser' }
        return resolved
      }
      const hosted = await fetchHostedProject()
      if (hosted) {
        resolved = { project: hosted, source: 'hosted' }
        return resolved
      }
      const fromEnv = asProject(envProject())
      resolved = fromEnv
        ? { project: fromEnv, source: 'env' }
        : { project: null, source: 'none' }
      return resolved
    })()
  }
  return loadPromise
}

export function invalidateSupabaseProjectCache(): void {
  resolved = null
  loadPromise = null
}

export function hasLocalProjectOverride(): boolean {
  return Boolean(asProject(readOverride()))
}

export function saveSupabaseProject(project: SupabaseProject): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
  invalidateSupabaseProjectCache()
}

export function clearSupabaseProjectOverride(): void {
  localStorage.removeItem(STORAGE_KEY)
  invalidateSupabaseProjectCache()
}

export function hostedConfigJson(project: SupabaseProject): string {
  return `${JSON.stringify({ url: project.url, anonKey: project.anonKey }, null, 2)}\n`
}

export function projectRefFromUrl(url: string): string | undefined {
  try {
    const host = new URL(url).hostname
    const ref = host.split('.')[0]
    return ref && ref !== 'supabase' ? ref : undefined
  } catch {
    return undefined
  }
}

export function projectHostLabel(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

export function sourceLabel(source: SupabaseProjectSource): string {
  switch (source) {
    case 'browser':
      return 'This browser only'
    case 'hosted':
      return 'Hosted supabase.config.json'
    case 'env':
      return 'Build / .env keys'
    default:
      return 'Not connected'
  }
}

export async function probeSupabaseProject(project: SupabaseProject): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await fetch(`${project.url}/auth/v1/health`, {
      headers: {
        apikey: project.anonKey,
        Authorization: `Bearer ${project.anonKey}`,
      },
    })
    if (!response.ok && response.status !== 401) {
      return { ok: false, message: `That project did not respond (${response.status}). Check the URL and key.` }
    }
    return { ok: true }
  } catch {
    return { ok: false, message: 'Could not reach that project. Check the URL and your internet connection.' }
  }
}
