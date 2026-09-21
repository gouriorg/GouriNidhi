export type CellMap = Record<string, string>

export type RowError = {
  row: number
  column: string
  message: string
}

export type ParsedTable = {
  fileError?: string
  rows: { rowNumber: number; cells: CellMap }[]
}

export type MemberImportRow = {
  fullName: string
  mobile: string
  address?: string
  notes?: string
}

export type SchemeImportRow = {
  name: string
  monthlyAmount: number
  maxMembers: number
  durationMonths: number
  startDate: string
  collectionDay: number
  profitBps: number
  description?: string
  notes?: string
}

export type ImportPreview<T> = {
  fileError?: string
  errors: RowError[]
  valid: T[]
}
