import { useEffect, useState } from 'react'

import { useDataVersion } from '@/stores/dataVersion'

/**
 * Drop-in replacement for Dexie's useLiveQuery. Reloads when `deps` change or
 * after any repository write (via dataVersion).
 */
export function useLiveQuery<T>(
  querier: () => Promise<T | undefined> | T | undefined,
  deps: unknown[] = [],
): T | undefined {
  const version = useDataVersion((s) => s.version)
  const [data, setData] = useState<T | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const result = await querier()
        if (!cancelled) setData(result)
      } catch {
        if (!cancelled) setData(undefined)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps provided by caller
  }, [...deps, version])

  return data
}
