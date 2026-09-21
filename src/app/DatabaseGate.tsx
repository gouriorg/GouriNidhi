import { CloudOffIcon } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import { ConnectSupabaseForm } from '@/features/settings/ConnectSupabaseForm'
import { loadSupabaseProject } from '@/config/supabaseProject'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useSessionStore } from '@/stores/session'

/**
 * Until a project URL and publishable key exist (env, hosted config, or this browser),
 * the app cannot load shared data.
 */
export function DatabaseGate({ children }: { children: ReactNode }) {
  const hydrate = useSessionStore((s) => s.hydrate)
  const hydrated = useSessionStore((s) => s.hydrated)
  const [configReady, setConfigReady] = useState(false)

  useEffect(() => {
    void loadSupabaseProject().then(() => setConfigReady(true))
  }, [])

  useEffect(() => {
    if (configReady && isSupabaseConfigured()) void hydrate()
  }, [configReady, hydrate])

  if (!configReady) {
    return (
      <div className="bg-background grid min-h-dvh place-items-center px-4">
        <p className="text-muted-foreground text-sm">Connecting…</p>
      </div>
    )
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="bg-background grid min-h-dvh place-items-center px-4 py-10">
        <div className="w-full max-w-md">
          <span className="bg-destructive/12 text-destructive mx-auto mb-5 grid size-14 place-items-center rounded-full">
            <CloudOffIcon className="size-6" />
          </span>
          <h1 className="text-center text-xl font-bold">Connect your Supabase project</h1>
          <p className="text-muted-foreground mt-3 mb-6 text-center text-sm">
            Paste the Project URL and publishable key. You can switch accounts later from Settings or
            by replacing supabase.config.json on the host — no code change.
          </p>
          <ConnectSupabaseForm submitLabel="Connect" />
        </div>
      </div>
    )
  }

  if (!hydrated) {
    return (
      <div className="bg-background grid min-h-dvh place-items-center px-4">
        <p className="text-muted-foreground text-sm">Connecting…</p>
      </div>
    )
  }

  return <>{children}</>
}
