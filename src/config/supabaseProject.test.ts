import { describe, expect, it } from 'vitest'

import { hostedConfigJson, parseSupabaseProject } from '@/config/supabaseProject'

describe('supabase project config', () => {
  it('accepts a publishable key and https project URL', () => {
    const parsed = parseSupabaseProject(
      'https://abcd.supabase.co/',
      'sb_publishable_examplekey_abcdefghijklmnopqrstuv',
    )
    expect(parsed).toEqual({
      url: 'https://abcd.supabase.co',
      anonKey: 'sb_publishable_examplekey_abcdefghijklmnopqrstuv',
    })
  })

  it('rejects a non-supabase host', () => {
    const parsed = parseSupabaseProject('https://example.com', 'sb_publishable_abc')
    expect(parsed).toEqual({ error: expect.any(String) })
  })

  it('serialises a host config file the app can fetch', () => {
    expect(
      hostedConfigJson({
        url: 'https://abcd.supabase.co',
        anonKey: 'sb_publishable_abc',
      }),
    ).toBe(`{
  "url": "https://abcd.supabase.co",
  "anonKey": "sb_publishable_abc"
}
`)
  })
})
