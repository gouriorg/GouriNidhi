import { create } from 'zustand'

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { logout, sessionFromUser } from '@/services/auth'
import type { PersonRole } from '@/types/entities'

/**
 * Workspace session, hydrated from Supabase Auth.
 * Admin is a real Auth user (admin@gourinidhi.local). Members and cashiers are people rows.
 */
export type Session =
  | { kind: 'admin' }
  | {
      kind: 'member'
      personId: string
      fullName: string
      mobile: string
      roles: PersonRole[]
    }
  | null

type SessionState = {
  session: Session
  hydrated: boolean
  setSession: (session: Session) => void
  hydrate: () => Promise<void>
  signOut: () => Promise<void>
}

let listening = false

/** Call when switching Supabase projects so the next hydrate binds to the new client. */
export async function resetSessionRuntime(): Promise<void> {
  listening = false
  try {
    await logout()
  } catch {
    // Ignore if there is no client or session yet.
  }
  useSessionStore.setState({ session: null, hydrated: false })
}

export function isCashierSession(session: Session): boolean {
  return session?.kind === 'member' && session.roles.includes('cashier')
}

export function homePath(session: Session): string {
  if (session?.kind === 'admin') return '/'
  if (isCashierSession(session)) return '/collect'
  if (session?.kind === 'member') return '/me'
  return '/login'
}

export const useSessionStore = create<SessionState>()((set) => ({
  session: null,
  hydrated: false,
  setSession: (session) => set({ session, hydrated: true }),
  hydrate: async () => {
    if (!isSupabaseConfigured()) {
      set({ session: null, hydrated: true })
      return
    }
    const supabase = getSupabase()
    const { data } = await supabase.auth.getSession()
    const user = data.session?.user
    const session = user ? await sessionFromUser(user.id, user.email) : null
    set({ session, hydrated: true })

    if (!listening) {
      listening = true
      supabase.auth.onAuthStateChange((_event, authSession) => {
        void (async () => {
          const nextUser = authSession?.user
          const next = nextUser ? await sessionFromUser(nextUser.id, nextUser.email) : null
          set({ session: next, hydrated: true })
        })()
      })
    }
  },
  signOut: async () => {
    await logout()
    set({ session: null })
  },
}))

export const useSession = () => useSessionStore((s) => s.session)
export const useIsAdmin = () => useSessionStore((s) => s.session?.kind === 'admin')
export const useIsCashier = () => isCashierSession(useSessionStore((s) => s.session))
