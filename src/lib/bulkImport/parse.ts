import * as XLSX from 'xlsx'

import type { CellMap, ParsedTable } from '@/lib/bulkImport/types'

const FORMULA_ERROR = /^#(N\/A|VALUE!|REF!|DIV\/0!|NAME\?|NULL!|NUM!|GETTING_DATA)/i

export function parseCsvText(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    if (inQuotes) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return String(value).trim()
}

export function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function tableFromGrid(grid: string[][]): ParsedTable {
  if (grid.length === 0) return { fileError: 'This file is empty.', rows: [] }

  const headerIndex = grid.findIndex((row) => row.some((cell) => cell.trim() !== ''))
  if (headerIndex < 0) return { fileError: 'This file is empty.', rows: [] }

  const headers = grid[headerIndex].map((header) => normalizeHeader(header))
  const rows: ParsedTable['rows'] = []

  for (let index = headerIndex + 1; index < grid.length; index += 1) {
    const raw = grid[index] ?? []
    const cells: CellMap = {}
    let empty = true
    for (let col = 0; col < headers.length; col += 1) {
      const key = headers[col]
      if (!key) continue
      const value = cellText(raw[col] ?? '')
      if (FORMULA_ERROR.test(value)) {
        cells[key] = value
        empty = false
        continue
      }
      cells[key] = value
      if (value) empty = false
    }
    if (empty) continue
    rows.push({ rowNumber: index + 1, cells })
  }

  return { rows }
}

function gridFromSheet(sheet: XLSX.WorkSheet): string[][] {
  const raw = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    raw: true,
    defval: '',
    blankrows: false,
  })
  return raw.map((row) => (Array.isArray(row) ? row.map((cell) => cellText(cell)) : []))
}

export function parseWorkbook(buffer: ArrayBuffer, filename: string): ParsedTable {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.csv')) {
    const text = new TextDecoder('utf-8').decode(buffer)
    return tableFromGrid(parseCsvText(text))
  }
  if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
    return { fileError: 'Upload an Excel (.xlsx) or CSV file.', rows: [] }
  }

  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const preferred =
    workbook.SheetNames.find((name) => name.trim().toLowerCase() === 'data') ??
    workbook.SheetNames.find((name) => name.trim().toLowerCase() !== 'instructions') ??
    workbook.SheetNames[0]
  if (!preferred || !workbook.Sheets[preferred]) {
    return { fileError: 'This workbook has no data sheet.', rows: [] }
  }
  return tableFromGrid(gridFromSheet(workbook.Sheets[preferred]))
}

export function mapColumn(cells: CellMap, aliases: string[]): string | undefined {
  for (const alias of aliases) {
    if (alias in cells) return alias
  }
  return undefined
}

export function cellValue(cells: CellMap, aliases: string[]): string {
  const key = mapColumn(cells, aliases)
  return key ? cells[key] ?? '' : ''
}

export function hasColumn(rows: ParsedTable['rows'], aliases: string[]): boolean {
  if (rows.length === 0) return false
  return aliases.some((alias) => alias in rows[0].cells)
}
