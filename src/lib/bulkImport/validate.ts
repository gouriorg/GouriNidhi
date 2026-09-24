import { isValidDateOnly } from '@/lib/dates'
import { normalizeIndianMobileInput } from '@/lib/mobile'
import { fromRupees, percentToBps } from '@/domain/money/money'
import {
  canBuildSchedule,
  buildFixedProfitSchedule,
} from '@/domain/distribution/fixedProfitSchedule'
import { cellValue, hasColumn } from '@/lib/bulkImport/parse'
import type { ImportPreview, MemberImportRow, ParsedTable, RowError, SchemeImportRow } from '@/lib/bulkImport/types'

const FORMULA_ERROR = /^#(N\/A|VALUE!|REF!|DIV\/0!|NAME\?|NULL!|NUM!|GETTING_DATA)/i
const NAME_ALLOWED = /^[\p{L} .'-]+$/u

const MEMBER_NAME_KEYS = ['full_name', 'name', 'member_name', 'member']
const MOBILE_KEYS = ['mobile', 'mobile_number', 'phone', 'phone_number', 'contact']
const ADDRESS_KEYS = ['address']
const NOTES_KEYS = ['notes', 'note']

const SCHEME_NAME_KEYS = ['name', 'scheme_name', 'scheme']
const AMOUNT_KEYS = [
  'monthly_contribution_rupees',
  'monthly_contribution',
  'monthly_amount',
  'contribution',
  'amount',
  'monthly',
]
const MAX_MEMBERS_KEYS = ['max_members', 'members', 'member_count', 'seats']
const DURATION_KEYS = ['duration_months', 'duration', 'months']
const START_KEYS = ['start_date', 'start', 'date']
const COLLECTION_KEYS = ['collection_day', 'collection', 'day']
const PROFIT_KEYS = ['profit_percent', 'profit', 'profit_%']
const DESCRIPTION_KEYS = ['description']

export function collapseSpaces(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function nameKey(value: string): string {
  return collapseSpaces(value).toLowerCase()
}

export function checkName(raw: string, label: string): { ok: true; value: string } | { ok: false; message: string } {
  const value = collapseSpaces(raw)
  if (!value) return { ok: false, message: `${label} is required.` }
  if (value.length < 2 || value.length > 80) return { ok: false, message: `${label} must be 2–80 characters.` }
  if (/\d/.test(value)) return { ok: false, message: `${label} cannot contain numbers.` }
  if (!NAME_ALLOWED.test(value)) {
    return {
      ok: false,
      message: `${label} can only use letters, spaces, full stop, apostrophe and hyphen.`,
    }
  }
  if (!/\p{L}/u.test(value)) return { ok: false, message: `Enter a real ${label.toLowerCase()}.` }
  return { ok: true, value }
}

export function parseMobile(raw: string): { ok: true; value: string } | { ok: false; message: string } {
  const digits = normalizeIndianMobileInput(raw)
  if (!raw.trim()) return { ok: false, message: 'Mobile number is required.' }
  if (!digits) return { ok: false, message: 'Mobile number is required.' }
  if (!/^[6-9]\d{9}$/.test(digits)) {
    return { ok: false, message: 'Enter a valid 10-digit Indian mobile number.' }
  }
  return { ok: true, value: digits }
}

function rejectFormula(raw: string): string | undefined {
  if (FORMULA_ERROR.test(raw.trim())) return 'Cell is not a valid value.'
  return undefined
}

function stripNumeric(raw: string): string {
  return raw
    .trim()
    .replace(/₹/g, '')
    .replace(/\bINR\b/gi, '')
    .replace(/\bRs\.?/gi, '')
    .replace(/,/g, '')
    .replace(/\s/g, '')
}

export function parseWholeRupees(
  raw: string,
): { ok: true; value: number } | { ok: false; message: string } {
  const formula = rejectFormula(raw)
  if (formula) return { ok: false, message: formula }
  if (!raw.trim()) return { ok: false, message: 'Monthly contribution is required and must be a number.' }
  const cleaned = stripNumeric(raw)
  if (!cleaned) return { ok: false, message: 'Monthly contribution is required and must be a number.' }
  if (/[a-zA-Z]/.test(cleaned)) return { ok: false, message: 'Amount must be a number, not text.' }
  if (!/^-?\d+(\.0+)?$/.test(cleaned)) {
    if (/^-?\d+\.\d+$/.test(cleaned)) return { ok: false, message: 'Use whole rupees only (no paise).' }
    return { ok: false, message: 'Amount must be a number, not text.' }
  }
  const value = Number(cleaned)
  if (!Number.isFinite(value)) return { ok: false, message: 'Amount must be a number, not text.' }
  if (value <= 0) return { ok: false, message: 'Amount must be greater than 0.' }
  if (value > 10_000_000) return { ok: false, message: 'Amount is too large.' }
  return { ok: true, value }
}

export function parseWholeNumber(
  raw: string,
  { min, max, emptyMessage }: { min: number; max: number; emptyMessage: string },
): { ok: true; value: number } | { ok: false; message: string } {
  const formula = rejectFormula(raw)
  if (formula) return { ok: false, message: formula }
  if (!raw.trim()) return { ok: false, message: emptyMessage }
  const cleaned = stripNumeric(raw)
  if (!/^-?\d+$/.test(cleaned)) return { ok: false, message: 'Must be a whole number.' }
  const value = Number(cleaned)
  if (!Number.isSafeInteger(value)) return { ok: false, message: 'Must be a whole number.' }
  if (value < min || value > max) return { ok: false, message: `Must be between ${min} and ${max}.` }
  return { ok: true, value }
}

export function parseProfitPercent(
  raw: string,
): { ok: true; value: number } | { ok: false; message: string } {
  const formula = rejectFormula(raw)
  if (formula) return { ok: false, message: formula }
  if (!raw.trim()) return { ok: false, message: 'Profit percent is required and must be a number.' }
  const cleaned = stripNumeric(raw).replace(/%$/, '')
  if (/[a-zA-Z]/.test(cleaned)) return { ok: false, message: 'Profit must be a number, not text.' }
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return { ok: false, message: 'Profit must be a number, not text.' }
  const value = Number(cleaned)
  if (!Number.isFinite(value)) return { ok: false, message: 'Profit must be a number, not text.' }
  if (value < 0) return { ok: false, message: 'Profit cannot be negative.' }
  if (value > 100) return { ok: false, message: 'Profit cannot exceed 100%.' }
  return { ok: true, value }
}

function fromExcelSerial(serial: number): string {
  const epoch = Date.UTC(1899, 11, 30)
  const date = new Date(epoch + Math.round(serial) * 86_400_000)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseStartDate(raw: string): { ok: true; value: string } | { ok: false; message: string } {
  const formula = rejectFormula(raw)
  if (formula) return { ok: false, message: formula }
  const value = raw.trim()
  if (!value) return { ok: false, message: 'Start date is required (yyyy-MM-dd).' }
  if (isValidDateOnly(value)) return { ok: true, value }
  if (/^\d+(\.0+)?$/.test(value)) {
    const serial = Number(value)
    if (serial > 20_000 && serial < 80_000) {
      const converted = fromExcelSerial(serial)
      if (isValidDateOnly(converted)) return { ok: true, value: converted }
    }
  }
  return { ok: false, message: 'Use a valid date (yyyy-MM-dd).' }
}

function optionalText(
  raw: string,
  max: number,
  column: string,
): { ok: true; value?: string } | { ok: false; message: string; column: string } {
  const formula = rejectFormula(raw)
  if (formula) return { ok: false, message: formula, column }
  const value = raw.trim()
  if (!value) return { ok: true, value: undefined }
  if (value.length > max) return { ok: false, message: `Must be at most ${max} characters.`, column }
  return { ok: true, value }
}

function pushError(errors: RowError[], row: number, column: string, message: string) {
  errors.push({ row, column, message })
}

export function validateMemberTable(
  table: ParsedTable,
  existing: { names: string[]; mobiles: string[] },
): ImportPreview<MemberImportRow> {
  if (table.fileError) return { fileError: table.fileError, errors: [], valid: [] }
  if (table.rows.length === 0) return { fileError: 'No data rows found. Use the template.', errors: [], valid: [] }

  if (!hasColumn(table.rows, MEMBER_NAME_KEYS) || !hasColumn(table.rows, MOBILE_KEYS)) {
    return {
      fileError: 'This file is missing required columns: full_name and mobile.',
      errors: [],
      valid: [],
    }
  }

  const errors: RowError[] = []
  const valid: MemberImportRow[] = []
  const namesInFile = new Map<string, number>()
  const mobilesInFile = new Map<string, number>()
  const existingNames = new Set(existing.names.map(nameKey))
  const existingMobiles = new Set(existing.mobiles.map((mobile) => mobile.trim()))

  for (const row of table.rows) {
    const nameResult = checkName(cellValue(row.cells, MEMBER_NAME_KEYS), 'Name')
    const mobileResult = parseMobile(cellValue(row.cells, MOBILE_KEYS))
    const addressResult = optionalText(cellValue(row.cells, ADDRESS_KEYS), 240, 'address')
    const notesResult = optionalText(cellValue(row.cells, NOTES_KEYS), 500, 'notes')
    let rowHasError = false

    if (!nameResult.ok) {
      pushError(errors, row.rowNumber, 'full_name', nameResult.message)
      rowHasError = true
    } else {
      const key = nameKey(nameResult.value)
      const earlier = namesInFile.get(key)
      if (earlier) {
        pushError(errors, row.rowNumber, 'full_name', `Duplicate name in this file (also on row ${earlier}).`)
        rowHasError = true
      } else if (existingNames.has(key)) {
        pushError(errors, row.rowNumber, 'full_name', `A member named ${nameResult.value} already exists.`)
        rowHasError = true
      } else {
        namesInFile.set(key, row.rowNumber)
      }
    }

    if (!mobileResult.ok) {
      pushError(errors, row.rowNumber, 'mobile', mobileResult.message)
      rowHasError = true
    } else {
      const earlier = mobilesInFile.get(mobileResult.value)
      if (earlier) {
        pushError(errors, row.rowNumber, 'mobile', `This mobile is already used (row ${earlier}).`)
        rowHasError = true
      } else if (existingMobiles.has(mobileResult.value)) {
        pushError(errors, row.rowNumber, 'mobile', 'This mobile is already used by an existing member.')
        rowHasError = true
      } else {
        mobilesInFile.set(mobileResult.value, row.rowNumber)
      }
    }

    if (!addressResult.ok) {
      pushError(errors, row.rowNumber, addressResult.column, addressResult.message)
      rowHasError = true
    }
    if (!notesResult.ok) {
      pushError(errors, row.rowNumber, notesResult.column, notesResult.message)
      rowHasError = true
    }

    if (rowHasError || !nameResult.ok || !mobileResult.ok || !addressResult.ok || !notesResult.ok) continue
    valid.push({
      fullName: nameResult.value,
      mobile: mobileResult.value,
      address: addressResult.value,
      notes: notesResult.value,
    })
  }

  return { errors, valid }
}

export function validateSchemeTable(
  table: ParsedTable,
  existingNames: string[],
): ImportPreview<SchemeImportRow> {
  if (table.fileError) return { fileError: table.fileError, errors: [], valid: [] }
  if (table.rows.length === 0) return { fileError: 'No data rows found. Use the template.', errors: [], valid: [] }

  const requiredOk =
    hasColumn(table.rows, SCHEME_NAME_KEYS) &&
    hasColumn(table.rows, AMOUNT_KEYS) &&
    hasColumn(table.rows, MAX_MEMBERS_KEYS) &&
    hasColumn(table.rows, DURATION_KEYS) &&
    hasColumn(table.rows, START_KEYS) &&
    hasColumn(table.rows, COLLECTION_KEYS) &&
    hasColumn(table.rows, PROFIT_KEYS)

  if (!requiredOk) {
    return {
      fileError:
        'This file is missing required columns: name, monthly_contribution_rupees, max_members, duration_months, start_date, collection_day, profit_percent.',
      errors: [],
      valid: [],
    }
  }

  const errors: RowError[] = []
  const valid: SchemeImportRow[] = []
  const namesInFile = new Map<string, number>()
  const existing = new Set(existingNames.map(nameKey))

  for (const row of table.rows) {
    const nameResult = checkName(cellValue(row.cells, SCHEME_NAME_KEYS), 'Name')
    const amountResult = parseWholeRupees(cellValue(row.cells, AMOUNT_KEYS))
    const membersResult = parseWholeNumber(cellValue(row.cells, MAX_MEMBERS_KEYS), {
      min: 2,
      max: 500,
      emptyMessage: 'Number of members is required and must be a whole number.',
    })
    const durationResult = parseWholeNumber(cellValue(row.cells, DURATION_KEYS), {
      min: 1,
      max: 500,
      emptyMessage: 'Duration is required and must be a whole number.',
    })
    const startResult = parseStartDate(cellValue(row.cells, START_KEYS))
    const dayResult = parseWholeNumber(cellValue(row.cells, COLLECTION_KEYS), {
      min: 1,
      max: 28,
      emptyMessage: 'Collection day is required (1–28).',
    })
    const profitResult = parseProfitPercent(cellValue(row.cells, PROFIT_KEYS))
    const descriptionResult = optionalText(cellValue(row.cells, DESCRIPTION_KEYS), 500, 'description')
    const notesResult = optionalText(cellValue(row.cells, NOTES_KEYS), 500, 'notes')
    let rowHasError = false

    if (!nameResult.ok) {
      pushError(errors, row.rowNumber, 'name', nameResult.message)
      rowHasError = true
    } else {
      const key = nameKey(nameResult.value)
      const earlier = namesInFile.get(key)
      if (earlier) {
        pushError(errors, row.rowNumber, 'name', `Duplicate name in this file (also on row ${earlier}).`)
        rowHasError = true
      } else if (existing.has(key)) {
        pushError(errors, row.rowNumber, 'name', `A scheme named ${nameResult.value} already exists.`)
        rowHasError = true
      } else {
        namesInFile.set(key, row.rowNumber)
      }
    }

    if (!amountResult.ok) {
      pushError(errors, row.rowNumber, 'monthly_contribution_rupees', amountResult.message)
      rowHasError = true
    }
    if (!membersResult.ok) {
      pushError(errors, row.rowNumber, 'max_members', membersResult.message)
      rowHasError = true
    }
    if (!durationResult.ok) {
      pushError(errors, row.rowNumber, 'duration_months', durationResult.message)
      rowHasError = true
    }
    if (!startResult.ok) {
      pushError(errors, row.rowNumber, 'start_date', startResult.message)
      rowHasError = true
    }
    if (!dayResult.ok) {
      pushError(errors, row.rowNumber, 'collection_day', dayResult.message)
      rowHasError = true
    }
    if (!profitResult.ok) {
      pushError(errors, row.rowNumber, 'profit_percent', profitResult.message)
      rowHasError = true
    }
    if (!descriptionResult.ok) {
      pushError(errors, row.rowNumber, descriptionResult.column, descriptionResult.message)
      rowHasError = true
    }
    if (!notesResult.ok) {
      pushError(errors, row.rowNumber, notesResult.column, notesResult.message)
      rowHasError = true
    }

    if (
      rowHasError ||
      !nameResult.ok ||
      !amountResult.ok ||
      !membersResult.ok ||
      !durationResult.ok ||
      !startResult.ok ||
      !dayResult.ok ||
      !profitResult.ok ||
      !descriptionResult.ok ||
      !notesResult.ok
    ) {
      continue
    }

    const monthlyAmount = fromRupees(amountResult.value)
    const profitBps = percentToBps(profitResult.value)
    const input = {
      maxMembers: membersResult.value,
      monthlyAmount,
      durationMonths: durationResult.value,
      startDate: startResult.value,
      collectionDay: dayResult.value,
      profitBps,
    }
    if (!canBuildSchedule(input)) {
      pushError(errors, row.rowNumber, 'name', 'These values cannot build a payout schedule.')
      continue
    }
    try {
      buildFixedProfitSchedule(input)
    } catch {
      pushError(errors, row.rowNumber, 'name', 'These values cannot build a payout schedule.')
      continue
    }

    valid.push({
      name: nameResult.value,
      monthlyAmount,
      maxMembers: membersResult.value,
      durationMonths: durationResult.value,
      startDate: startResult.value,
      collectionDay: dayResult.value,
      profitBps,
      description: descriptionResult.value,
      notes: notesResult.value,
    })
  }

  return { errors, valid }
}
