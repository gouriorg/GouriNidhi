import { LoaderCircleIcon, UploadIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { parseWorkbook } from '@/lib/bulkImport/parse'
import type { ImportPreview, MemberImportRow, SchemeImportRow } from '@/lib/bulkImport/types'
import { validateMemberTable, validateSchemeTable } from '@/lib/bulkImport/validate'
import { toReadableError } from '@/repositories/errors'
import { peopleRepository } from '@/repositories/peopleRepository'
import { schemesRepository } from '@/repositories/schemesRepository'

export function BulkImportDialog({
  open,
  onOpenChange,
  kind,
  existingNames,
  existingMobiles = [],
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: 'members' | 'schemes'
  existingNames: string[]
  existingMobiles?: string[]
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string>()
  const [preview, setPreview] = useState<ImportPreview<MemberImportRow | SchemeImportRow>>()
  const [importing, setImporting] = useState(false)

  function reset() {
    setFileName(undefined)
    setPreview(undefined)
    setImporting(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    setFileName(file.name)
    const buffer = await file.arrayBuffer()
    const table = parseWorkbook(buffer, file.name)
    setPreview(
      kind === 'members'
        ? validateMemberTable(table, { names: existingNames, mobiles: existingMobiles })
        : validateSchemeTable(table, existingNames),
    )
  }

  async function importRows() {
    if (!preview || preview.fileError || preview.errors.length > 0 || preview.valid.length === 0) return
    setImporting(true)
    try {
      if (kind === 'members') {
        const rows = preview.valid as MemberImportRow[]
        for (const row of rows) {
          await peopleRepository.create(row)
        }
        toast.success(`Added ${rows.length} member${rows.length === 1 ? '' : 's'}`)
      } else {
        const rows = preview.valid as SchemeImportRow[]
        const codes: string[] = []
        for (const row of rows) {
          const saved = await schemesRepository.create(row)
          codes.push(saved.code)
        }
        toast.success(
          rows.length === 1
            ? `Created scheme ${codes[0]}`
            : `Created ${rows.length} schemes as ${codes.join(', ')}`,
        )
      }
      reset()
      onOpenChange(false)
    } catch (error) {
      toast.error(toReadableError(error, 'Could not import this file.'))
    } finally {
      setImporting(false)
    }
  }

  const blocked = Boolean(preview?.fileError) || (preview?.errors.length ?? 0) > 0
  const canImport = Boolean(preview && !blocked && preview.valid.length > 0)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{kind === 'members' ? 'Upload members' : 'Upload schemes'}</DialogTitle>
          <DialogDescription>
            Use the template. Every row is checked first. Nothing is saved until the file is clean.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(event) => void onFile(event.target.files?.[0])}
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
            <UploadIcon /> Choose file
          </Button>
          <p className="text-muted-foreground text-sm">{fileName ?? 'Excel or CSV'}</p>
        </div>

        {preview?.fileError && <p className="text-destructive text-sm">{preview.fileError}</p>}

        {preview && !preview.fileError && (
          <p className="text-sm">
            <span className="font-medium">{preview.valid.length} valid</span>
            <span className="text-muted-foreground"> · </span>
            <span className={preview.errors.length ? 'text-destructive font-medium' : 'text-muted-foreground'}>
              {preview.errors.length} error{preview.errors.length === 1 ? '' : 's'}
            </span>
            {blocked && <span className="text-muted-foreground"> · import disabled</span>}
          </p>
        )}

        {preview && preview.errors.length > 0 && (
          <div className="max-h-56 overflow-auto rounded-lg border text-sm">
            <table className="w-full">
              <thead className="bg-muted/50 text-muted-foreground sticky top-0 text-left text-xs">
                <tr>
                  <th className="px-3 py-2 font-medium">Row</th>
                  <th className="px-3 py-2 font-medium">Column</th>
                  <th className="px-3 py-2 font-medium">Problem</th>
                </tr>
              </thead>
              <tbody>
                {preview.errors.map((error, index) => (
                  <tr key={`${error.row}-${error.column}-${index}`} className="border-t">
                    <td className="tabular px-3 py-2">{error.row}</td>
                    <td className="px-3 py-2">{error.column}</td>
                    <td className="px-3 py-2">{error.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void importRows()} disabled={!canImport || importing}>
            {importing && <LoaderCircleIcon className="size-4 animate-spin" />}
            Import {preview?.valid.length ? preview.valid.length : ''} {kind}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
