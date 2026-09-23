import { features } from '@/config/features'
import { getSupabase } from '@/lib/supabase'
import { auditToRow, mapAudit } from '@/lib/mappers'
import { newId, nowIso } from '@/lib/id'
import { useSessionStore } from '@/stores/session'
import type { AuditEntityType, AuditLog } from '@/types/entities'

const MAX_JSON_CHARS = 4000

function snapshot(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  try {
    const json = JSON.stringify(value)
    if (!json) return undefined
    return json.length > MAX_JSON_CHARS ? `${json.slice(0, MAX_JSON_CHARS)}…(truncated)` : json
  } catch {
    return undefined
  }
}

function currentActor(): { actorPersonId?: string; actorLabel: string } {
  const session = useSessionStore.getState().session
  if (session?.kind === 'member') {
    return { actorPersonId: session.personId, actorLabel: session.fullName }
  }
  return { actorLabel: 'Admin' }
}

export type AuditInput = {
  action: string
  entityType: AuditEntityType
  entityId: string
  summary: string
  before?: unknown
  after?: unknown
}

export const auditService = {
  build(input: AuditInput): AuditLog {
    const { actorPersonId, actorLabel } = currentActor()
    return {
      id: newId(),
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
      beforeJson: snapshot(input.before),
      afterJson: snapshot(input.after),
      actorPersonId,
      actorLabel,
      createdAt: nowIso(),
    }
  },

  async record(input: AuditInput): Promise<void> {
    if (!features.auditLog) return
    const log = auditService.build(input)
    await getSupabase().from('audit_logs').insert(auditToRow(log))
  },

  async list(filters?: {
    action?: string
    entityType?: AuditEntityType
    from?: string
    to?: string
    search?: string
  }): Promise<AuditLog[]> {
    if (!features.auditLog) return []
    let query = getSupabase().from('audit_logs').select('*').order('created_at', { ascending: false })
    const { data, error } = await query
    if (error) return []
    let logs = (data ?? []).map(mapAudit)

    if (filters?.action) logs = logs.filter((log) => log.action === filters.action)
    if (filters?.entityType) logs = logs.filter((log) => log.entityType === filters.entityType)
    if (filters?.from) logs = logs.filter((log) => log.createdAt.slice(0, 10) >= filters.from!)
    if (filters?.to) logs = logs.filter((log) => log.createdAt.slice(0, 10) <= filters.to!)
    if (filters?.search) {
      const needle = filters.search.toLowerCase()
      logs = logs.filter(
        (log) =>
          log.summary.toLowerCase().includes(needle) ||
          log.actorLabel.toLowerCase().includes(needle),
      )
    }

    return logs
  },
}
