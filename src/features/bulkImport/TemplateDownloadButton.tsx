import { DownloadIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { downloadBytes, downloadTextFile } from '@/lib/csv'
import {
  memberTemplateCsv,
  memberTemplateXlsx,
  schemeTemplateCsv,
  schemeTemplateXlsx,
} from '@/lib/bulkImport/templates'

export function TemplateDownloadButton({ kind }: { kind: 'members' | 'schemes' }) {
  function downloadCsv() {
    if (kind === 'members') downloadTextFile('gourinidhi-members-template.csv', memberTemplateCsv())
    else downloadTextFile('gourinidhi-schemes-template.csv', schemeTemplateCsv())
  }

  function downloadExcel() {
    const bytes = kind === 'members' ? memberTemplateXlsx() : schemeTemplateXlsx()
    const name =
      kind === 'members' ? 'gourinidhi-members-template.xlsx' : 'gourinidhi-schemes-template.xlsx'
    downloadBytes(name, bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline">
          <DownloadIcon /> Template
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={downloadExcel}>Excel (.xlsx)</DropdownMenuItem>
        <DropdownMenuItem onClick={downloadCsv}>CSV</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
