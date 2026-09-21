import { LoaderCircleIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  parseSupabaseProject,
  probeSupabaseProject,
  projectRefFromUrl,
  saveSupabaseProject,
} from '@/config/supabaseProject'
import { resetSupabaseClient } from '@/lib/supabase'
import { resetSessionRuntime } from '@/stores/session'

export function ConnectSupabaseForm({
  onConnected,
  submitLabel = 'Use this project',
}: {
  onConnected?: () => void
  submitLabel?: string
}) {
  const [url, setUrl] = useState('')
  const [anonKey, setAnonKey] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseSupabaseProject(url, anonKey)
    if ('error' in parsed) {
      toast.error(parsed.error)
      return
    }

    setBusy(true)
    try {
      const probe = await probeSupabaseProject(parsed)
      if (!probe.ok) {
        toast.error(probe.message)
        return
      }

      try {
        await resetSessionRuntime()
      } catch {
        // No session yet on a blank device.
      }
      resetSupabaseClient()
      saveSupabaseProject(parsed)
      toast.success('Switched to the new Supabase project')
      onConnected?.()
      window.location.assign('/login')
    } finally {
      setBusy(false)
    }
  }

  const projectRef = projectRefFromUrl(url)

  return (
    <form onSubmit={handleSubmit} className="grid gap-3" noValidate>
      <div className="grid gap-2">
        <Label htmlFor="supabase-url">Project URL</Label>
        <Input
          id="supabase-url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://xxxx.supabase.co"
          autoComplete="off"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="supabase-key">Publishable / anon key</Label>
        <Input
          id="supabase-key"
          value={anonKey}
          onChange={(event) => setAnonKey(event.target.value)}
          placeholder="sb_publishable_… or eyJ…"
          autoComplete="off"
        />
      </div>
      <Button type="submit" disabled={busy}>
        {busy && <LoaderCircleIcon className="size-4 animate-spin" />}
        {submitLabel}
      </Button>
      {projectRef && (
        <p className="text-muted-foreground text-xs">
          After connecting, open the{' '}
          <a
            className="text-foreground underline"
            href={`https://supabase.com/dashboard/project/${projectRef}/sql/new`}
            target="_blank"
            rel="noreferrer"
          >
            SQL editor
          </a>{' '}
          and run the setup SQL if this is a brand-new project. Turn off Confirm email under
          Authentication → Providers → Email.
        </p>
      )}
    </form>
  )
}
