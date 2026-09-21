import * as XLSX from 'xlsx'

import { toCsv } from '@/lib/csv'

export const MEMBER_HEADERS = ['full_name', 'mobile', 'address', 'notes'] as const
export const SCHEME_HEADERS = [
  'name',
  'monthly_contribution_rupees',
  'max_members',
  'duration_months',
  'start_date',
  'collection_day',
  'profit_percent',
  'description',
  'notes',
] as const

const MEMBER_INSTRUCTIONS: string[][] = [
  ['GouriNidhi member upload'],
  ['Fill the Data sheet. Do not add extra header rows.'],
  [''],
  ['Column', 'Required', 'Rules'],
  ['full_name', 'Yes', '2–80 characters. Letters, spaces, full stop, apostrophe, hyphen. No numbers or other symbols. Must be unique in this file and in the app.'],
  ['mobile', 'Yes', '10-digit Indian mobile starting 6–9. This is also their login. Must be unique.'],
  ['address', 'No', 'Up to 240 characters.'],
  ['notes', 'No', 'Up to 500 characters.'],
  [''],
  ['Empty rows are skipped. Delete the sample row before you upload, or replace it with a real member.'],
]

const SCHEME_INSTRUCTIONS: string[][] = [
  ['GouriNidhi scheme upload'],
  ['Fill the Data sheet. Do not include a code column — codes are assigned as GN-001, GN-002, …'],
  [''],
  ['Column', 'Required', 'Rules'],
  ['name', 'Yes', '2–80 characters. Same name rules as members. Must be unique.'],
  ['monthly_contribution_rupees', 'Yes', 'Whole rupees only. Example: 4000 or 4,000. No blank cells.'],
  ['max_members', 'Yes', 'Whole number from 2 to 500.'],
  ['duration_months', 'Yes', 'Whole number from 1 to 500.'],
  ['start_date', 'Yes', 'yyyy-MM-dd (example 2026-09-01). Excel dates are accepted.'],
  ['collection_day', 'Yes', 'Day 1–28 of each month.'],
  ['profit_percent', 'Yes', 'Number from 0 to 100. Example: 10'],
  ['description', 'No', 'Up to 500 characters.'],
  ['notes', 'No', 'Up to 500 characters.'],
  [''],
  ['Imported schemes are created as Draft. Empty rows are skipped.'],
]

const MEMBER_SAMPLE = ['Ravi Kumar', '9876543210', '12 MG Road, Bengaluru', '']
const SCHEME_SAMPLE = ['GouriNidhi Family 2026', '4000', '20', '20', '2026-09-01', '1', '10', '', '']

function toWorkbook(instructions: string[][], headers: readonly string[], sample: string[]): Uint8Array {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(instructions), 'Instructions')
  const data = XLSX.utils.aoa_to_sheet([headers as string[], sample])
  XLSX.utils.book_append_sheet(workbook, data, 'Data')
  const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return new Uint8Array(output)
}

export function memberTemplateCsv(): string {
  return toCsv([...MEMBER_HEADERS], [MEMBER_SAMPLE])
}

export function schemeTemplateCsv(): string {
  return toCsv([...SCHEME_HEADERS], [SCHEME_SAMPLE])
}

export function memberTemplateXlsx(): Uint8Array {
  return toWorkbook(MEMBER_INSTRUCTIONS, MEMBER_HEADERS, MEMBER_SAMPLE)
}

export function schemeTemplateXlsx(): Uint8Array {
  return toWorkbook(SCHEME_INSTRUCTIONS, SCHEME_HEADERS, SCHEME_SAMPLE)
}
