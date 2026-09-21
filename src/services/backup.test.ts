import { describe, expect, it } from 'vitest'

import { APP_NAME, SCHEMA_VERSION } from '@/lib/constants'
import { backupService } from '@/services/backup'

describe('backup validation', () => {
  it('rejects a file that is not JSON', () => {
    const result = backupService.validate('this is not json')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toMatch(/not valid JSON/)
  })

  it('rejects a JSON file that is not a GouriNidhi backup', () => {
    const result = backupService.validate(JSON.stringify({ hello: 'world' }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toMatch(/does not match the GouriNidhi format/)
  })

  it('refuses a backup written by a newer schema version', () => {
    const envelope = {
      app: APP_NAME,
      schemaVersion: SCHEMA_VERSION + 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      tables: {
        people: [],
        schemes: [],
        schemeMembers: [],
        rounds: [],
        payments: [],
        payouts: [],
        auditLogs: [],
        settings: [],
      },
    }
    const result = backupService.validate(JSON.stringify(envelope))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toMatch(/newer version/)
  })

  it('accepts an empty valid envelope', () => {
    const envelope = {
      app: APP_NAME,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: '2026-01-01T00:00:00.000Z',
      tables: {
        people: [],
        schemes: [],
        schemeMembers: [],
        rounds: [],
        payments: [],
        payouts: [],
        auditLogs: [],
        settings: [],
      },
    }
    const result = backupService.validate(JSON.stringify(envelope))
    expect(result.ok).toBe(true)
  })
})
