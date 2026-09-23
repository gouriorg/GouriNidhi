import { z } from 'zod'

import {
  auditLogSchema,
  paymentSchema,
  payoutSchema,
  personSchema,
  roundSchema,
  schemeMemberSchema,
  schemeSchema,
  settingSchema,
} from '@/db/schema'
import { APP_NAME, SCHEMA_VERSION } from '@/lib/constants'
import { nowIso } from '@/lib/id'
import {
  auditToRow,
  mapAudit,
  mapMembership,
  mapPayment,
  mapPayout,
  mapPerson,
  mapRound,
  mapScheme,
  mapSetting,
  membershipToRow,
  paymentToRow,
  payoutToRow,
  personToRow,
  roundToRow,
  schemeToRow,
  settingToRow,
  throwIfError,
} from '@/lib/mappers'
import { features } from '@/config/features'
import { getSupabase } from '@/lib/supabase'
import { auditService } from '@/services/audit'
import { notifyDataChanged } from '@/stores/dataVersion'
import { RepositoryError } from '@/repositories/errors'

export const backupEnvelopeSchema = z.object({
  app: z.literal(APP_NAME),
  schemaVersion: z.number().int().positive(),
  exportedAt: z.string(),
  tables: z.object({
    people: z.array(personSchema),
    schemes: z.array(schemeSchema),
    schemeMembers: z.array(schemeMemberSchema),
    rounds: z.array(roundSchema),
    payments: z.array(paymentSchema),
    payouts: z.array(payoutSchema),
    auditLogs: z.array(auditLogSchema),
    settings: z.array(settingSchema),
  }),
})

export type BackupEnvelope = z.infer<typeof backupEnvelopeSchema>
export type TableCounts = Record<keyof BackupEnvelope['tables'], number>

export type ValidationResult =
  | { ok: true; envelope: BackupEnvelope; counts: TableCounts }
  | { ok: false; message: string }

async function countTable(table: string): Promise<number> {
  const { count, error } = await getSupabase().from(table).select('*', { count: 'exact', head: true })
  throwIfError(error)
  return count ?? 0
}

export async function countAllRows(): Promise<TableCounts> {
  const [people, schemes, schemeMembers, rounds, payments, payouts, auditLogs, settings] =
    await Promise.all([
      countTable('people'),
      countTable('schemes'),
      countTable('scheme_members'),
      countTable('rounds'),
      countTable('payments'),
      countTable('payouts'),
      features.auditLog ? countTable('audit_logs') : Promise.resolve(0),
      countTable('settings'),
    ])
  return { people, schemes, schemeMembers, rounds, payments, payouts, auditLogs, settings }
}

async function fetchMapped<T>(table: string, map: (row: Record<string, unknown>) => T): Promise<T[]> {
  const { data, error } = await getSupabase().from(table).select('*')
  throwIfError(error)
  return (data ?? []).map((row) => map(row as Record<string, unknown>))
}

async function upsertRows(table: string, rows: Record<string, unknown>[]): Promise<void> {
  if (rows.length === 0) return
  const chunk = 200
  for (let i = 0; i < rows.length; i += chunk) {
    const { error } = await getSupabase().from(table).upsert(rows.slice(i, i + chunk))
    throwIfError(error)
  }
}

async function wipeLiveData(): Promise<void> {
  const supabase = getSupabase()
  const dated = features.auditLog
    ? ['payments', 'payouts', 'rounds', 'scheme_members', 'schemes', 'audit_logs', 'people']
    : ['payments', 'payouts', 'rounds', 'scheme_members', 'schemes', 'people']
  for (const table of dated) {
    const { error } = await supabase.from(table).delete().gte('created_at', '1900-01-01')
    throwIfError(error)
  }
  const { error } = await supabase.from('settings').delete().neq('key', '')
  throwIfError(error)
}

async function writeTables(envelope: BackupEnvelope): Promise<void> {
  const { tables } = envelope
  await upsertRows('people', tables.people.map(personToRow))
  await upsertRows('schemes', tables.schemes.map(schemeToRow))
  await upsertRows('scheme_members', tables.schemeMembers.map(membershipToRow))
  await upsertRows('rounds', tables.rounds.map(roundToRow))
  await upsertRows('payments', tables.payments.map(paymentToRow))
  await upsertRows('payouts', tables.payouts.map(payoutToRow))
  if (features.auditLog) {
    await upsertRows('audit_logs', tables.auditLogs.map(auditToRow))
  }
  await upsertRows('settings', tables.settings.map(settingToRow))

  for (const person of tables.people) {
    const { error } = await getSupabase().rpc('member_admin', {
      payload: { action: 'ensureAuth', id: person.id },
    })
    if (error) throw new RepositoryError(error.message)
  }
}

export const backupService = {
  async export(): Promise<BackupEnvelope> {
    const [people, schemes, schemeMembers, rounds, payments, payouts, auditLogs, settings] =
      await Promise.all([
        fetchMapped('people', mapPerson),
        fetchMapped('schemes', mapScheme),
        fetchMapped('scheme_members', mapMembership),
        fetchMapped('rounds', mapRound),
        fetchMapped('payments', mapPayment),
        fetchMapped('payouts', mapPayout),
        features.auditLog ? fetchMapped('audit_logs', mapAudit) : Promise.resolve([]),
        fetchMapped('settings', mapSetting),
      ])

    return {
      app: APP_NAME,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: nowIso(),
      tables: { people, schemes, schemeMembers, rounds, payments, payouts, auditLogs, settings },
    }
  },

  /** Parse and validate without touching the database. */
  validate(raw: string): ValidationResult {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return { ok: false, message: 'That file is not valid JSON.' }
    }

    const result = backupEnvelopeSchema.safeParse(parsed)
    if (!result.success) {
      const first = result.error.issues[0]
      const path = first?.path.join('.') || 'file'
      return {
        ok: false,
        message: `This backup does not match the GouriNidhi format (${path}: ${first?.message ?? 'unknown problem'}).`,
      }
    }

    if (result.data.schemaVersion > SCHEMA_VERSION) {
      return {
        ok: false,
        message: `This backup was made by a newer version of GouriNidhi (schema ${result.data.schemaVersion}, this app supports ${SCHEMA_VERSION}). Update the app first.`,
      }
    }

    const tables = result.data.tables
    return {
      ok: true,
      envelope: result.data,
      counts: {
        people: tables.people.length,
        schemes: tables.schemes.length,
        schemeMembers: tables.schemeMembers.length,
        rounds: tables.rounds.length,
        payments: tables.payments.length,
        payouts: tables.payouts.length,
        auditLogs: tables.auditLogs.length,
        settings: tables.settings.length,
      },
    }
  },

  async replace(envelope: BackupEnvelope): Promise<void> {
    await wipeLiveData()
    await writeTables(envelope)
    await auditService.record({
      action: 'backup.restored',
      entityType: 'backup',
      entityId: 'replace',
      summary: `Replaced all data from a backup exported ${envelope.exportedAt}`,
    })
    notifyDataChanged()
  },

  async merge(envelope: BackupEnvelope): Promise<void> {
    await writeTables(envelope)
    await auditService.record({
      action: 'backup.merged',
      entityType: 'backup',
      entityId: 'merge',
      summary: `Merged a backup exported ${envelope.exportedAt}`,
    })
    notifyDataChanged()
  },
}
