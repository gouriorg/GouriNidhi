import { useLiveQuery } from '@/hooks/useLiveQuery'
import {
  AlertTriangleIcon,
  CloudIcon,
  DatabaseIcon,
  DownloadIcon,
  HardDriveIcon,
  SmartphoneIcon,
  UploadIcon,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { countAllRows, backupService, type BackupEnvelope, type TableCounts } from '@/services/backup'
import { loadSampleData } from '@/db/seed'
import { ConnectSupabaseForm } from '@/features/settings/ConnectSupabaseForm'
import { useInstallPrompt } from '@/app/pwa'
import {
  clearSupabaseProjectOverride,
  getSupabaseProject,
  getSupabaseProjectSource,
  hasLocalProjectOverride,
  hostedConfigJson,
  projectHostLabel,
  projectRefFromUrl,
  sourceLabel,
} from '@/config/supabaseProject'
import { APP_NAME, SCHEMA_VERSION } from '@/lib/constants'
import { downloadTextFile } from '@/lib/csv'
import { todayIso } from '@/lib/dates'
import { resetSupabaseClient } from '@/lib/supabase'
import { resetSessionRuntime } from '@/stores/session'
import initSql from '../../../supabase/migrations/20260920120000_init.sql?raw'
import memberRpcSql from '../../../supabase/migrations/20260920120100_member_admin_rpc.sql?raw'

export function SettingsPage() {
  const counts = useLiveQuery(() => countAllRows(), [])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { canInstall, promptInstall } = useInstallPrompt()

  const [pending, setPending] = useState<{
    envelope: BackupEnvelope
    counts: TableCounts
    filename: string
  } | null>(null)
  const [replaceOpen, setReplaceOpen] = useState(false)
  const [replaceConfirmText, setReplaceConfirmText] = useState('')
  const [switchOpen, setSwitchOpen] = useState(false)

  const project = getSupabaseProject()
  const projectHost = project ? projectHostLabel(project.url) : 'Not connected'
  const projectRef = project ? projectRefFromUrl(project.url) : undefined
  const usingOverride = hasLocalProjectOverride()
  const keysFrom = sourceLabel(getSupabaseProjectSource())

  const totalRows = counts
    ? Object.values(counts).reduce((sum, count) => sum + count, 0)
    : 0

  async function handleExport() {
    try {
      const envelope = await backupService.export()
      downloadTextFile(
        `gourinidhi-backup-${todayIso()}.json`,
        JSON.stringify(envelope, null, 2),
        'application/json',
      )
      toast.success('Backup downloaded')
    } catch {
      toast.error('Could not create the backup.')
    }
  }

  async function handleFile(file: File) {
    const text = await file.text()
    const result = backupService.validate(text)
    if (!result.ok) {
      toast.error(result.message)
      setPending(null)
      return
    }
    setPending({ envelope: result.envelope, counts: result.counts, filename: file.name })
    toast.success('Backup file looks valid')
  }

  async function handleMerge() {
    if (!pending) return
    try {
      await backupService.merge(pending.envelope)
      toast.success('Backup merged into your data')
      setPending(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Merge failed.')
    }
  }

  async function handleReplace() {
    if (!pending) return
    try {
      await backupService.replace(pending.envelope)
      toast.success('All data replaced from the backup')
      setPending(null)
      setReplaceConfirmText('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Restore failed.')
    }
  }

  async function handleSampleData() {
    try {
      const result = await loadSampleData()
      toast.success(
        `Loaded ${result.people} sample members and an active scheme with ${result.rounds} rounds`,
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load sample data.')
    }
  }

  function handleDownloadSetupSql() {
    downloadTextFile(
      'gourinidhi-supabase-setup.sql',
      `${initSql}\n\n${memberRpcSql}\n`,
      'application/sql',
    )
    toast.success('Setup SQL downloaded')
  }

  async function handleClearOverride() {
    try {
      await resetSessionRuntime()
    } catch {
      // Ignore.
    }
    resetSupabaseClient()
    clearSupabaseProjectOverride()
    window.location.assign('/login')
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Live data is stored in your Supabase project. Export a backup regularly."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CloudIcon className="text-primary size-5" /> Supabase project
            </CardTitle>
            <CardDescription>
              Switch accounts without changing code. This device: paste keys below. Every member:
              replace supabase.config.json on the host, or set two Vercel env vars and redeploy.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <dl className="grid gap-2 text-sm">
              <Row label="Connected to" value={projectHost} />
              <Row label="Keys from" value={keysFrom} />
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setSwitchOpen((open) => !open)}>
                Switch project
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadSetupSql}>
                <DownloadIcon /> Download setup SQL
              </Button>
              {project && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    downloadTextFile(
                      'supabase.config.json',
                      hostedConfigJson(project),
                      'application/json',
                    )
                    toast.success('Upload this file to the host as /supabase.config.json')
                  }}
                >
                  <DownloadIcon /> Download host config
                </Button>
              )}
              {projectRef && (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`https://supabase.com/dashboard/project/${projectRef}/sql/new`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open SQL editor
                  </a>
                </Button>
              )}
              {usingOverride && (
                <Button variant="ghost" size="sm" onClick={handleClearOverride}>
                  Use .env keys again
                </Button>
              )}
            </div>
            {switchOpen && (
              <div className="border-border rounded-lg border p-4">
                <ConnectSupabaseForm submitLabel="Save and reconnect" />
              </div>
            )}
            <p className="text-muted-foreground text-xs">
              New account: create the project, turn off Confirm email, run setup SQL, then either
              paste keys here (this phone) or put supabase.config.json on the host (everyone). First
              deploy: <code className="font-mono">npm run deploy</code> (Vercel). Export a backup
              first if you need the old data.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DownloadIcon className="text-primary size-5" /> Backup
            </CardTitle>
            <CardDescription>
              Download every member, scheme, round, payment and payout as a single JSON file.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {totalRows === 0 && (
              <div className="border-warning/35 bg-warning/10 text-warning-foreground flex gap-2 rounded-lg border p-3 text-sm">
                <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
                <p>
                  There is nothing to back up yet. Once you add members and schemes, export a
                  backup and keep it somewhere safe.
                </p>
              </div>
            )}
            <Button onClick={handleExport} disabled={totalRows === 0}>
              <DownloadIcon /> Export backup
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UploadIcon className="text-primary size-5" /> Restore
            </CardTitle>
            <CardDescription>
              The file is validated first. Merge uploads into the shared database. Replace wipes
              cloud data first. Use this to move an old IndexedDB JSON backup into Supabase.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) handleFile(file)
                event.target.value = ''
              }}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <UploadIcon /> Choose a backup file
            </Button>

            {pending && (
              <div className="grid gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  <p className="font-medium">{pending.filename}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Exported {pending.envelope.exportedAt.slice(0, 10)} · schema{' '}
                    {pending.envelope.schemaVersion}
                  </p>
                  <ul className="text-muted-foreground mt-2 grid grid-cols-2 gap-x-4 text-xs">
                    {Object.entries(pending.counts).map(([table, count]) => (
                      <li key={table} className="flex justify-between">
                        <span>{table}</span>
                        <span className="tabular">{count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={handleMerge}>
                    Merge into current data
                  </Button>
                  <Button variant="destructive" onClick={() => setReplaceOpen(true)}>
                    Replace everything
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DatabaseIcon className="text-primary size-5" /> Shared database
            </CardTitle>
            <CardDescription>
              {APP_NAME} stores members, schemes and payments in Supabase so every phone and laptop
              sees the same records. An internet connection is required.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <dl className="grid gap-2 text-sm">
              <Row label="Storage" value="Supabase Postgres" />
              <Row label="Schema version" value={String(SCHEMA_VERSION)} />
            </dl>
            <Separator />
            <dl className="grid gap-1.5 text-sm">
              {counts &&
                Object.entries(counts).map(([table, count]) => (
                  <Row key={table} label={table} value={String(count)} />
                ))}
            </dl>
            {totalRows === 0 && (
              <>
                <Separator />
                <div>
                  <p className="mb-2 text-sm font-medium">Just exploring?</p>
                  <Button variant="outline" size="sm" onClick={handleSampleData}>
                    Load sample data
                  </Button>
                  <p className="text-muted-foreground mt-2 text-xs">
                    Adds 20 example members and one active 20-month scheme with the first few
                    months already collected. Only works on an empty app.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SmartphoneIcon className="text-primary size-5" /> Install the app
            </CardTitle>
            <CardDescription>
              Install GouriNidhi to your home screen. Scheme and payment data still needs internet.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {canInstall ? (
              <Button onClick={promptInstall}>
                <HardDriveIcon /> Install GouriNidhi
              </Button>
            ) : (
              <p className="text-muted-foreground text-sm">
                Your browser has not offered an install prompt. On iPhone, use Share → Add to Home
                Screen. On desktop Chrome, look for the install icon in the address bar. If the app
                is already installed, nothing more is needed.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={replaceOpen}
        onOpenChange={(open) => {
          setReplaceOpen(open)
          if (!open) setReplaceConfirmText('')
        }}
        title="Replace all data?"
        description="Every member, scheme, round, payment and payout currently in the shared database will be deleted and replaced by the backup. This cannot be undone."
        confirmLabel="Replace everything"
        destructive
        onConfirm={() => {
          if (replaceConfirmText !== 'REPLACE') {
            toast.error('Type REPLACE to confirm.')
            return
          }
          return handleReplace()
        }}
      >
        <div className="grid gap-2">
          <Label htmlFor="replace-confirm">
            Type <span className="font-mono font-semibold">REPLACE</span> to confirm
          </Label>
          <Input
            id="replace-confirm"
            value={replaceConfirmText}
            onChange={(event) => setReplaceConfirmText(event.target.value)}
            autoComplete="off"
          />
        </div>
      </ConfirmDialog>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground capitalize">{label}</dt>
      <dd className="tabular font-medium">{value}</dd>
    </div>
  )
}
