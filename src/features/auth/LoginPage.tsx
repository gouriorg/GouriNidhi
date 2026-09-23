import { AlertTriangleIcon, LoaderCircleIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'

import { BrandLockup } from '@/components/brand/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AUTH_WARNING } from '@/config/auth'
import { getSupabaseProject, projectHostLabel } from '@/config/supabaseProject'
import { ConnectSupabaseForm } from '@/features/settings/ConnectSupabaseForm'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { login } from '@/services/auth'
import { homePath, useSession, useSessionStore } from '@/stores/session'

export function LoginPage() {
  const session = useSession()
  const setSession = useSessionStore((s) => s.setSession)
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [switchOpen, setSwitchOpen] = useState(false)

  const project = getSupabaseProject()
  const projectHost = project ? projectHostLabel(project.url) : null

  if (session) {
    return <Navigate to={homePath(session)} replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    try {
      const result = await login(username, password)
      if (!result.ok) {
        setError(result.message)
        return
      }

      setSession(result.session)
      navigate(homePath(result.session), { replace: true })
    } catch {
      setError('Could not sign in. Check your connection and Supabase configuration.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="bg-background grid min-h-dvh place-items-center px-4 py-10 pb-24">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <BrandLockup />
        </div>

        <Card>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
              <div className="grid gap-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  name="username"
                  autoComplete="username"
                  inputMode="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="admin or your mobile number"
                  aria-invalid={Boolean(error)}
                  autoFocus
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={Boolean(error)}
                />
                <p className="text-muted-foreground text-xs">
                  Members: use your mobile number in both fields.
                </p>
              </div>

              {error && (
                <p role="alert" className="text-destructive text-sm">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <LoaderCircleIcon className="size-4 animate-spin" />}
                Sign in
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="border-warning/35 bg-warning/10 text-warning-foreground mt-6 flex gap-2 rounded-lg border p-3 text-xs">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <p>{AUTH_WARNING}</p>
        </div>

        <p className="text-muted-foreground mt-6 text-center text-xs">
          Shared database: {projectHost ?? 'not connected'}. Change it here or by replacing
          supabase.config.json on the host.
        </p>
        <div className="mt-3 text-center">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
            onClick={() => setSwitchOpen((open) => !open)}
          >
            Use a different Supabase project
          </button>
        </div>
        {switchOpen && (
          <div className="border-border mt-4 rounded-lg border p-4">
            <ConnectSupabaseForm submitLabel="Save and go to sign in" />
          </div>
        )}
      </div>
      </div>
      <SiteFooter />
    </>
  )
}
